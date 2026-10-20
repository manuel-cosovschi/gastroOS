-- La auditoría de la base: qué puede llamar alguien sin sesión, y si cada
-- función que corre con permisos de dueño se cuida sola.
--
--   npm run prueba:base          (lee la conexión de un archivo con permisos 600)
--
-- Corre como el dueño de la base (`postgres`), porque lo que mira —privilegios
-- de otros roles, la configuración de cada función— un rol común no lo ve. No
-- escribe nada: todo va adentro de una transacción que termina en ROLLBACK, y
-- cada control que falla corta con un RAISE que dice qué y por qué.
--
-- ==================================================================
-- La lista permitida, escrita
-- ==================================================================
-- Supabase le da EXECUTE a `anon` sobre toda función nueva del esquema público
-- salvo que alguien lo saque. Así que «qué puede llamar un visitante» no es lo
-- que uno cree que habilitó: es todo menos lo que revocó. Esta lista es lo que
-- el código necesita de verdad sin sesión, cada una con su porqué. Una función
-- que aparece llamable y no está acá es un hallazgo, no un detalle.

BEGIN;

CREATE TEMP TABLE permitidas_anon (nombre text PRIMARY KEY, porque text NOT NULL);
INSERT INTO permitidas_anon VALUES
  ('create_storefront_order', 'la tienda pública toma pedidos sin cuenta (src/actions/catalog.ts)'),
  ('get_order_tracking',      'el seguimiento del pedido por número y teléfono (src/app/(tienda)/pedido/seguimiento)'),
  ('is_storefront_open',      'las políticas de lectura pública del catálogo la usan'),
  ('media_owner',             'la política del bucket de imágenes la usa para lecturas públicas'),
  ('is_demo_sandbox',         'las políticas de la tienda la usan para esconder las copias de la demo');

-- 1. Lo que `anon` puede ejecutar, contra la lista.
DO $$
DECLARE
  sobrantes text;
BEGIN
  SELECT string_agg(n.nspname || '.' || p.proname || '(' || pg_get_function_identity_arguments(p.oid) || ')', E'\n  ')
    INTO sobrantes
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
   WHERE n.nspname IN ('public', 'sovare')
     AND p.prokind = 'f'
     AND has_function_privilege('anon', p.oid, 'EXECUTE')
     AND p.proname NOT IN (SELECT nombre FROM permitidas_anon);
  IF sobrantes IS NOT NULL THEN
    RAISE EXCEPTION E'Funciones que un visitante sin sesión puede llamar y no están en la lista:\n  %\nRevocá (REVOKE EXECUTE ... FROM anon, public) o agregala con su porqué.', sobrantes;
  END IF;
END $$;

-- 2. Toda función SECURITY DEFINER fija su search_path. Sin eso, quien pueda
--    crear un objeto con el mismo nombre en otro esquema le cambia lo que
--    ejecuta, con permisos de dueño.
DO $$
DECLARE
  sueltas text;
BEGIN
  SELECT string_agg(n.nspname || '.' || p.proname, ', ')
    INTO sueltas
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
   WHERE n.nspname IN ('public', 'sovare')
     AND p.prosecdef
     AND NOT EXISTS (SELECT 1 FROM unnest(coalesce(p.proconfig, '{}')) c WHERE c LIKE 'search_path=%');
  IF sueltas IS NOT NULL THEN
    RAISE EXCEPTION 'SECURITY DEFINER sin search_path fijo: %', sueltas;
  END IF;
END $$;

-- 3. Toda función SECURITY DEFINER que un usuario con sesión puede llamar mira
--    quién la llama. No se puede probar en general sin leer cada cuerpo, así
--    que se lista: la revisión es a mano, y esta lista es lo que hay que leer.
SELECT n.nspname || '.' || p.proname AS definer_llamable_con_sesion,
       (pg_get_functiondef(p.oid) ~* '(auth\.uid\(\)|is_business_member|is_admin|is_service_role|current_setting\(''request\.jwt)') AS mira_quien_llama
  FROM pg_proc p
  JOIN pg_namespace n ON n.oid = p.pronamespace
 WHERE n.nspname IN ('public', 'sovare')
   AND p.prokind = 'f'
   AND p.prosecdef
   AND has_function_privilege('authenticated', p.oid, 'EXECUTE')
 ORDER BY 2, 1;

-- 4. Ninguna tabla del esquema público sin RLS.
DO $$
DECLARE
  sin_rls text;
BEGIN
  SELECT string_agg(c.relname, ', ') INTO sin_rls
    FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
   WHERE n.nspname IN ('public', 'sovare') AND c.relkind = 'r' AND NOT c.relrowsecurity;
  IF sin_rls IS NOT NULL THEN
    RAISE EXCEPTION 'Tablas sin RLS: %', sin_rls;
  END IF;
END $$;

-- 5. La plantilla de la demo sólo tiene clientes del sembrado. Es la misma
--    pregunta que hace la guarda de las capturas, hecha en la base: si alguien
--    pidió en la tienda de ejemplo y ese negocio es la plantilla, su nombre y su
--    teléfono se copian a la demo de cada visitante.
DO $$
DECLARE
  ajenos text;
BEGIN
  SELECT string_agg(c.first_name || ' ' || coalesce(c.last_name, '') || ' ' || coalesce(c.phone, ''), '; ')
    INTO ajenos
    FROM customers c JOIN businesses b ON b.id = c.business_id
   WHERE b.is_demo_template
     AND coalesce(c.phone, '') NOT LIKE '+54 11 5555 01%';
  IF ajenos IS NOT NULL THEN
    RAISE EXCEPTION 'La plantilla de la demo tiene clientes que no son del sembrado: %', ajenos;
  END IF;
END $$;

ROLLBACK;
