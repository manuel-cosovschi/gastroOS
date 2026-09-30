-- GastroOS — Las imágenes son de su negocio, no de cualquiera
-- ============================================
-- El bucket de imágenes se abrió con policies que sólo piden estar
-- autenticado: cualquier usuario con sesión podía borrar o pisar cualquier
-- archivo de cualquier negocio, con sólo conocer su ruta — y la ruta está en
-- la URL pública de la foto, a la vista en el catálogo.
--
-- Con la demo por visitante eso deja de ser sólo un riesgo entre clientes y
-- pasa a ser una forma segura de romper la demo para todos: la copia hereda
-- las `image_url` de la plantilla, así que el primero que le cambie la foto a
-- un producto borra el archivo de la plantilla y todos los demás quedan con la
-- imagen rota.
--
-- Las rutas ya se guardan como `<business_id>/<archivo>`, así que la
-- pertenencia se puede leer del nombre. Sólo faltaba exigirla.

/**
 * El negocio dueño de un archivo, leído de su ruta.
 *
 * Devuelve NULL si la primera carpeta no es un uuid, y `is_business_member`
 * de NULL es falso: un archivo fuera de la convención no es de nadie y no lo
 * puede tocar nadie, que es el lado seguro para equivocarse.
 */
CREATE OR REPLACE FUNCTION public.media_owner(p_name TEXT)
RETURNS UUID
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT CASE
    WHEN split_part(p_name, '/', 1)
         ~ '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$'
    THEN split_part(p_name, '/', 1)::uuid
  END;
$$;

GRANT EXECUTE ON FUNCTION public.media_owner(TEXT) TO anon, authenticated, service_role;

-- La lectura sigue siendo pública: son las fotos del catálogo, y para eso está
-- el bucket.
-- Lo que cambia es quién escribe: sólo un miembro del negocio dueño de la
-- carpeta.
DROP POLICY IF EXISTS "Members upload media" ON storage.objects;
CREATE POLICY "Members upload media"
  ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'gastroos-media'
    AND is_business_member(media_owner(name))
  );

DROP POLICY IF EXISTS "Members update media" ON storage.objects;
CREATE POLICY "Members update media"
  ON storage.objects FOR UPDATE
  USING (
    bucket_id = 'gastroos-media'
    AND is_business_member(media_owner(name))
  );

DROP POLICY IF EXISTS "Members delete media" ON storage.objects;
CREATE POLICY "Members delete media"
  ON storage.objects FOR DELETE
  USING (
    bucket_id = 'gastroos-media'
    AND is_business_member(media_owner(name))
  );
