-- GastroOS — La dirección de una tienda no la cambia quien la usa
-- ============================================
-- Cada tienda vive en tunegocio.gastroos.shop, y ese `tunegocio` es la columna
-- `slug` del negocio. Desde que el subdominio decide qué tienda se muestra, el
-- slug dejó de ser un dato más: es la dirección pública del negocio.
--
-- La política de RLS deja a los miembros de un negocio actualizarlo entero, y eso
-- incluye el slug. Sin esto, un cliente podría cambiarlo con su propia sesión (la
-- API de Supabase no pasa por la aplicación) y quedarse con la dirección que otro
-- cliente quería, o con un nombre que parezca oficial. Cambiarlo es una decisión
-- nuestra, y se hace con la service role o desde el SQL.

CREATE OR REPLACE FUNCTION public.businesses_slug_inmutable()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  -- `authenticated` y `anon` son los roles con los que PostgREST ejecuta lo que
  -- pide un navegador. La service role, el SQL directo y las funciones
  -- SECURITY DEFINER corren con otro rol y siguen pudiendo.
  IF NEW.slug IS DISTINCT FROM OLD.slug AND current_user IN ('authenticated', 'anon') THEN
    RAISE EXCEPTION 'La dirección de la tienda no se puede cambiar desde acá.' USING ERRCODE = 'P0001';
  END IF;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE TRIGGER trg_businesses_slug_inmutable
  BEFORE UPDATE OF slug ON public.businesses
  FOR EACH ROW EXECUTE FUNCTION public.businesses_slug_inmutable();
