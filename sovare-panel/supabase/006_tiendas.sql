-- ============================================
-- Tiendas por cliente: aprobar un pago crea el negocio
-- ============================================
-- Hasta acá aprobar una contratación (la IA sola o una persona desde el panel)
-- sólo cambiaba el estado. Esto agrega lo que hace falta para que, en el plan
-- Taller, aprobar el pago deje al cliente con su negocio, su cuenta y su tienda
-- andando, sin que nadie arme nada a mano.
--
-- Qué hace cada pieza:
--   * columnas nuevas en sovare.signups: a qué negocio y a qué usuario llevó
--     cada contratación, y los hitos de la entrega (para no repetir mails ni
--     crear dos veces lo mismo);
--   * sovare.provision_business(): crea el negocio, la ficha de cliente y el
--     primer cobro en una sola transacción, y es idempotente.
--
-- La cuenta del usuario (auth.users) la crea el servidor de la landing con la
-- service role: crear usuarios con SQL pelado depende de detalles internos de
-- GoTrue que cambian de versión en versión.

-- ============================================
-- Columnas
-- ============================================
ALTER TABLE sovare.signups
  ADD COLUMN IF NOT EXISTS business_id UUID REFERENCES public.businesses(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS owner_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  -- La dirección de su tienda (tunegocio en tunegocio.gastroos.shop), copiada acá
  -- para que el panel la muestre sin tener que leer la tabla de negocios.
  ADD COLUMN IF NOT EXISTS store_slug TEXT,
  -- Se toma al empezar a crear la cuenta. Es un candado: si dos pedidos llegan a
  -- la vez (la IA aprueba mientras alguien aprueba a mano), sólo uno sigue.
  ADD COLUMN IF NOT EXISTS provision_started_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS provisioned_at TIMESTAMPTZ,
  -- Por qué no se pudo crear la tienda, si no se pudo. Lo lee el panel.
  ADD COLUMN IF NOT EXISTS provision_error TEXT,
  -- Cuándo eligió su contraseña. Mientras sea NULL, quien tenga el link de la
  -- contratación puede elegirla; después ya no.
  ADD COLUMN IF NOT EXISTS password_set_at TIMESTAMPTZ,
  -- Cuándo se le avisó que su sistema está listo (planes con puesta a punto).
  ADD COLUMN IF NOT EXISTS ready_notified_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS signups_business_idx ON sovare.signups (business_id) WHERE business_id IS NOT NULL;

-- ============================================
-- Nombres que no pueden ser una tienda
-- ============================================
-- Cada tienda vive en tunegocio.gastroos.shop, y hay subdominios que ya tienen
-- otro dueño (la propia página, el mail, el panel) o que confundirían a quien
-- los lea. La landing tiene la misma lista en src/lib/tenant.ts: si se toca una,
-- se toca la otra.
CREATE OR REPLACE FUNCTION sovare.slug_reservado(p_slug TEXT)
RETURNS BOOLEAN
LANGUAGE sql
IMMUTABLE
SET search_path = sovare, public
AS $$
  SELECT p_slug = ANY (ARRAY[
    'www', 'app', 'admin', 'api', 'panel', 'sovare', 'gastroos', 'cosov',
    'mail', 'email', 'send', 'smtp', 'imap', 'pop', 'mx', 'ns1', 'ns2', 'ftp',
    'hola', 'soporte', 'ayuda', 'contacto', 'info', 'ventas', 'billing',
    'login', 'salir', 'contratar', 'alta', 'vendedor', 'vendedores', 'catalogo',
    'tienda', 'tiendas', 'demo', 'test', 'prueba', 'staging', 'dev', 'static',
    'cdn', 'assets', 'status', 'blog', 'docs', 'resend', 'dashboard', 'cuenta'
  ])
  OR p_slug LIKE 'demo-%';
$$;

-- ============================================
-- Crear el negocio de una contratación aprobada
-- ============================================
-- SECURITY DEFINER porque escribe en public.businesses, y el único que llama
-- esto es el servidor de la landing con la service role. Por eso mismo se le
-- quita el permiso a todos los demás: con EXECUTE para `authenticated`, cualquier
-- persona con una cuenta de demo podría fabricar negocios.
--
-- Devuelve un JSON {business_id, slug, client_id, created} y no una tabla: los
-- nombres de las columnas de salida de una función plpgsql chocan con las
-- columnas de las tablas que toca (`slug`, `business_id`…) y la ambigüedad sólo
-- aparece al ejecutarla.
--
-- Idempotente: si la contratación ya tiene su negocio lo devuelve tal cual. El
-- FOR UPDATE hace que dos llamadas simultáneas se esperen en vez de pisarse.
--
-- Lo que se crea:
--   * el negocio, con la tienda habilitada y los datos de contacto de la
--     contratación;
--   * la ficha de cliente (o se reusa la que ya tenga) enlazada al negocio, para
--     que "pedidos por mes" y los cobros funcionen desde el primer día;
--   * el cobro del primer mes, ya pagado: el cliente lo transfirió para contratar.
--     Sin esto el próximo "generar los cobros del mes" saldría vacío el primer mes
--     y el panel mostraría una deuda que no existe.
CREATE OR REPLACE FUNCTION sovare.provision_business(p_signup UUID, p_slug TEXT)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = sovare, public
AS $$
DECLARE
  v_signup    sovare.signups%ROWTYPE;
  v_plan      sovare.plans%ROWTYPE;
  v_base      TEXT := lower(coalesce(p_slug, ''));
  v_candidate TEXT;
  v_business  UUID;
  v_client    UUID;
  v_hoy       DATE := (now() AT TIME ZONE 'America/Argentina/Buenos_Aires')::date;
  v_result    JSONB;
  i           INTEGER;
BEGIN
  SELECT * INTO v_signup FROM sovare.signups WHERE id = p_signup FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'No existe esa contratación.' USING ERRCODE = 'P0001';
  END IF;
  IF v_signup.status <> 'aprobado' THEN
    RAISE EXCEPTION 'La contratación no está aprobada.' USING ERRCODE = 'P0001';
  END IF;

  -- Ya estaba hecho: se devuelve lo que hay.
  IF v_signup.business_id IS NOT NULL THEN
    SELECT jsonb_build_object(
             'business_id', b.id, 'slug', b.slug,
             'client_id', v_signup.client_id, 'created', false)
      INTO v_result
      FROM public.businesses b
     WHERE b.id = v_signup.business_id;
    IF v_result IS NOT NULL THEN
      RETURN v_result;
    END IF;
    -- El negocio ya no existe (lo borraron a mano): se arma de nuevo.
  END IF;

  SELECT * INTO v_plan FROM sovare.plans WHERE code = v_signup.plan;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'El plan de la contratación no existe.' USING ERRCODE = 'P0001';
  END IF;

  IF v_base !~ '^[a-z0-9]+(-[a-z0-9]+)*$' OR length(v_base) < 3 OR length(v_base) > 40 THEN
    RAISE EXCEPTION 'El nombre para la dirección de la tienda no es válido.' USING ERRCODE = 'P0001';
  END IF;

  -- Se prueba el nombre pedido y después con -2, -3… hasta encontrar uno libre.
  -- ON CONFLICT en vez de mirar antes: entre mirar y escribir puede entrar otro.
  FOR i IN 1..40 LOOP
    v_candidate := CASE
      WHEN i = 1 THEN v_base
      ELSE left(v_base, 40 - length(i::text) - 1) || '-' || i::text
    END;
    CONTINUE WHEN sovare.slug_reservado(v_candidate);

    INSERT INTO public.businesses (name, slug, industry, phone, email, storefront_enabled)
    VALUES (
      left(btrim(v_signup.business_name), 120),
      v_candidate,
      nullif(btrim(coalesce(v_signup.industry, '')), ''),
      nullif(btrim(coalesce(v_signup.whatsapp, '')), ''),
      lower(btrim(v_signup.email)),
      true
    )
    ON CONFLICT (slug) DO NOTHING
    RETURNING id INTO v_business;

    EXIT WHEN v_business IS NOT NULL;
  END LOOP;

  IF v_business IS NULL THEN
    RAISE EXCEPTION 'No se encontró una dirección libre para la tienda.' USING ERRCODE = 'P0001';
  END IF;

  IF v_signup.client_id IS NOT NULL THEN
    -- Ya la habían convertido a mano en una ficha: se la enlaza al negocio.
    v_client := v_signup.client_id;
    UPDATE sovare.clients SET business_id = v_business WHERE id = v_client;
  ELSE
    INSERT INTO sovare.clients (
      business_name, contact_name, whatsapp, email, industry, city,
      status, source, started_at, plan, monthly_amount, setup_amount, currency,
      billing_day, business_id, notes
    )
    VALUES (
      v_signup.business_name, v_signup.contact_name, v_signup.whatsapp, v_signup.email,
      v_signup.industry, v_signup.city,
      -- Sin puesta a punto no hay nada que implementar: el cliente ya está andando.
      CASE WHEN v_plan.setup > 0 THEN 'implementacion' ELSE 'activo' END::sovare.client_status,
      'Contratación desde la página', v_hoy, v_plan.label, v_plan.monthly, v_plan.setup,
      v_signup.currency,
      -- Hasta el 28, que existe en todos los meses.
      LEAST(EXTRACT(day FROM v_hoy)::int, 28),
      v_business,
      format('Viene de la contratación del %s. Plan %s: la tienda se creó al aprobar el pago.',
             to_char(v_signup.created_at AT TIME ZONE 'America/Argentina/Buenos_Aires', 'DD/MM/YYYY'),
             v_plan.label)
    )
    RETURNING id INTO v_client;
  END IF;

  -- Lo que ya transfirió, anotado como cobrado.
  --
  -- Va fuera del IF a propósito. Antes vivía sólo en la rama que creaba la ficha,
  -- así que si en el panel se apretaba "Crear la ficha de cliente" antes que
  -- "Crear su negocio", el primer mes no quedaba registrado nunca: el cliente
  -- aparecía debiendo algo que ya había pagado, y la cobranza del mes siguiente
  -- le generaba un cobro de más.
  --
  -- El ON CONFLICT lo hace idempotente —(client_id, period, concept) es único—,
  -- así que correrlo dos veces no duplica el cobro y el orden de los botones deja
  -- de importar.
  INSERT INTO sovare.payments (client_id, period, concept, amount, currency, due_date, paid_at, status, method, notes)
  VALUES (
    v_client, date_trunc('month', v_hoy)::date, 'Mensualidad', v_plan.monthly, v_signup.currency,
    v_hoy, v_hoy, 'pagado', 'Transferencia',
    'Primer mes, pagado al contratar desde la página.'
  )
  ON CONFLICT (client_id, period, concept) DO NOTHING;

  -- La puesta a punto, si el plan la lleva. Lo que transfirió fue la suma.
  IF v_signup.includes_setup AND v_plan.setup > 0 THEN
    INSERT INTO sovare.payments (client_id, period, concept, amount, currency, due_date, paid_at, status, method, notes)
    VALUES (
      v_client, date_trunc('month', v_hoy)::date, 'Puesta a punto', v_plan.setup, v_signup.currency,
      v_hoy, v_hoy, 'pagado', 'Transferencia',
      'Pagada junto con el primer mes al contratar desde la página.'
    )
    ON CONFLICT (client_id, period, concept) DO NOTHING;
  END IF;

  UPDATE sovare.signups
     SET business_id = v_business, client_id = v_client, store_slug = v_candidate,
         provision_error = NULL
   WHERE id = p_signup;

  RETURN jsonb_build_object(
    'business_id', v_business, 'slug', v_candidate, 'client_id', v_client, 'created', true);
END;
$$;

REVOKE EXECUTE ON FUNCTION sovare.provision_business(UUID, TEXT) FROM PUBLIC, anon, authenticated;
GRANT  EXECUTE ON FUNCTION sovare.provision_business(UUID, TEXT) TO service_role;

REVOKE EXECUTE ON FUNCTION sovare.slug_reservado(TEXT) FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION sovare.slug_reservado(TEXT) TO authenticated, service_role;
