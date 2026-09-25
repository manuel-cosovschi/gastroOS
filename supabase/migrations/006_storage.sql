-- GastroOS — Bucket de imágenes (productos, combos, logo del negocio)

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'gastroos-media',
  'gastroos-media',
  true,
  5242880, -- 5 MB
  ARRAY['image/jpeg', 'image/png', 'image/webp']
)
ON CONFLICT (id) DO NOTHING;

-- Bucket público: cualquiera puede ver las imágenes del catálogo
CREATE POLICY "Public read media"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'gastroos-media');

-- Sólo usuarios autenticados escriben
CREATE POLICY "Members upload media"
  ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'gastroos-media' AND auth.role() = 'authenticated');

CREATE POLICY "Members update media"
  ON storage.objects FOR UPDATE
  USING (bucket_id = 'gastroos-media' AND auth.role() = 'authenticated');

CREATE POLICY "Members delete media"
  ON storage.objects FOR DELETE
  USING (bucket_id = 'gastroos-media' AND auth.role() = 'authenticated');
