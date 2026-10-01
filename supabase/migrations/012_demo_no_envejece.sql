-- GastroOS — La demo no puede envejecer
-- ============================================
-- Los datos de la plantilla se sembraron una vez y las fechas quedaron fijas.
-- A los dos meses, los 42 pedidos de ejemplo estaban todos en el pasado: uno
-- solo de hoy en adelante. El calendario vacío, "Próximos" con un renglón y el
-- dashboard en cero — en la única pantalla cuyo trabajo es convencer a alguien
-- que nunca vio el sistema.
--
-- La migración 010 ya corría las fechas al sacar cada copia, pero con un ancla
-- de dos días: dejaba el pedido más lejano pasado mañana y todo lo demás
-- atrás. Alcanzaba para que la demo no se viera detenida en el pasado, no para
-- que se viera viva.
--
-- Acá se arreglan las dos puntas: el ancla pasa a dos semanas —así las últimas
-- dos semanas del conjunto quedan por delante, que es lo que llena el
-- calendario y la lista de próximos— y la plantilla misma se puede volver a
-- correr cuando haga falta, en vez de envejecer para siempre.

/**
 * Días a correr para que el pedido más lejano caiga a dos semanas de hoy.
 *
 * Una sola definición para los dos usos: el re-anclado de la plantilla y la
 * copia de cada visitante. Si cada uno usara su propio cálculo —como pasaba
 * antes— correr la plantilla hacia adelante movería las copias hacia atrás.
 */
CREATE OR REPLACE FUNCTION public.demo_shift_days(p_business_id UUID)
RETURNS INTEGER
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE((CURRENT_DATE + 14) - max(delivery_date), 0)
    FROM orders WHERE business_id = p_business_id;
$$;

/**
 * Corre la plantilla hasta hoy.
 *
 * Todo se mueve la misma cantidad de días, así que las relaciones se mantienen:
 * un pedido se sigue creando antes de entregarse y un gasto sigue cayendo el
 * día que caía. Se puede volver a ejecutar cuando se quiera; si ya está en su
 * lugar, el corrimiento da cero y no toca nada.
 *
 *   SELECT reanchor_demo_template();
 */
CREATE OR REPLACE FUNCTION public.reanchor_demo_template()
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_plantilla UUID;
  v_dias      INTEGER;
BEGIN
  SELECT id INTO v_plantilla FROM businesses WHERE is_demo_template;
  IF v_plantilla IS NULL THEN
    RAISE EXCEPTION 'No hay ningún negocio marcado como plantilla de la demo.';
  END IF;

  v_dias := demo_shift_days(v_plantilla);
  IF v_dias = 0 THEN RETURN 0; END IF;

  UPDATE orders
     SET delivery_date = delivery_date + v_dias,
         created_at    = LEAST(created_at + make_interval(days => v_dias), now()),
         updated_at    = LEAST(updated_at + make_interval(days => v_dias), now())
   WHERE business_id = v_plantilla;

  UPDATE order_status_history h
     SET created_at = LEAST(h.created_at + make_interval(days => v_dias), now())
    FROM orders o
   WHERE o.id = h.order_id AND o.business_id = v_plantilla;

  UPDATE expenses
     SET expense_date = expense_date + v_dias,
         created_at   = LEAST(created_at + make_interval(days => v_dias), now()),
         updated_at   = LEAST(updated_at + make_interval(days => v_dias), now())
   WHERE business_id = v_plantilla;

  UPDATE customers
     SET created_at = LEAST(created_at + make_interval(days => v_dias), now()),
         updated_at = LEAST(updated_at + make_interval(days => v_dias), now())
   WHERE business_id = v_plantilla;

  UPDATE stock_movements
     SET created_at = LEAST(created_at + make_interval(days => v_dias), now())
   WHERE business_id = v_plantilla;

  RETURN v_dias;
END;
$$;

REVOKE ALL ON FUNCTION public.reanchor_demo_template() FROM public, anon, authenticated;
REVOKE ALL ON FUNCTION public.demo_shift_days(UUID)    FROM public, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.reanchor_demo_template() TO service_role;
GRANT EXECUTE ON FUNCTION public.demo_shift_days(UUID)    TO service_role;

-- ============================================
-- La copia usa el mismo cálculo
-- ============================================
-- Único cambio sobre la función de la migración 010: el corrimiento sale de
-- `demo_shift_days` en vez de estar escrito adentro con otro ancla. El cuerpo
-- se repite entero porque Postgres no sabe reemplazar una línea de una
-- función; lo que cambia son las tres líneas marcadas.
CREATE OR REPLACE FUNCTION public.create_demo_sandbox(
  p_user_id UUID,
  p_ttl     INTERVAL DEFAULT INTERVAL '3 days'
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $fn$
DECLARE
  v_plantilla UUID;
  v_nuevo     UUID;
  v_dias      INTEGER;
BEGIN
  SELECT id INTO v_plantilla FROM businesses WHERE is_demo_template LIMIT 1;
  IF v_plantilla IS NULL THEN
    RAISE EXCEPTION 'No hay ningún negocio marcado como plantilla de la demo.';
  END IF;

  -- ↓ lo único que cambia respecto de 010
  v_dias := demo_shift_days(v_plantilla);

  INSERT INTO businesses (
    name, slug, industry, logo_url, phone, email, instagram, address,
    currency, locale, timezone, storefront_enabled, order_seq
  )
  SELECT name,
         'demo-' || substr(replace(gen_random_uuid()::text, '-', ''), 1, 16),
         industry, logo_url, phone, email, instagram, address,
         currency, locale, timezone, storefront_enabled, order_seq
    FROM businesses WHERE id = v_plantilla
  RETURNING id INTO v_nuevo;

  INSERT INTO demo_sandboxes (business_id, user_id, expires_at)
  VALUES (v_nuevo, p_user_id, now() + p_ttl);

  INSERT INTO categories (id, business_id, name, slug, description, sort_order, is_active, created_at, updated_at)
  SELECT demo_copy_id(v_nuevo, id), v_nuevo, name, slug, description, sort_order, is_active,
         LEAST(created_at + make_interval(days => v_dias), now()),
         LEAST(updated_at + make_interval(days => v_dias), now())
    FROM categories WHERE business_id = v_plantilla;

  INSERT INTO ingredients (id, business_id, name, unit, category, stock_quantity, min_stock_quantity,
                           cost_per_unit, supplier, notes, is_active, created_at, updated_at)
  SELECT demo_copy_id(v_nuevo, id), v_nuevo, name, unit, category, stock_quantity, min_stock_quantity,
         cost_per_unit, supplier, notes, is_active,
         LEAST(created_at + make_interval(days => v_dias), now()),
         LEAST(updated_at + make_interval(days => v_dias), now())
    FROM ingredients WHERE business_id = v_plantilla;

  INSERT INTO products (id, business_id, category_id, name, slug, short_description, long_description,
                        ingredients, price, cost_override, image_url, gallery_urls, is_active,
                        sale_unit, min_quantity, min_advance_hours, stock_quantity, min_stock_quantity,
                        batch_size, sort_order, created_at, updated_at)
  SELECT demo_copy_id(v_nuevo, id), v_nuevo, demo_copy_id(v_nuevo, category_id),
         name, slug, short_description, long_description,
         ingredients, price, cost_override, image_url, gallery_urls, is_active,
         sale_unit, min_quantity, min_advance_hours, stock_quantity, min_stock_quantity,
         batch_size, sort_order,
         LEAST(created_at + make_interval(days => v_dias), now()),
         LEAST(updated_at + make_interval(days => v_dias), now())
    FROM products WHERE business_id = v_plantilla;

  INSERT INTO recipe_items (id, product_id, ingredient_id, quantity_per_batch)
  SELECT demo_copy_id(v_nuevo, r.id), demo_copy_id(v_nuevo, r.product_id),
         demo_copy_id(v_nuevo, r.ingredient_id), r.quantity_per_batch
    FROM recipe_items r JOIN products p ON p.id = r.product_id
   WHERE p.business_id = v_plantilla;

  INSERT INTO packages (id, business_id, name, slug, description, image_url, price,
                        is_editable, is_active, sort_order, created_at, updated_at)
  SELECT demo_copy_id(v_nuevo, id), v_nuevo, name, slug, description, image_url, price,
         is_editable, is_active, sort_order,
         LEAST(created_at + make_interval(days => v_dias), now()),
         LEAST(updated_at + make_interval(days => v_dias), now())
    FROM packages WHERE business_id = v_plantilla;

  INSERT INTO package_items (id, package_id, product_id, quantity)
  SELECT demo_copy_id(v_nuevo, pi.id), demo_copy_id(v_nuevo, pi.package_id),
         demo_copy_id(v_nuevo, pi.product_id), pi.quantity
    FROM package_items pi JOIN packages pk ON pk.id = pi.package_id
   WHERE pk.business_id = v_plantilla;

  INSERT INTO customers (id, business_id, first_name, last_name, phone, email, instagram,
                         address, notes, is_active, created_at, updated_at)
  SELECT demo_copy_id(v_nuevo, id), v_nuevo, first_name, last_name, phone, email, instagram,
         address, notes, is_active,
         LEAST(created_at + make_interval(days => v_dias), now()),
         LEAST(updated_at + make_interval(days => v_dias), now())
    FROM customers WHERE business_id = v_plantilla;

  INSERT INTO orders (id, business_id, order_number, status, customer_id, contact_name, phone, email,
                      delivery_method, address, city, delivery_date, delivery_time, subtotal,
                      production_cost, deposit_amount, payment_method, channel, observations,
                      admin_notes, requires_invoice, invoice_data, created_at, updated_at)
  SELECT demo_copy_id(v_nuevo, id), v_nuevo, order_number, status, demo_copy_id(v_nuevo, customer_id),
         contact_name, phone, email, delivery_method, address, city,
         delivery_date + v_dias, delivery_time, subtotal,
         production_cost, deposit_amount, payment_method, channel, observations,
         admin_notes, requires_invoice, invoice_data,
         LEAST(created_at + make_interval(days => v_dias), now()),
         LEAST(updated_at + make_interval(days => v_dias), now())
    FROM orders WHERE business_id = v_plantilla;

  INSERT INTO order_items (id, order_id, product_id, package_id, item_name, unit_price,
                           quantity, subtotal, unit_cost, cost_subtotal, notes)
  SELECT demo_copy_id(v_nuevo, oi.id), demo_copy_id(v_nuevo, oi.order_id),
         demo_copy_id(v_nuevo, oi.product_id), demo_copy_id(v_nuevo, oi.package_id),
         oi.item_name, oi.unit_price, oi.quantity, oi.subtotal, oi.unit_cost, oi.cost_subtotal, oi.notes
    FROM order_items oi JOIN orders o ON o.id = oi.order_id
   WHERE o.business_id = v_plantilla;

  INSERT INTO order_status_history (id, order_id, from_status, to_status, changed_by, notes, created_at)
  SELECT demo_copy_id(v_nuevo, h.id), demo_copy_id(v_nuevo, h.order_id),
         h.from_status, h.to_status, NULL, h.notes,
         LEAST(h.created_at + make_interval(days => v_dias), now())
    FROM order_status_history h JOIN orders o ON o.id = h.order_id
   WHERE o.business_id = v_plantilla;

  INSERT INTO expense_categories (id, business_id, name, color, sort_order, is_active, created_at)
  SELECT demo_copy_id(v_nuevo, id), v_nuevo, name, color, sort_order, is_active,
         LEAST(created_at + make_interval(days => v_dias), now())
    FROM expense_categories WHERE business_id = v_plantilla;

  INSERT INTO expenses (id, business_id, category_id, description, amount, expense_date,
                        supplier, payment_method, notes, created_at, updated_at)
  SELECT demo_copy_id(v_nuevo, id), v_nuevo, demo_copy_id(v_nuevo, category_id),
         description, amount, expense_date + v_dias,
         supplier, payment_method, notes,
         LEAST(created_at + make_interval(days => v_dias), now()),
         LEAST(updated_at + make_interval(days => v_dias), now())
    FROM expenses WHERE business_id = v_plantilla;

  INSERT INTO stock_movements (id, business_id, reference_type, reference_id, movement_type,
                               quantity, unit_cost, order_id, notes, created_by, created_at)
  SELECT demo_copy_id(v_nuevo, id), v_nuevo, reference_type, demo_copy_id(v_nuevo, reference_id),
         movement_type, quantity, unit_cost, demo_copy_id(v_nuevo, order_id), notes, NULL,
         LEAST(created_at + make_interval(days => v_dias), now())
    FROM stock_movements WHERE business_id = v_plantilla;

  INSERT INTO settings (business_id, key, value, updated_at)
  SELECT v_nuevo, key, value, updated_at FROM settings WHERE business_id = v_plantilla;

  INSERT INTO business_members (business_id, user_id, role)
  VALUES (v_nuevo, p_user_id, 'owner');

  RETURN v_nuevo;
END;
$fn$;
