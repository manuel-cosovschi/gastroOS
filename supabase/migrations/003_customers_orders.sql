-- GastroOS — Clientes (CRM) y pedidos

-- ============================================
-- CLIENTES
-- ============================================
CREATE TABLE customers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  first_name TEXT NOT NULL,
  last_name TEXT,
  phone TEXT,
  email TEXT,
  instagram TEXT,
  address TEXT,
  notes TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Nombre completo calculado: se usa para buscar y ordenar sin concatenar en cada query
ALTER TABLE customers
  ADD COLUMN full_name TEXT GENERATED ALWAYS AS (
    TRIM(first_name || ' ' || COALESCE(last_name, ''))
  ) STORED;

-- ============================================
-- PEDIDOS
-- ============================================
CREATE TABLE orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  -- Numeración propia por negocio (la asigna un trigger)
  order_number INTEGER NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'confirmed', 'in_preparation', 'ready', 'delivered', 'cancelled')),

  -- Cliente: referencia al CRM + snapshot de contacto al momento del pedido
  customer_id UUID REFERENCES customers(id) ON DELETE SET NULL,
  contact_name TEXT NOT NULL,
  phone TEXT,
  email TEXT,

  -- Entrega
  delivery_method TEXT NOT NULL DEFAULT 'pickup'
    CHECK (delivery_method IN ('pickup', 'delivery')),
  address TEXT,
  city TEXT,
  delivery_date DATE NOT NULL,
  delivery_time TIME,

  -- Dinero
  subtotal DECIMAL(10,2) NOT NULL DEFAULT 0,
  production_cost DECIMAL(10,2),
  deposit_amount DECIMAL(10,2) NOT NULL DEFAULT 0 CHECK (deposit_amount >= 0),
  payment_method TEXT CHECK (payment_method IN ('cash', 'transfer', 'card', 'mercadopago', 'other')),

  -- Extras
  channel TEXT NOT NULL DEFAULT 'manual' CHECK (channel IN ('manual', 'storefront')),
  observations TEXT,
  admin_notes TEXT,
  requires_invoice BOOLEAN DEFAULT false,
  invoice_data JSONB,

  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE (business_id, order_number)
);

-- Saldo pendiente: total menos seña. Calculado para no desincronizarse nunca.
ALTER TABLE orders
  ADD COLUMN balance_due DECIMAL(10,2) GENERATED ALWAYS AS (subtotal - deposit_amount) STORED;

-- Numeración por negocio. El UPDATE toma un row lock sobre el negocio, así que
-- dos pedidos simultáneos no pueden recibir el mismo número.
CREATE OR REPLACE FUNCTION assign_order_number()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.order_number IS NULL OR NEW.order_number = 0 THEN
    UPDATE businesses
      SET order_seq = order_seq + 1
      WHERE id = NEW.business_id
      RETURNING order_seq INTO NEW.order_number;
  END IF;
  RETURN NEW;
END;
$$;

ALTER TABLE orders ALTER COLUMN order_number DROP NOT NULL;

CREATE TRIGGER trg_orders_number BEFORE INSERT ON orders
  FOR EACH ROW EXECUTE FUNCTION assign_order_number();

-- ============================================
-- ITEMS DEL PEDIDO (snapshot de precio y costo)
-- ============================================
CREATE TABLE order_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  product_id UUID REFERENCES products(id) ON DELETE SET NULL,
  package_id UUID REFERENCES packages(id) ON DELETE SET NULL,
  item_name TEXT NOT NULL,
  unit_price DECIMAL(10,2) NOT NULL,
  quantity INTEGER NOT NULL CHECK (quantity > 0),
  subtotal DECIMAL(10,2) NOT NULL,
  unit_cost DECIMAL(10,2),
  cost_subtotal DECIMAL(10,2),
  notes TEXT,
  -- Una línea apunta a un producto o a un combo, nunca a los dos. Puede no
  -- apuntar a ninguno: si se borra un producto del catálogo las FKs quedan en
  -- NULL y la línea sobrevive con su nombre y precio congelados, que es lo que
  -- hace que el historial de pedidos sea historial y no una foto que se pudre.
  CHECK (product_id IS NULL OR package_id IS NULL)
);

-- ============================================
-- HISTORIAL DE ESTADOS
-- ============================================
CREATE TABLE order_status_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  from_status TEXT,
  to_status TEXT NOT NULL,
  changed_by UUID,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- ============================================
-- ÍNDICES
-- ============================================
CREATE INDEX idx_customers_business ON customers(business_id);
CREATE INDEX idx_customers_name ON customers(business_id, full_name);
CREATE INDEX idx_orders_business ON orders(business_id);
CREATE INDEX idx_orders_status ON orders(business_id, status);
CREATE INDEX idx_orders_delivery_date ON orders(business_id, delivery_date);
CREATE INDEX idx_orders_created_at ON orders(business_id, created_at DESC);
CREATE INDEX idx_orders_customer ON orders(customer_id);
CREATE INDEX idx_order_items_order ON order_items(order_id);
CREATE INDEX idx_order_status_history_order ON order_status_history(order_id);

-- ============================================
-- TRIGGERS
-- ============================================
CREATE TRIGGER trg_customers_updated_at BEFORE UPDATE ON customers
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER trg_orders_updated_at BEFORE UPDATE ON orders
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ============================================
-- RLS
-- ============================================
ALTER TABLE customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE order_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE order_status_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY "members manage customers" ON customers
  FOR ALL USING (is_business_member(business_id))
  WITH CHECK (is_business_member(business_id));

CREATE POLICY "members manage orders" ON orders
  FOR ALL USING (is_business_member(business_id))
  WITH CHECK (is_business_member(business_id));

CREATE POLICY "members manage order items" ON order_items
  FOR ALL USING (
    EXISTS (SELECT 1 FROM orders o WHERE o.id = order_id AND is_business_member(o.business_id))
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM orders o WHERE o.id = order_id AND is_business_member(o.business_id))
  );

CREATE POLICY "members manage status history" ON order_status_history
  FOR ALL USING (
    EXISTS (SELECT 1 FROM orders o WHERE o.id = order_id AND is_business_member(o.business_id))
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM orders o WHERE o.id = order_id AND is_business_member(o.business_id))
  );

-- La tienda pública puede crear pedidos (nunca leerlos ni modificarlos).
-- El seguimiento por número de pedido se resuelve en el servidor, no vía RLS.
CREATE POLICY "storefront can create orders" ON orders
  FOR INSERT WITH CHECK (is_storefront_open(business_id) AND channel = 'storefront');
CREATE POLICY "storefront can create order items" ON order_items
  FOR INSERT WITH CHECK (
    EXISTS (SELECT 1 FROM orders o WHERE o.id = order_id AND is_storefront_open(o.business_id))
  );
CREATE POLICY "storefront can create status history" ON order_status_history
  FOR INSERT WITH CHECK (
    EXISTS (SELECT 1 FROM orders o WHERE o.id = order_id AND is_storefront_open(o.business_id))
  );
