-- GastroOS — Una demo propia para cada visitante
-- ============================================
-- Hasta acá la demo era una sola cuenta compartida: todos entraban al mismo
-- negocio y lo que uno cambiaba lo veía el siguiente. La guía invita a "cargá
-- un pedido, cambiá un precio, borrá algo", así que bastaba con que alguien
-- aceptara la invitación para que el próximo visitante encontrara una demo
-- rota o vacía.
--
-- Ahora hay un negocio plantilla, que nadie usa, y cada visitante recibe una
-- copia entera y propia. Todos arrancan de los mismos datos, cada uno rompe lo
-- suyo, y nadie le toca la demo a nadie.
--
-- La copia es barata porque el negocio plantilla es chico (una decena de
-- productos, algunas decenas de pedidos). Si algún día dejara de serlo, lo que
-- hay que revisar es esto, no el resto del sistema.

-- ============================================
-- La plantilla
-- ============================================
-- Un negocio marcado como plantilla es el molde de la demo. No se entra a él:
-- sólo se copia.
ALTER TABLE businesses
  ADD COLUMN IF NOT EXISTS is_demo_template BOOLEAN NOT NULL DEFAULT false;

-- Una sola, o el molde deja de ser un molde. El índice parcial sobre una
-- constante es la forma de decir "como mucho una fila cumple esto".
CREATE UNIQUE INDEX IF NOT EXISTS businesses_una_plantilla_demo
  ON businesses ((true)) WHERE is_demo_template;

-- ============================================
-- Las copias
-- ============================================
CREATE TABLE IF NOT EXISTS demo_sandboxes (
  business_id UUID PRIMARY KEY REFERENCES businesses(id) ON DELETE CASCADE,
  user_id     UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  -- Se refresca cada vez que la persona vuelve, así una demo en uso no se
  -- borra debajo de quien la está mirando.
  last_seen_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at   TIMESTAMPTZ NOT NULL DEFAULT now() + INTERVAL '3 days'
);

CREATE INDEX IF NOT EXISTS demo_sandboxes_expires_idx ON demo_sandboxes (expires_at);
CREATE INDEX IF NOT EXISTS demo_sandboxes_user_idx    ON demo_sandboxes (user_id);

-- Sin policies a propósito: esta tabla no la lee ni la escribe nadie con la
-- anon key ni con una sesión del panel. La tocan la service role, que saltea
-- RLS, y las funciones SECURITY DEFINER de más abajo.
ALTER TABLE demo_sandboxes ENABLE ROW LEVEL SECURITY;

-- Y además sin permisos. Con RLS activo y sin policies ya no leían nada, pero
-- Supabase le da DML completo a `anon` y `authenticated` sobre todo lo que
-- aparece en `public`, y esos permisos quedarían esperando a que alguien
-- agregue una policy para otra cosa.
REVOKE ALL ON TABLE demo_sandboxes FROM anon, authenticated;

-- ============================================
-- La tienda pública nunca puede caer en una copia
-- ============================================
-- `getStorefrontBusiness` toma el primer negocio con la tienda habilitada, y
-- la copia hereda ese campo de la plantilla. Peor: dentro de su demo el
-- visitante puede prender el interruptor en Configuración. Sin esto, alguien
-- que entra a hacer un pedido de verdad podría terminar comprándole a la demo
-- de un desconocido.
--
-- Se cierra en la base y no en el código de la aplicación porque es una
-- garantía, no una preferencia: no depende de que una variable de entorno esté
-- puesta ni de que nadie toque un interruptor.
CREATE OR REPLACE FUNCTION public.is_demo_sandbox(p_business_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (SELECT 1 FROM demo_sandboxes WHERE business_id = p_business_id);
$$;

DROP POLICY IF EXISTS "public read storefront business" ON businesses;
CREATE POLICY "public read storefront business" ON businesses
  FOR SELECT USING (storefront_enabled = true AND NOT is_demo_sandbox(id));

-- La misma puerta, para las policies de lectura anónima de productos,
-- paquetes y categorías, que cuelgan todas de esta función.
CREATE OR REPLACE FUNCTION public.is_storefront_open(p_business_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM businesses
    WHERE id = p_business_id
      AND storefront_enabled = true
      AND NOT is_demo_sandbox(id)
  );
$$;

-- ============================================
-- Identificadores derivados
-- ============================================
-- Copiar un negocio entero es copiar quince tablas que se referencian entre
-- sí: el pedido apunta al cliente, el ítem al producto, la receta al insumo.
-- Cada fila nueva necesita un id nuevo, y cada referencia tiene que apuntar al
-- id nuevo de la fila que le corresponde.
--
-- En vez de arrastrar una tabla de correspondencias entre sentencia y
-- sentencia, el id nuevo se calcula: es un hash del id viejo y del id de la
-- copia. Así cualquier sentencia puede traducir una referencia sola, sin
-- consultar nada, y el orden de las copias deja de importar.
--
-- No es STRICT a propósito: con un id viejo nulo (una referencia opcional que
-- no estaba) tiene que devolver nulo, y eso es justo lo que hace la
-- concatenación.
CREATE OR REPLACE FUNCTION public.demo_copy_id(p_sandbox UUID, p_source UUID)
RETURNS UUID
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT md5(p_sandbox::text || ':' || p_source::text)::uuid;
$$;

-- ============================================
-- Crear la copia
-- ============================================
CREATE OR REPLACE FUNCTION public.create_demo_sandbox(
  p_user_id UUID,
  p_ttl     INTERVAL DEFAULT INTERVAL '3 days'
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_plantilla UUID;
  v_nuevo     UUID;
  -- Días a correr las fechas. Sin esto la demo envejece: a los tres meses
  -- todos los pedidos de ejemplo quedan en el pasado y "Próximos" aparece
  -- vacío, que es la peor primera impresión posible. Se corre todo el conjunto
  -- por igual, así que la separación entre un pedido y otro se mantiene.
  v_dias      INTEGER;
BEGIN
  SELECT id INTO v_plantilla FROM businesses WHERE is_demo_template LIMIT 1;
  IF v_plantilla IS NULL THEN
    RAISE EXCEPTION 'No hay ningún negocio marcado como plantilla de la demo.';
  END IF;

  SELECT COALESCE((CURRENT_DATE + 2) - max(delivery_date), 0)
    INTO v_dias
    FROM orders WHERE business_id = v_plantilla;

  -- ---------- el negocio ----------
  INSERT INTO businesses (
    name, slug, industry, logo_url, phone, email, instagram, address,
    currency, locale, timezone, storefront_enabled, order_seq
  )
  -- El slug sale de un uuid y no de `gen_random_bytes`: eso último es de
  -- pgcrypto, que en Supabase vive en el esquema `extensions` y por lo tanto
  -- no está en el `search_path` fijo de esta función. `gen_random_uuid` es de
  -- Postgres y siempre está.
  SELECT name,
         'demo-' || substr(replace(gen_random_uuid()::text, '-', ''), 1, 16),
         industry, logo_url, phone, email, instagram, address,
         currency, locale, timezone, storefront_enabled, order_seq
    FROM businesses WHERE id = v_plantilla
  RETURNING id INTO v_nuevo;

  -- La copia queda registrada antes de llenarla: desde este momento
  -- `is_demo_sandbox` la reconoce y la tienda pública ya no puede elegirla.
  INSERT INTO demo_sandboxes (business_id, user_id, expires_at)
  VALUES (v_nuevo, p_user_id, now() + p_ttl);

  -- ---------- catálogo ----------
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
    FROM recipe_items r
    JOIN products p ON p.id = r.product_id
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
    FROM package_items pi
    JOIN packages pk ON pk.id = pi.package_id
   WHERE pk.business_id = v_plantilla;

  -- ---------- clientes y pedidos ----------
  -- `full_name` es una columna generada: se calcula sola y no se copia.
  INSERT INTO customers (id, business_id, first_name, last_name, phone, email, instagram,
                         address, notes, is_active, created_at, updated_at)
  SELECT demo_copy_id(v_nuevo, id), v_nuevo, first_name, last_name, phone, email, instagram,
         address, notes, is_active,
         LEAST(created_at + make_interval(days => v_dias), now()),
         LEAST(updated_at + make_interval(days => v_dias), now())
    FROM customers WHERE business_id = v_plantilla;

  -- `balance_due` también es generada.
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
    FROM order_items oi
    JOIN orders o ON o.id = oi.order_id
   WHERE o.business_id = v_plantilla;

  -- `changed_by` se pierde: apunta a un usuario real y la copia es de otra
  -- persona. El historial sigue contando qué pasó, sin decir quién.
  INSERT INTO order_status_history (id, order_id, from_status, to_status, changed_by, notes, created_at)
  SELECT demo_copy_id(v_nuevo, h.id), demo_copy_id(v_nuevo, h.order_id),
         h.from_status, h.to_status, NULL, h.notes,
         LEAST(h.created_at + make_interval(days => v_dias), now())
    FROM order_status_history h
    JOIN orders o ON o.id = h.order_id
   WHERE o.business_id = v_plantilla;

  -- ---------- gastos ----------
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

  -- ---------- movimientos de stock ----------
  -- `reference_id` apunta a un producto o a un insumo según `reference_type`;
  -- como el id nuevo se calcula igual para los dos, no hay que ramificar.
  INSERT INTO stock_movements (id, business_id, reference_type, reference_id, movement_type,
                               quantity, unit_cost, order_id, notes, created_by, created_at)
  SELECT demo_copy_id(v_nuevo, id), v_nuevo, reference_type, demo_copy_id(v_nuevo, reference_id),
         movement_type, quantity, unit_cost, demo_copy_id(v_nuevo, order_id), notes, NULL,
         LEAST(created_at + make_interval(days => v_dias), now())
    FROM stock_movements WHERE business_id = v_plantilla;

  -- ---------- preferencias ----------
  INSERT INTO settings (business_id, key, value, updated_at)
  SELECT v_nuevo, key, value, updated_at
    FROM settings WHERE business_id = v_plantilla;

  -- ---------- y la persona que la va a usar ----------
  INSERT INTO business_members (business_id, user_id, role)
  VALUES (v_nuevo, p_user_id, 'owner');

  RETURN v_nuevo;
END;
$$;

-- ============================================
-- La copia vigente de una persona
-- ============================================
-- Si alguien vuelve a la demo con su sesión todavía abierta, encuentra lo que
-- había dejado en vez de una demo nueva. De paso corre el vencimiento: una
-- demo que se usa no se borra.
CREATE OR REPLACE FUNCTION public.touch_demo_sandbox(
  p_user_id UUID,
  p_ttl     INTERVAL DEFAULT INTERVAL '3 days'
)
RETURNS UUID
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  UPDATE demo_sandboxes
     SET last_seen_at = now(),
         expires_at   = now() + p_ttl
   WHERE user_id = p_user_id AND expires_at > now()
  RETURNING business_id;
$$;

-- ============================================
-- Tirar la copia
-- ============================================
-- Borrar el negocio se lleva puesto todo lo que cuelga de él (todas las claves
-- foráneas son ON DELETE CASCADE), y borrar el usuario se lleva la membresía.
CREATE OR REPLACE FUNCTION public.drop_demo_sandbox(p_user_id UUID)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_borradas INTEGER;
BEGIN
  WITH mias AS (
    SELECT business_id FROM demo_sandboxes WHERE user_id = p_user_id
  ), borrado AS (
    DELETE FROM businesses WHERE id IN (SELECT business_id FROM mias) RETURNING 1
  )
  SELECT count(*)::int INTO v_borradas FROM borrado;

  RETURN v_borradas;
END;
$$;

-- ============================================
-- Limpieza
-- ============================================
-- No hay cron: esto se llama al crear una demo nueva, que es exactamente
-- cuando importa que las viejas ya no estén. Una demo abandonada sobrevive
-- hasta que llega la siguiente visita, y eso está bien.
--
-- `p_max_vivas` es la válvula: si algo saliera mal y alguien creara demos en
-- cantidad, las más viejas se van igual aunque no hayan vencido.
CREATE OR REPLACE FUNCTION public.purge_demo_sandboxes(p_max_vivas INTEGER DEFAULT 300)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_total INTEGER := 0;
  v_paso  INTEGER;
BEGIN
  WITH vencidas AS (
    SELECT business_id, user_id FROM demo_sandboxes WHERE expires_at < now()
  ), sin_negocio AS (
    DELETE FROM businesses WHERE id IN (SELECT business_id FROM vencidas) RETURNING 1
  )
  SELECT count(*)::int INTO v_paso FROM sin_negocio;
  v_total := v_total + v_paso;

  -- Los usuarios quedan huérfanos si no se borran acá: no cuelgan de ningún
  -- negocio, así que el cascade del negocio no los alcanza.
  DELETE FROM auth.users u
   WHERE NOT EXISTS (SELECT 1 FROM business_members m WHERE m.user_id = u.id)
     AND u.raw_app_meta_data ->> 'gastroos_demo' = 'true';

  WITH sobrantes AS (
    SELECT business_id FROM demo_sandboxes
     ORDER BY last_seen_at DESC
    OFFSET GREATEST(p_max_vivas, 0)
  ), sin_negocio AS (
    DELETE FROM businesses WHERE id IN (SELECT business_id FROM sobrantes) RETURNING 1
  )
  SELECT count(*)::int INTO v_paso FROM sin_negocio;

  RETURN v_total + v_paso;
END;
$$;

-- ============================================
-- Permisos
-- ============================================
-- Todo esto lo llama el servidor con la service role. Nadie más: si el
-- visitante pudiera invocarlas con su anon key, tendría una forma de crear
-- negocios y usuarios a voluntad.
REVOKE ALL ON FUNCTION public.create_demo_sandbox(UUID, INTERVAL) FROM public, anon, authenticated;
REVOKE ALL ON FUNCTION public.touch_demo_sandbox(UUID, INTERVAL)  FROM public, anon, authenticated;
REVOKE ALL ON FUNCTION public.drop_demo_sandbox(UUID)             FROM public, anon, authenticated;
REVOKE ALL ON FUNCTION public.purge_demo_sandboxes(INTEGER)       FROM public, anon, authenticated;

GRANT EXECUTE ON FUNCTION public.create_demo_sandbox(UUID, INTERVAL) TO service_role;
GRANT EXECUTE ON FUNCTION public.touch_demo_sandbox(UUID, INTERVAL)  TO service_role;
GRANT EXECUTE ON FUNCTION public.drop_demo_sandbox(UUID)             TO service_role;
GRANT EXECUTE ON FUNCTION public.purge_demo_sandboxes(INTEGER)       TO service_role;

-- `is_demo_sandbox` sí: vive dentro de las policies de lectura pública, así
-- que la evalúa el anónimo que mira la tienda.
GRANT EXECUTE ON FUNCTION public.is_demo_sandbox(UUID) TO anon, authenticated, service_role;
