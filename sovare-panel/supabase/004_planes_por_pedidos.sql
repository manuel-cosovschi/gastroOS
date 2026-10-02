-- ============================================
-- Planes por pedidos al mes
-- ============================================
-- El esquema de precios pasa de "qué funciones tenés" a "cuántos pedidos
-- entran". El motivo es que todos los planes corren el mismo sistema: recortarle
-- módulos al plan chico sería inventar una limitación para poder venderla.
--
-- El piso bajó de $26.900 a $15.000 porque desapareció el costo que lo sostenía.
-- Con el modelo viejo cada cliente tenía su propio proyecto de Supabase, unos
-- USD 10 de compute por mes. Hoy el sistema es multi-inquilino —cada tabla
-- lleva business_id y las policies aíslan por is_business_member()— y sumar un
-- negocio chico cuesta unos megabytes de filas.
--
-- `taller` va con setup 0: ese plan no lleva puesta a punto porque el catálogo
-- lo carga el cliente. La puesta a punto es trabajo nuestro, y si no lo hacemos
-- no hay nada que cobrar.

INSERT INTO sovare.plans (code, label, monthly, setup, currency, is_active, sort_order)
VALUES
  ('taller',  'Taller',        15000, 0,     'ARS', true, 1),
  ('negocio', 'Negocio',       32000, 95000, 'ARS', true, 2),
  ('cocina',  'Cocina grande', 56000, 95000, 'ARS', true, 3)
ON CONFLICT (code) DO UPDATE
  SET label = EXCLUDED.label,
      monthly = EXCLUDED.monthly,
      setup = EXCLUDED.setup,
      is_active = EXCLUDED.is_active,
      sort_order = EXCLUDED.sort_order;

UPDATE sovare.plans SET sort_order = 4 WHERE code = 'medida';

-- Los planes viejos se desactivan, no se borran: hay contrataciones que los
-- referencian y borrarlos dejaría esas filas apuntando a la nada.
UPDATE sovare.plans SET is_active = false WHERE code IN ('base', 'soporte');

-- ---------------------------------------------------------------------------
-- A qué negocio del producto corresponde cada ficha de cliente
--
-- Hasta ahora la ficha guardaba `supabase_ref`, que servía cuando cada cliente
-- tenía su propio proyecto. Con una sola base compartida lo que hace falta es
-- el id del negocio adentro de `public.businesses`.
-- ---------------------------------------------------------------------------

ALTER TABLE sovare.clients
  ADD COLUMN IF NOT EXISTS business_id UUID REFERENCES public.businesses(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_sovare_clients_business ON sovare.clients (business_id);

-- ---------------------------------------------------------------------------
-- Cuántos pedidos tuvo cada cliente en los últimos meses
--
-- SECURITY DEFINER porque tiene que leer `public.orders`, donde el admin de
-- SOVARE no es miembro de ningún negocio y RLS le devolvería cero. El permiso
-- se chequea adentro con sovare.is_admin(): sin eso, esta función le abriría el
-- volumen de ventas de todos los clientes a cualquiera con la anon key.
--
-- Los cancelados no cuentan. Un pedido que se cayó no es trabajo que el sistema
-- haya hecho, y cobrar por él sería cobrar por nada.
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION sovare.pedidos_por_mes(p_meses INTEGER DEFAULT 6)
RETURNS TABLE (
  client_id UUID,
  business_name TEXT,
  mes DATE,
  pedidos BIGINT
)
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = sovare, public
AS $$
  SELECT c.id,
         c.business_name,
         date_trunc('month', o.created_at)::date,
         count(*)
    FROM sovare.clients c
    JOIN public.orders o ON o.business_id = c.business_id
   WHERE sovare.is_admin()
     AND c.business_id IS NOT NULL
     AND o.status <> 'cancelled'
     AND o.created_at >= date_trunc('month', now()) - make_interval(months => greatest(p_meses, 1) - 1)
   GROUP BY c.id, c.business_name, date_trunc('month', o.created_at)
   ORDER BY 3 DESC, 4 DESC;
$$;

REVOKE EXECUTE ON FUNCTION sovare.pedidos_por_mes(INTEGER) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION sovare.pedidos_por_mes(INTEGER) TO authenticated;

-- ---------------------------------------------------------------------------
-- Qué plan le corresponde a un volumen de pedidos
--
-- Los cortes viven en la base y no en el código de la pantalla para que cambiar
-- un escalón no necesite un deploy, y para que el panel y la landing no puedan
-- quedar diciendo cosas distintas.
-- ---------------------------------------------------------------------------

ALTER TABLE sovare.plans
  ADD COLUMN IF NOT EXISTS max_orders INTEGER;

UPDATE sovare.plans SET max_orders = 30   WHERE code = 'taller';
UPDATE sovare.plans SET max_orders = 120  WHERE code = 'negocio';
UPDATE sovare.plans SET max_orders = 400  WHERE code = 'cocina';
UPDATE sovare.plans SET max_orders = NULL WHERE code = 'medida';
