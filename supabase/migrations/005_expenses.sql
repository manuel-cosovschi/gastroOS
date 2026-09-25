-- GastroOS — Gastos del negocio

-- ============================================
-- CATEGORÍAS DE GASTO
-- ============================================
-- Editables por el negocio. El seed carga un set inicial razonable, pero
-- nada en el código depende de que existan categorías específicas.
CREATE TABLE expense_categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  color TEXT NOT NULL DEFAULT '#64748b',
  sort_order INTEGER DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE (business_id, name)
);

-- ============================================
-- GASTOS
-- ============================================
CREATE TABLE expenses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  category_id UUID REFERENCES expense_categories(id) ON DELETE SET NULL,
  description TEXT NOT NULL,
  amount DECIMAL(10,2) NOT NULL CHECK (amount > 0),
  expense_date DATE NOT NULL DEFAULT CURRENT_DATE,
  supplier TEXT,
  payment_method TEXT CHECK (payment_method IN ('cash', 'transfer', 'card', 'mercadopago', 'other')),
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_expense_categories_business ON expense_categories(business_id);
CREATE INDEX idx_expenses_business ON expenses(business_id);
CREATE INDEX idx_expenses_date ON expenses(business_id, expense_date DESC);
CREATE INDEX idx_expenses_category ON expenses(category_id);

CREATE TRIGGER trg_expenses_updated_at BEFORE UPDATE ON expenses
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ============================================
-- RLS
-- ============================================
ALTER TABLE expense_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE expenses ENABLE ROW LEVEL SECURITY;

CREATE POLICY "members manage expense categories" ON expense_categories
  FOR ALL USING (is_business_member(business_id))
  WITH CHECK (is_business_member(business_id));

CREATE POLICY "members manage expenses" ON expenses
  FOR ALL USING (is_business_member(business_id))
  WITH CHECK (is_business_member(business_id));
