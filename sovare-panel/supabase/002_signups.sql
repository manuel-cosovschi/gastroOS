-- ============================================
-- Panel interno de SOVARE — contrataciones desde la página
-- ============================================
-- Cuando alguien elige un plan en la home de GastroOS, deja sus datos,
-- transfiere y sube el comprobante. Una IA lo lee, y si cierra con lo que
-- esperábamos cobrar, la contratación queda aprobada sola.
--
-- Nada de esto es accesible con la anon key. Las escrituras del visitante las
-- hace el servidor de la landing con la service role, que es la que puede
-- saltear RLS; las policies de acá abajo son para el panel. El motivo: si el
-- visitante pudiera escribir la tabla, podría escribir también el veredicto de
-- la IA, y aprobarse el pago a sí mismo.

-- ============================================
-- Planes
-- ============================================
-- Los precios viven acá y no en el código de la landing porque son el número
-- que se le pide transferir a alguien: tiene que haber uno solo, y tiene que
-- poder cambiarse sin desplegar. La página los lee de esta tabla; lo que queda
-- en `marketing.ts` son las palabras.
CREATE TABLE IF NOT EXISTS sovare.plans (
  code       TEXT PRIMARY KEY,
  label      TEXT NOT NULL,
  monthly    NUMERIC(12,2) NOT NULL,
  setup      NUMERIC(12,2) NOT NULL DEFAULT 0,
  currency   TEXT NOT NULL DEFAULT 'ARS',
  sort_order SMALLINT NOT NULL DEFAULT 0,
  is_active  BOOLEAN NOT NULL DEFAULT true,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

INSERT INTO sovare.plans (code, label, monthly, setup, sort_order) VALUES
  ('base',    'Base',         26900, 95000, 1),
  ('soporte', 'Con soporte',  46900, 95000, 2),
  ('medida',  'A medida',     89000, 95000, 3)
ON CONFLICT (code) DO NOTHING;

ALTER TABLE sovare.plans ENABLE ROW LEVEL SECURITY;

CREATE POLICY "admins manage plans" ON sovare.plans
  FOR ALL USING (sovare.is_admin()) WITH CHECK (sovare.is_admin());

-- ============================================
-- Contrataciones
-- ============================================
CREATE TYPE sovare.signup_status AS ENUM (
  'esperando_comprobante',  -- dejó los datos, todavía no subió nada
  'en_revision',            -- subió el comprobante y la IA no se animó a decidir
  'aprobado',
  'rechazado'
);

-- Qué dijo la IA del comprobante, separado del estado de la contratación: un
-- comprobante puede leerse como válido y la contratación rechazarse igual a
-- mano, y conviene poder mirar las dos cosas por separado después.
CREATE TYPE sovare.ai_verdict AS ENUM ('valido', 'dudoso', 'invalido');

CREATE TABLE sovare.signups (
  id    UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Con este token la persona vuelve a su contratación (a subir el comprobante,
  -- a ver en qué quedó, a completar el alta) sin tener que crearse una cuenta.
  -- Es lo único que la identifica, así que va aleatorio y largo.
  token TEXT NOT NULL UNIQUE DEFAULT encode(gen_random_bytes(24), 'hex'),

  business_name TEXT NOT NULL,
  contact_name  TEXT,
  email         TEXT NOT NULL,
  whatsapp      TEXT,
  city          TEXT,
  industry      TEXT,

  plan           TEXT NOT NULL REFERENCES sovare.plans(code),
  includes_setup BOOLEAN NOT NULL DEFAULT true,
  -- Lo que se le pidió transferir, congelado: si mañana cambia el precio del
  -- plan, esta contratación sigue valiendo lo que se acordó.
  amount         NUMERIC(12,2) NOT NULL,
  currency       TEXT NOT NULL DEFAULT 'ARS',

  status sovare.signup_status NOT NULL DEFAULT 'esperando_comprobante',

  receipt_path        TEXT,
  receipt_uploaded_at TIMESTAMPTZ,

  ai_verdict    sovare.ai_verdict,
  ai_confidence NUMERIC(4,3),
  ai_summary    TEXT,
  ai_extracted  JSONB,
  ai_checked_at TIMESTAMPTZ,

  -- Quién decidió, si decidió una persona. En una aprobación automática queda
  -- en NULL y se distingue por `ai_checked_at`.
  decided_by     UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  decided_at     TIMESTAMPTZ,
  decision_notes TEXT,

  -- La ficha de cliente que salió de esta contratación, cuando se convierte.
  client_id UUID REFERENCES sovare.clients(id) ON DELETE SET NULL,

  -- Las respuestas del alta. Va en JSONB porque la lista de lo que hace falta
  -- para montar una instancia va a cambiar más rápido que esta tabla.
  onboarding    JSONB,
  onboarding_at TIMESTAMPTZ,

  notified_at TIMESTAMPTZ,

  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX signups_status_idx  ON sovare.signups (status, created_at DESC);
CREATE INDEX signups_created_idx ON sovare.signups (created_at DESC);

CREATE TRIGGER signups_touch
  BEFORE UPDATE ON sovare.signups
  FOR EACH ROW EXECUTE FUNCTION sovare.touch_updated_at();

ALTER TABLE sovare.signups ENABLE ROW LEVEL SECURITY;

CREATE POLICY "admins manage signups" ON sovare.signups
  FOR ALL USING (sovare.is_admin()) WITH CHECK (sovare.is_admin());

-- ============================================
-- Comprobantes
-- ============================================
-- Bucket privado: un comprobante de transferencia tiene el nombre y el banco de
-- una persona. Lo sube el servidor con la service role y lo mira el panel con
-- una URL firmada de vida corta; no hay lectura pública de ningún tipo.
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'sovare-comprobantes',
  'sovare-comprobantes',
  false,
  8388608, -- 8 MB
  ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'application/pdf']
)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "admins read comprobantes"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'sovare-comprobantes' AND sovare.is_admin());

CREATE POLICY "admins delete comprobantes"
  ON storage.objects FOR DELETE
  USING (bucket_id = 'sovare-comprobantes' AND sovare.is_admin());

GRANT SELECT, INSERT, UPDATE, DELETE ON sovare.signups TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON sovare.plans   TO authenticated;

-- ============================================
-- Archivos del alta
-- ============================================
-- El logo que sube el cliente al completar el formulario de alta. Bucket
-- aparte del de comprobantes: son cosas distintas y conviene poder borrar los
-- comprobantes viejos sin llevarse los logos puestos.
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'sovare-altas',
  'sovare-altas',
  false,
  8388608, -- 8 MB
  ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/svg+xml', 'application/pdf']
)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "admins read altas"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'sovare-altas' AND sovare.is_admin());

CREATE POLICY "admins delete altas"
  ON storage.objects FOR DELETE
  USING (bucket_id = 'sovare-altas' AND sovare.is_admin());
