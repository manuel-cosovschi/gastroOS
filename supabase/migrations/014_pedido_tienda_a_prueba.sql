-- El pedido de la tienda, revisado del lado del servidor.
--
-- `create_storefront_order` es ejecutable por el rol anónimo, y tiene que
-- serlo: la tienda es pública y la anon key viaja en el navegador. Eso
-- significa que cualquiera puede llamarla de frente, sin pasar por la pantalla
-- de pedido. Hasta ahora el formulario chequeaba cosas que la función no:
-- fechas, cantidades, mínimos, largos de texto. Lo que valida sólo el
-- navegador, no está validado.
--
-- Los precios ya venían del catálogo, eso estaba bien. Esto completa el resto.

CREATE OR REPLACE FUNCTION public.create_storefront_order(
  p_business_id uuid,
  p_contact jsonb,
  p_items jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
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
  v_tz          text;
  v_hoy         date;
  v_bajo_nombre text;
  v_bajo_min    integer;
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

  -- La fecha se compara contra el día del negocio, no contra el del servidor:
  -- a las 22 de Buenos Aires en Postgres ya es mañana.
  SELECT nullif(btrim(timezone), '') INTO v_tz FROM businesses WHERE id = p_business_id;
  v_hoy := (now() AT TIME ZONE coalesce(v_tz, 'America/Argentina/Buenos_Aires'))::date;

  IF v_date < v_hoy THEN
    RAISE EXCEPTION 'La fecha de entrega ya pasó.';
  END IF;

  -- Un pedido con la dirección de alguien que escribió una novela entra igual
  -- a la base y después nadie lo puede imprimir ni leer en el teléfono.
  IF length(v_name) > 120
     OR length(coalesce(v_phone, '')) > 40
     OR length(coalesce(v_email, '')) > 160
     OR length(coalesce(v_address, '')) > 300
     OR length(coalesce(v_city, '')) > 120
     OR length(coalesce(v_obs, '')) > 2000 THEN
    RAISE EXCEPTION 'Alguno de los datos del pedido es demasiado largo.';
  END IF;

  SELECT count(*) INTO v_pedidas FROM jsonb_array_elements(p_items);
  IF coalesce(v_pedidas, 0) = 0 THEN
    RAISE EXCEPTION 'Agregá al menos un producto al pedido.';
  END IF;
  IF v_pedidas > 100 THEN
    RAISE EXCEPTION 'El pedido tiene demasiadas líneas.';
  END IF;

  -- Cantidades. Sin techo, un cero de más se lleva puesto el stock y aparece
  -- en la cocina como un pedido de diez mil facturas.
  IF EXISTS (
    SELECT 1
      FROM jsonb_array_elements(p_items) AS linea
     WHERE coalesce((linea->>'quantity')::integer, 0) < 1
        OR (linea->>'quantity')::integer > 9999
        OR length(coalesce(linea->>'notes', '')) > 500
  ) THEN
    RAISE EXCEPTION 'Revisá las cantidades del pedido.';
  END IF;

  -- El mínimo por producto lo decide el negocio en el panel. La pantalla ya no
  -- deja bajar de ahí; esto hace que tampoco se pueda por afuera.
  SELECT c.name, coalesce(c.min_quantity, 1) INTO v_bajo_nombre, v_bajo_min
    FROM jsonb_array_elements(p_items) AS linea
    JOIN products c
      ON c.id = nullif(linea->>'product_id', '')::uuid
     AND c.business_id = p_business_id
   WHERE (linea->>'quantity')::integer < coalesce(c.min_quantity, 1)
   LIMIT 1;

  IF v_bajo_nombre IS NOT NULL THEN
    RAISE EXCEPTION 'El pedido mínimo de % es % unidad(es).', v_bajo_nombre, v_bajo_min;
  END IF;

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

  INSERT INTO orders (
    business_id, status, channel, customer_id, contact_name, phone, email,
    delivery_method, address, city, delivery_date, subtotal, observations
  ) VALUES (
    p_business_id, 'pending', 'storefront', v_customer_id, v_name, v_phone, v_email,
    v_method, v_address, v_city, v_date, 0, v_obs
  )
  RETURNING id, order_number INTO v_order_id, v_number;

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
$function$;
