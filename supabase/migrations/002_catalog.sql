-- GastroOS — Catálogo: categorías, productos y combos

-- ============================================
-- CATEGORÍAS
-- ============================================
-- No hay categorías fijas en el código: cada negocio crea las suyas.
CREATE TABLE categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  slug TEXT NOT NULL,
  description TEXT,
  sort_order INTEGER DEFAULT 0,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE (business_id, slug),
  UNIQUE (business_id, name)
);

-- ============================================
-- PRODUCTOS
-- ============================================
CREATE TABLE products (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  category_id UUID REFERENCES categories(id) ON DELETE SET NULL,
  name TEXT NOT NULL,
  slug TEXT NOT NULL,
  short_description TEXT,
  long_description TEXT,
  ingredients TEXT,
  price DECIMAL(10,2) NOT NULL CHECK (price > 0),
  -- Costo cargado a mano. Si está en NULL se calcula desde la receta.
  cost_override DECIMAL(10,2),
  image_url TEXT,
  gallery_urls TEXT[] DEFAULT '{}',
  is_active BOOLEAN DEFAULT true,
  sale_unit TEXT DEFAULT 'unidad',
  min_quantity INTEGER DEFAULT 1,
  min_advance_hours INTEGER,
  -- Stock de producto terminado
  stock_quantity INTEGER NOT NULL DEFAULT 0,
  min_stock_quantity INTEGER NOT NULL DEFAULT 0,
  -- Cuántas unidades salen de un lote de producción (define el costo unitario)
  batch_size INTEGER NOT NULL DEFAULT 1 CHECK (batch_size > 0),
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE (business_id, slug)
);

-- ============================================
-- COMBOS / PAQUETES
-- ============================================
CREATE TABLE packages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  slug TEXT NOT NULL,
  description TEXT,
  image_url TEXT,
  price DECIMAL(10,2) NOT NULL CHECK (price > 0),
  is_editable BOOLEAN DEFAULT false,
  is_active BOOLEAN DEFAULT true,
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE (business_id, slug)
);

CREATE TABLE package_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  package_id UUID NOT NULL REFERENCES packages(id) ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  quantity INTEGER NOT NULL DEFAULT 1 CHECK (quantity > 0),
  UNIQUE (package_id, product_id)
);

-- ============================================
-- ÍNDICES
-- ============================================
CREATE INDEX idx_categories_business ON categories(business_id);
CREATE INDEX idx_products_business ON products(business_id);
CREATE INDEX idx_products_category ON products(category_id);
CREATE INDEX idx_products_active ON products(business_id, is_active);
CREATE INDEX idx_packages_business ON packages(business_id);
CREATE INDEX idx_packages_active ON packages(business_id, is_active);
CREATE INDEX idx_package_items_package ON package_items(package_id);

-- ============================================
-- TRIGGERS
-- ============================================
CREATE TRIGGER trg_categories_updated_at BEFORE UPDATE ON categories
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER trg_products_updated_at BEFORE UPDATE ON products
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER trg_packages_updated_at BEFORE UPDATE ON packages
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ============================================
-- RLS
-- ============================================
ALTER TABLE categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE products ENABLE ROW LEVEL SECURITY;
ALTER TABLE packages ENABLE ROW LEVEL SECURITY;
ALTER TABLE package_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "members manage categories" ON categories
  FOR ALL USING (is_business_member(business_id))
  WITH CHECK (is_business_member(business_id));
CREATE POLICY "members manage products" ON products
  FOR ALL USING (is_business_member(business_id))
  WITH CHECK (is_business_member(business_id));
CREATE POLICY "members manage packages" ON packages
  FOR ALL USING (is_business_member(business_id))
  WITH CHECK (is_business_member(business_id));
CREATE POLICY "members manage package items" ON package_items
  FOR ALL USING (
    EXISTS (SELECT 1 FROM packages p WHERE p.id = package_id AND is_business_member(p.business_id))
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM packages p WHERE p.id = package_id AND is_business_member(p.business_id))
  );

-- Lectura pública sólo de lo activo y sólo si la tienda del negocio está abierta
CREATE POLICY "public read active categories" ON categories
  FOR SELECT USING (is_active = true AND is_storefront_open(business_id));
CREATE POLICY "public read active products" ON products
  FOR SELECT USING (is_active = true AND is_storefront_open(business_id));
CREATE POLICY "public read active packages" ON packages
  FOR SELECT USING (is_active = true AND is_storefront_open(business_id));
CREATE POLICY "public read package items" ON package_items
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM packages p WHERE p.id = package_id AND p.is_active AND is_storefront_open(p.business_id))
  );
