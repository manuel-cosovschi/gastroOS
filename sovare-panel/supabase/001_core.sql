-- ============================================
-- Panel interno de SOVARE — esquema
-- ============================================
-- Aplicado sobre el mismo proyecto de Supabase que hospeda la demo de GastroOS.
-- Va en un esquema aparte, no en `public`, para que quede explícito qué es
-- producto y qué es negocio propio.
--
-- Todo el acceso pasa por sovare.is_admin(). El detalle que lo hace necesario:
-- la anon key de este proyecto es pública (viaja en la landing) y el usuario de
-- la demo es un usuario autenticado más. Una policy que dijera "authenticated"
-- le abriría la facturación de SOVARE a cualquiera que entre a la demo. Por eso
-- es una lista blanca de user_ids, no un rol.
--
-- Después de correrlo hay que exponer el esquema a la API:
--   ALTER ROLE authenticator SET pgrst.db_schemas = 'public, graphql_public, sovare';
--   NOTIFY pgrst, 'reload config';
--   NOTIFY pgrst, 'reload schema';

CREATE SCHEMA IF NOT EXISTS sovare;

CREATE TABLE sovare.admins (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- SECURITY DEFINER a propósito: se llama desde dentro de las policies y tiene
-- que poder leer sovare.admins sin que RLS se evalúe en bucle.
CREATE OR REPLACE FUNCTION sovare.is_admin()
RETURNS BOOLEAN
LANGUAGE sql SECURITY DEFINER STABLE
SET search_path = sovare, public
AS $$
  SELECT EXISTS (SELECT 1 FROM sovare.admins WHERE user_id = auth.uid());
$$;

-- ============================================
-- Clientes
-- ============================================
-- El estado es el embudo entero: un prospecto y un cliente activo son la misma
-- ficha en distinto momento, y partirlos en dos tablas obligaría a copiar datos
-- cuando cierra.
CREATE TYPE sovare.client_status AS ENUM (
  'prospecto', 'implementacion', 'activo', 'pausado', 'baja'
);

CREATE TABLE sovare.clients (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  business_name TEXT NOT NULL,
  contact_name TEXT,
  whatsapp TEXT,
  email TEXT,
  industry TEXT,
  city TEXT,

  status sovare.client_status NOT NULL DEFAULT 'prospecto',
  source TEXT,
  first_contact_at DATE NOT NULL DEFAULT CURRENT_DATE,
  started_at DATE,
  churned_at DATE,

  panel_url TEXT,
  storefront_url TEXT,
  supabase_ref TEXT,
  vercel_project TEXT,
  repo_url TEXT,

  plan TEXT,
  monthly_amount NUMERIC(12,2),
  setup_amount NUMERIC(12,2),
  currency TEXT NOT NULL DEFAULT 'ARS',
  billing_day SMALLINT CHECK (billing_day BETWEEN 1 AND 28),

  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_sovare_clients_status ON sovare.clients(status);

-- ============================================
-- Cobros
-- ============================================
CREATE TYPE sovare.payment_status AS ENUM ('pendiente', 'pagado', 'vencido', 'anulado');

CREATE TABLE sovare.payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id UUID NOT NULL REFERENCES sovare.clients(id) ON DELETE CASCADE,

  -- Primer día del mes que cubre. Guardarlo aparte del vencimiento permite
  -- cobrar tarde sin perder a qué mes corresponde.
  period DATE NOT NULL,
  concept TEXT NOT NULL DEFAULT 'Mensualidad',
  amount NUMERIC(12,2) NOT NULL CHECK (amount >= 0),
  currency TEXT NOT NULL DEFAULT 'ARS',

  due_date DATE NOT NULL,
  paid_at DATE,
  status sovare.payment_status NOT NULL DEFAULT 'pendiente',
  method TEXT,
  notes TEXT,

  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  -- Lo que hace idempotente a "generar los cobros del mes".
  UNIQUE (client_id, period, concept)
);

CREATE INDEX idx_sovare_payments_client ON sovare.payments(client_id);
CREATE INDEX idx_sovare_payments_due ON sovare.payments(due_date) WHERE status <> 'pagado';

-- ============================================
-- Seguimiento
-- ============================================
CREATE TABLE sovare.activities (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id UUID NOT NULL REFERENCES sovare.clients(id) ON DELETE CASCADE,
  happened_at DATE NOT NULL DEFAULT CURRENT_DATE,
  kind TEXT NOT NULL DEFAULT 'nota',
  body TEXT NOT NULL,
  next_step TEXT,
  next_step_at DATE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_sovare_activities_client ON sovare.activities(client_id, happened_at DESC);
CREATE INDEX idx_sovare_activities_next ON sovare.activities(next_step_at) WHERE next_step_at IS NOT NULL;

-- ============================================
-- updated_at
-- ============================================
CREATE OR REPLACE FUNCTION sovare.touch_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_sovare_clients_touch
  BEFORE UPDATE ON sovare.clients
  FOR EACH ROW EXECUTE FUNCTION sovare.touch_updated_at();

-- ============================================
-- RLS
-- ============================================
ALTER TABLE sovare.admins     ENABLE ROW LEVEL SECURITY;
ALTER TABLE sovare.clients    ENABLE ROW LEVEL SECURITY;
ALTER TABLE sovare.payments   ENABLE ROW LEVEL SECURITY;
ALTER TABLE sovare.activities ENABLE ROW LEVEL SECURITY;

CREATE POLICY "admins ven la lista" ON sovare.admins
  FOR SELECT TO authenticated USING (sovare.is_admin());

CREATE POLICY "admins manejan clientes" ON sovare.clients
  FOR ALL TO authenticated USING (sovare.is_admin()) WITH CHECK (sovare.is_admin());

CREATE POLICY "admins manejan cobros" ON sovare.payments
  FOR ALL TO authenticated USING (sovare.is_admin()) WITH CHECK (sovare.is_admin());

CREATE POLICY "admins manejan seguimiento" ON sovare.activities
  FOR ALL TO authenticated USING (sovare.is_admin()) WITH CHECK (sovare.is_admin());

-- ============================================
-- Permisos
-- ============================================
-- anon no toca nada de este esquema: ni siquiera el USAGE.
GRANT USAGE ON SCHEMA sovare TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA sovare TO authenticated;
GRANT EXECUTE ON FUNCTION sovare.is_admin() TO authenticated;
