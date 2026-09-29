-- ============================================
-- 007 — La tienda pública crea pedidos por función, no por INSERT directo
-- ============================================
--
-- Dos problemas que arregla esta migración.
--
-- 1) El checkout público estaba roto de raíz. La policy de INSERT existía y
--    estaba bien, pero PostgreSQL, cuando el INSERT lleva RETURNING, aplica
--    además las policies de SELECT como WITH CHECK: no te devuelve una fila
--    que no podrías leer. `orders` no tiene (ni debe tener) policy de SELECT
--    para anónimos, y PostgREST siempre manda RETURNING, así que todo pedido
--    de la tienda moría con "new row violates row-level security policy",
--    un mensaje que apunta a la policy de INSERT cuando el problema está en
--    la de lectura. RLS no puede expresar "podés leer la fila que acabás de
--    escribir"; una función SECURITY DEFINER sí, y además controla con
--    exactitud qué devuelve: acá, sólo el id y el número de pedido.
--
-- 2) Con el INSERT directo habilitado, cualquiera con la anon key —que es
--    pública por diseño, viaja en el navegador— podía POSTear a /rest/v1/orders
--    un pedido con el subtotal que quisiera, o escribir admin_notes. Los
--    precios ahora los pone el catálogo adentro de la función: de afuera sólo
--    se elige qué producto y cuánto. Por eso la función reemplaza a las
--    policies de INSERT en vez de convivir con ellas.
--
-- Nota sobre el costo de producción: los pedidos de la tienda quedan con
-- production_cost en NULL. Ya era así (los costos salen de recetas, que no
-- son legibles por anónimos) y no cambia: el costeo se mide en Estadísticas
-- a partir de las recetas, no del snapshot del pedido.

CREATE OR REPLACE FUNCTION create_storefront_order(
  p_business_id uuid,
  p_contact jsonb,
  p_items jsonb
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_name        text := nullif(btrim(p_contact->>'contact_name'), '');
  v_phone       text := nullif(btrim(p_contact->>'phone'), '');
  v_email       text := nullif(btrim(p_contact->>'email'), '');
  v_address     text := nullif(btrim(p_contact->>'address'), '');
  v_city        text := nullif(btrim(p_contact->>'city'), '');
  v_method      text := coalesce(nullif(btrim(p_contact->>'delivery_method'), ''), 'pickup');
  v_date        date := nullif(btrim(p_contact->>'delivery_date'), '')::date;
  v_obs         text := nullif(btrim(p_contact->>'observations'), '');
  v_first       text;
  v_pedidas     integer;
  v_cargadas    integer;
  v_customer_id uuid;
  v_order_id    uuid;
  v_number      integer;
BEGIN
  IF NOT is_storefront_open(p_business_id) THEN
    RAISE EXCEPTION 'La tienda no está disponible en este momento.';
  END IF;

  IF v_name IS NULL THEN
    RAISE EXCEPTION 'El nombre es obligatorio.';
  END IF;
  IF v_date IS NULL THEN
    RAISE EXCEPTION 'La fecha de entrega es obligatoria.';
  END IF;
  IF v_method NOT IN ('pickup', 'delivery') THEN
    RAISE EXCEPTION 'El método de entrega no es válido.';
  END IF;
  IF v_method = 'delivery' AND v_address IS NULL THEN
    RAISE EXCEPTION 'La dirección es obligatoria para envíos a domicilio.';
  END IF;

  SELECT count(*) INTO v_pedidas FROM jsonb_array_elements(p_items);
  IF coalesce(v_pedidas, 0) = 0 THEN
    RAISE EXCEPTION 'Agregá al menos un producto al pedido.';
  END IF;

  -- Mismo criterio que el panel: primero por teléfono o mail, después por
  -- nombre, y recién ahí se crea. Así un cliente que ya existe no se duplica
  -- cada vez que encarga por la web.
  SELECT id INTO v_customer_id
  FROM customers
  WHERE business_id = p_business_id
    AND ((v_phone IS NOT NULL AND phone = v_phone) OR (v_email IS NOT NULL AND email = v_email))
  ORDER BY created_at
  LIMIT 1;

  IF v_customer_id IS NULL THEN
    SELECT id INTO v_customer_id
    FROM customers
    WHERE business_id = p_business_id AND lower(full_name) = lower(v_name)
    ORDER BY created_at
    LIMIT 1;
  END IF;

  IF v_customer_id IS NULL THEN
    v_first := split_part(v_name, ' ', 1);
    INSERT INTO customers (business_id, first_name, last_name, phone, email, address)
    VALUES (
      p_business_id,
      v_first,
      nullif(btrim(substr(v_name, length(v_first) + 1)), ''),
      v_phone,
      v_email,
      v_address
    )
    RETURNING id INTO v_customer_id;
  END IF;

  -- `status` y `channel` se fijan acá y no se aceptan de afuera: un pedido de
  -- la tienda nace pendiente y marcado como tal, siempre. Lo mismo con las
  -- columnas del panel (admin_notes, payment_method, deposit_amount): no se
  -- tocan desde la web.
  INSERT INTO orders (
    business_id, status, channel, customer_id, contact_name, phone, email,
    delivery_method, address, city, delivery_date, subtotal, observations
  ) VALUES (
    p_business_id, 'pending', 'storefront', v_customer_id, v_name, v_phone, v_email,
    v_method, v_address, v_city, v_date, 0, v_obs
  )
  RETURNING id, order_number INTO v_order_id, v_number;

  -- El precio sale del catálogo, no de lo que mandó el navegador. Las líneas
  -- de afuera sólo eligen qué y cuánto.
  WITH pedido AS (
    SELECT
      nullif(linea->>'product_id', '')::uuid AS product_id,
      nullif(linea->>'package_id', '')::uuid AS package_id,
      (linea->>'quantity')::integer          AS quantity,
      nullif(btrim(linea->>'notes'), '')     AS notes
    FROM jsonb_array_elements(p_items) AS linea
  ),
  catalogo AS (
    SELECT p.product_id, p.package_id, p.quantity, p.notes, c.name, c.price
      FROM pedido p
      JOIN products c ON c.id = p.product_id
       AND c.business_id = p_business_id
       AND c.is_active = true
    UNION ALL
    SELECT p.product_id, p.package_id, p.quantity, p.notes, c.name, c.price
      FROM pedido p
      JOIN packages c ON c.id = p.package_id
       AND c.business_id = p_business_id
       AND c.is_active = true
  )
  INSERT INTO order_items (
    order_id, product_id, package_id, item_name, unit_price, quantity, subtotal, notes
  )
  SELECT
    v_order_id, product_id, package_id, name, price, quantity,
    round(price * quantity, 2), notes
  FROM catalogo
  WHERE quantity > 0;

  GET DIAGNOSTICS v_cargadas = ROW_COUNT;

  -- Si alguna línea no encontró producto activo de este negocio, se cae el
  -- pedido entero. Media docena de facturas y un pedido con la mitad de las
  -- cosas es peor que un error claro.
  IF v_cargadas <> v_pedidas THEN
    RAISE EXCEPTION 'Alguno de los productos del pedido ya no está disponible.';
  END IF;

  UPDATE orders
     SET subtotal = (SELECT round(coalesce(sum(subtotal), 0), 2) FROM order_items WHERE order_id = v_order_id)
   WHERE id = v_order_id;

  INSERT INTO order_status_history (order_id, from_status, to_status, notes)
  VALUES (v_order_id, NULL, 'pending', 'Pedido creado desde la tienda');

  RETURN jsonb_build_object('id', v_order_id, 'order_number', v_number);
END;
$$;

REVOKE ALL ON FUNCTION create_storefront_order(uuid, jsonb, jsonb) FROM public;
GRANT EXECUTE ON FUNCTION create_storefront_order(uuid, jsonb, jsonb) TO anon, authenticated;

-- Con la función en pie, la tienda ya no necesita escribir las tablas de
-- frente, y dejarle el permiso sólo mantiene abierta la puerta de los precios
-- falsos. La lectura tampoco: `orders`, `order_items` y `customers` nunca
-- tuvieron policy de SELECT para anónimos, así que revocar el GRANT no le
-- quita nada a nadie y evita que una policy futura escrita a las apuradas
-- exponga pedidos.
DROP POLICY IF EXISTS "storefront can create orders" ON orders;
DROP POLICY IF EXISTS "storefront can create order items" ON order_items;
DROP POLICY IF EXISTS "storefront can create status history" ON order_status_history;

REVOKE SELECT, INSERT, UPDATE, DELETE ON orders FROM anon;
REVOKE SELECT, INSERT, UPDATE, DELETE ON order_items FROM anon;
REVOKE SELECT, INSERT, UPDATE, DELETE ON order_status_history FROM anon;
REVOKE SELECT, INSERT, UPDATE, DELETE ON customers FROM anon;
