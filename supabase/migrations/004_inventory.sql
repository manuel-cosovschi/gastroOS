-- GastroOS — Stock de insumos, recetas y movimientos

-- ============================================
-- INSUMOS / MATERIA PRIMA
-- ============================================
CREATE TABLE ingredients (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  -- Unidad libre (kg, g, l, ml, unidad, paquete, o la que invente el negocio)
  unit TEXT NOT NULL DEFAULT 'kg',
  category TEXT,
  stock_quantity DECIMAL(10,3) NOT NULL DEFAULT 0,
  min_stock_quantity DECIMAL(10,3) NOT NULL DEFAULT 0,
  cost_per_unit DECIMAL(10,2) NOT NULL DEFAULT 0,
  supplier TEXT,
  notes TEXT,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE (business_id, name)
);

-- ============================================
-- RECETAS (insumos por lote de producto)
-- ============================================
CREATE TABLE recipe_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  ingredient_id UUID NOT NULL REFERENCES ingredients(id) ON DELETE CASCADE,
  quantity_per_batch DECIMAL(10,3) NOT NULL CHECK (quantity_per_batch > 0),
  UNIQUE (product_id, ingredient_id)
);

-- ============================================
-- MOVIMIENTOS DE STOCK
-- ============================================
-- Toda variación de stock deja rastro acá: positivo = ingreso, negativo = egreso.
CREATE TABLE stock_movements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  reference_type TEXT NOT NULL CHECK (reference_type IN ('ingredient', 'product')),
  reference_id UUID NOT NULL,
  movement_type TEXT NOT NULL CHECK (movement_type IN (
    'purchase',               -- compra de insumo
    'production',             -- producción de producto terminado
    'order_deduction',        -- salida por pedido confirmado
    'production_consumption', -- consumo de insumo para producir
    'adjustment',             -- ajuste manual
    'waste'                   -- merma
  )),
  quantity DECIMAL(10,3) NOT NULL,
  unit_cost DECIMAL(10,2),
  order_id UUID REFERENCES orders(id) ON DELETE SET NULL,
  notes TEXT,
  created_by UUID,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- ============================================
-- ÍNDICES
-- ============================================
CREATE INDEX idx_ingredients_business ON ingredients(business_id);
CREATE INDEX idx_ingredients_active ON ingredients(business_id, is_active);
CREATE INDEX idx_recipe_items_product ON recipe_items(product_id);
CREATE INDEX idx_recipe_items_ingredient ON recipe_items(ingredient_id);
CREATE INDEX idx_stock_movements_business ON stock_movements(business_id);
CREATE INDEX idx_stock_movements_ref ON stock_movements(reference_type, reference_id);
CREATE INDEX idx_stock_movements_created ON stock_movements(business_id, created_at DESC);

-- ============================================
-- TRIGGERS
-- ============================================
CREATE TRIGGER trg_ingredients_updated_at BEFORE UPDATE ON ingredients
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ============================================
-- RLS
-- ============================================
ALTER TABLE ingredients ENABLE ROW LEVEL SECURITY;
ALTER TABLE recipe_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE stock_movements ENABLE ROW LEVEL SECURITY;

CREATE POLICY "members manage ingredients" ON ingredients
  FOR ALL USING (is_business_member(business_id))
  WITH CHECK (is_business_member(business_id));

CREATE POLICY "members manage stock movements" ON stock_movements
  FOR ALL USING (is_business_member(business_id))
  WITH CHECK (is_business_member(business_id));

CREATE POLICY "members manage recipe items" ON recipe_items
  FOR ALL USING (
    EXISTS (SELECT 1 FROM products p WHERE p.id = product_id AND is_business_member(p.business_id))
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM products p WHERE p.id = product_id AND is_business_member(p.business_id))
  );
