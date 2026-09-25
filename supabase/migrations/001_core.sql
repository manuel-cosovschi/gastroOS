-- GastroOS — Núcleo multi-tenant
-- Todas las entidades del producto cuelgan de un `business`. Un usuario pertenece
-- a uno o más negocios a través de `business_members`, y las policies de RLS se
-- resuelven siempre contra esa pertenencia. Esto permite que el mismo deploy sirva
-- a varios negocios sin cambiar una línea de código de la aplicación.

-- ============================================
-- NEGOCIOS (tenant root)
-- ============================================
CREATE TABLE businesses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  industry TEXT,
  logo_url TEXT,
  phone TEXT,
  email TEXT,
  instagram TEXT,
  address TEXT,
  currency TEXT NOT NULL DEFAULT 'ARS',
  locale TEXT NOT NULL DEFAULT 'es-AR',
  timezone TEXT NOT NULL DEFAULT 'America/Argentina/Buenos_Aires',
  -- Catálogo público (tienda) habilitado para este negocio
  storefront_enabled BOOLEAN NOT NULL DEFAULT true,
  -- Contador de pedidos propio del negocio: cada negocio numera desde 1
  order_seq INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- ============================================
-- MIEMBROS DEL NEGOCIO
-- ============================================
CREATE TABLE business_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role TEXT NOT NULL DEFAULT 'owner' CHECK (role IN ('owner', 'manager', 'staff')),
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE (business_id, user_id)
);

CREATE INDEX idx_business_members_user ON business_members(user_id);

-- ============================================
-- HELPERS DE TENANT
-- ============================================
-- SECURITY DEFINER a propósito: se llaman desde dentro de las policies, así que
-- tienen que poder leer `business_members` sin que RLS se evalúe recursivamente.

CREATE OR REPLACE FUNCTION public.current_business_id()
RETURNS UUID
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT business_id
  FROM business_members
  WHERE user_id = auth.uid()
  ORDER BY created_at
  LIMIT 1;
$$;

CREATE OR REPLACE FUNCTION public.is_business_member(p_business_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM business_members
    WHERE user_id = auth.uid() AND business_id = p_business_id
  );
$$;

-- Negocio con tienda pública activa (lo usan las policies de lectura anónima)
CREATE OR REPLACE FUNCTION public.is_storefront_open(p_business_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM businesses
    WHERE id = p_business_id AND storefront_enabled = true
  );
$$;

-- ============================================
-- TRIGGER updated_at (compartido por todas las tablas)
-- ============================================
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_businesses_updated_at BEFORE UPDATE ON businesses
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ============================================
-- CONFIGURACIÓN OPERATIVA (clave/valor por negocio)
-- ============================================
-- Los datos de identidad del negocio viven en `businesses`. Acá van sólo
-- preferencias operativas que pueden crecer sin migrar el schema.
CREATE TABLE settings (
  business_id UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  key TEXT NOT NULL,
  value JSONB NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT now(),
  PRIMARY KEY (business_id, key)
);

-- ============================================
-- RLS
-- ============================================
ALTER TABLE businesses ENABLE ROW LEVEL SECURITY;
ALTER TABLE business_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "members read own business" ON businesses
  FOR SELECT USING (is_business_member(id));
CREATE POLICY "members update own business" ON businesses
  FOR UPDATE USING (is_business_member(id)) WITH CHECK (is_business_member(id));
-- La tienda pública necesita leer nombre, logo, moneda y contacto del negocio.
CREATE POLICY "public read storefront business" ON businesses
  FOR SELECT USING (storefront_enabled = true);

-- RLS filtra filas, no columnas: sin esto un anónimo que lee el negocio para
-- pintar la tienda se lleva también `order_seq`, que revela cuántos pedidos
-- lleva hecho el negocio. Los permisos por columna cierran eso; los miembros
-- autenticados conservan acceso completo.
REVOKE SELECT ON businesses FROM anon;
GRANT SELECT (
  id, name, slug, industry, logo_url,
  phone, email, instagram, address,
  currency, locale, timezone, storefront_enabled
) ON businesses TO anon;

CREATE POLICY "members read own memberships" ON business_members
  FOR SELECT USING (user_id = auth.uid());

CREATE POLICY "members manage settings" ON settings
  FOR ALL USING (is_business_member(business_id))
  WITH CHECK (is_business_member(business_id));
