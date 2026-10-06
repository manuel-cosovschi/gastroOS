-- GastroOS — El visitante anónimo no escribe en ninguna tabla
-- ============================================
-- Supabase le da DML completo a `anon` y a `authenticated` sobre todo lo que
-- aparece en `public`. Hoy eso no abre nada: cada tabla tiene RLS y todas las
-- policies de escritura exigen `is_business_member(...)`, que para un visitante
-- sin sesión es falso. Las escrituras de la tienda pública tampoco pasan por ahí:
-- van por `create_storefront_order`, que es SECURITY DEFINER.
--
-- Pero el permiso suelto es una trampa esperando: el día que alguien agregue una
-- policy permisiva para otra cosa, el visitante anónimo hereda la escritura sin
-- que nadie lo haya decidido. Es la misma razón por la que la migración 010 ya le
-- había sacado todo a `demo_sandboxes`; esto lo extiende al resto.
--
-- Las lecturas no se tocan: la tienda necesita leer productos, categorías,
-- combos y las columnas públicas del negocio. Y `authenticated` tampoco se toca:
-- ese es el rol del dueño en su panel, que sí escribe lo suyo.

DO $$
DECLARE t RECORD;
BEGIN
  FOR t IN
    SELECT c.relname
      FROM pg_class c
      JOIN pg_namespace n ON n.oid = c.relnamespace
     WHERE n.nspname = 'public' AND c.relkind = 'r'
  LOOP
    EXECUTE format('REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON public.%I FROM anon', t.relname);
  END LOOP;
END $$;

-- Y que las tablas que se creen de acá en adelante nazcan igual.
ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE INSERT, UPDATE, DELETE ON TABLES FROM anon;
