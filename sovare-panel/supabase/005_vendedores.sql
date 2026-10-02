-- ============================================
-- Vendedores a comisión
-- ============================================
-- Un vendedor carga los clientes que consiguió; nada cuenta hasta que el dueño
-- lo aprueba. Al aprobar, la comisión (por defecto el 50% de la cuota del primer
-- mes) queda acreditada en el saldo del mes. A fin de mes se liquida, se
-- transfiere, y se marca como pagada.
--
-- Tres decisiones de diseño:
--
-- 1) El saldo no es un número guardado: es la suma de las ventas aprobadas y sin
--    liquidar. Un saldo guardado se desfasa la primera vez que algo se anula;
--    una suma no puede.
--
-- 2) Lo que importa para la plata está congelado en la venta al aprobarla
--    (cuota del plan, porcentaje, importe). Si mañana cambia el precio del plan
--    o el porcentaje del vendedor, lo ya acreditado no se mueve.
--
-- 3) Las transiciones que tocan plata (aprobar, anular, liquidar, deshacer)
--    son funciones y no UPDATEs sueltos desde la aplicación. Cada una hace
--    todas sus escrituras en una sola transacción: una liquidación que se
--    corta a la mitad dejaría ventas marcadas como liquidadas sin liquidación.
--
-- Nota de aplicación: en producción esto se aplicó en varias migraciones chicas
-- (tablas, ventas, funciones, permisos) porque el puente de Supabase corta las
-- sentencias largas. El contenido es el de este archivo.
--
-- El vendedor no tiene cuenta. Entra por un link con un token largo, igual que
-- quien contrata un plan (sovare.signups). Las escrituras las hace el servidor de
-- la landing con la service role y, por eso, esa rol recibe sólo los permisos
-- que usa: leer, y insertar ventas pendientes. No puede aprobar ni liquidar.

-- ============================================
-- Período
-- ============================================
-- El mes de una venta es el mes en que se aprobó, en hora argentina. Con UTC una
-- venta aprobada el último día del mes a las 22 hs caería en el mes siguiente.
CREATE OR REPLACE FUNCTION sovare.current_period()
RETURNS DATE
LANGUAGE sql STABLE
AS $$
  SELECT date_trunc('month', now() AT TIME ZONE 'America/Argentina/Buenos_Aires')::date;
$$;

-- ============================================
-- Vendedores
-- ============================================
CREATE TABLE sovare.vendors (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Con este token entra a su página. Son dos UUID v4 pegados (244 bits de azar):
  -- no se adivina y no hace falta pgcrypto, que en Supabase vive en otro esquema.
  token TEXT NOT NULL UNIQUE
    DEFAULT replace(gen_random_uuid()::text || gen_random_uuid()::text, '-', ''),

  name     TEXT NOT NULL CHECK (length(btrim(name)) > 0),
  whatsapp TEXT,
  email    TEXT,
  city     TEXT,

  -- Porcentaje de la cuota del primer mes. Por vendedor y no global porque es
  -- lo primero que se negocia distinto con cada uno.
  commission_pct NUMERIC(5,2) NOT NULL DEFAULT 50
    CHECK (commission_pct >= 0 AND commission_pct <= 100),

  -- A dónde se le transfiere. Sólo lo ve el dueño: la página del vendedor no lo
  -- muestra ni lo pide.
  payout_alias  TEXT,
  payout_holder TEXT,

  -- Pausar no borra: un vendedor con ventas no se puede eliminar (RESTRICT más
  -- abajo), y tampoco se debería. Pausado no puede cargar clientes nuevos.
  is_active BOOLEAN NOT NULL DEFAULT true,
  notes     TEXT,

  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TRIGGER vendors_touch
  BEFORE UPDATE ON sovare.vendors
  FOR EACH ROW EXECUTE FUNCTION sovare.touch_updated_at();

-- ============================================
-- Liquidaciones
-- ============================================
-- Va antes que las ventas porque las ventas la referencian.
--
-- 'anulada' es una liquidación que se hizo y se deshizo. No se borra: si alguien
-- liquida por error y lo deshace, queda constancia de que pasó, y una
-- liquidación borrada es justo el tipo de cosa que después nadie puede explicar.
CREATE TYPE sovare.settlement_status AS ENUM ('liquidada', 'pagada', 'anulada');

CREATE TABLE sovare.vendor_settlements (
  id        UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  vendor_id UUID NOT NULL REFERENCES sovare.vendors(id) ON DELETE RESTRICT,

  -- Primer día del mes que se liquida.
  period      DATE NOT NULL CHECK (extract(day FROM period) = 1),
  sales_count INTEGER NOT NULL CHECK (sales_count >= 0),
  total       NUMERIC(12,2) NOT NULL CHECK (total >= 0),
  currency    TEXT NOT NULL DEFAULT 'ARS',

  status       sovare.settlement_status NOT NULL DEFAULT 'liquidada',
  settled_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  settled_by   UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  paid_at      TIMESTAMPTZ,
  -- Número de operación o lo que sirva para encontrar la transferencia después.
  paid_reference TEXT,

  -- "Pagada" y "tiene fecha de pago" son la misma afirmación. Si pudieran
  -- diferir, habría liquidaciones pagadas sin saber cuándo.
  CONSTRAINT settlement_pago_coherente CHECK ((status = 'pagada') = (paid_at IS NOT NULL))
);

-- No hay UNIQUE (vendedor, período) a propósito: se puede liquidar a mitad de
-- mes y volver a liquidar lo que se apruebe después. Cada liquidación cierra lo
-- que estaba sin liquidar en ese momento.
CREATE INDEX vendor_settlements_vendor_idx ON sovare.vendor_settlements (vendor_id, period DESC);

-- ============================================
-- Ventas cargadas por vendedores
-- ============================================
CREATE TYPE sovare.vendor_sale_status AS ENUM ('pendiente', 'aprobada', 'rechazada', 'anulada');

CREATE TABLE sovare.vendor_sales (
  id        UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  vendor_id UUID NOT NULL REFERENCES sovare.vendors(id) ON DELETE RESTRICT,

  -- Lo que cargó el vendedor.
  business_name TEXT NOT NULL CHECK (length(btrim(business_name)) > 0),
  contact_name  TEXT,
  whatsapp      TEXT,
  email         TEXT,
  city          TEXT,
  industry      TEXT,
  -- El plan que dice haber vendido. El dueño lo confirma o lo corrige al aprobar.
  plan  TEXT REFERENCES sovare.plans(code),
  notes TEXT,

  -- Versiones normalizadas, para encontrar al mismo cliente cargado dos veces
  -- aunque lo hayan escrito distinto: "223 538-3082" y "+54 9 223 5383082" son
  -- el mismo número, y "Pastelería Sol " y "pastelería sol" el mismo negocio.
  email_norm TEXT GENERATED ALWAYS AS (nullif(lower(btrim(email)), '')) STORED,
  whatsapp_norm TEXT GENERATED ALWAYS AS (
    CASE WHEN length(regexp_replace(coalesce(whatsapp, ''), '\D', '', 'g')) >= 8
         THEN right(regexp_replace(coalesce(whatsapp, ''), '\D', '', 'g'), 10)
    END
  ) STORED,
  business_norm TEXT GENERATED ALWAYS AS (lower(btrim(business_name))) STORED,

  status       sovare.vendor_sale_status NOT NULL DEFAULT 'pendiente',
  submitted_at TIMESTAMPTZ NOT NULL DEFAULT now(),

  -- La decisión del dueño. En un rechazo, el motivo lo lee el vendedor.
  decided_by     UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  decided_at     TIMESTAMPTZ,
  decision_notes TEXT,

  -- Congelado al aprobar (ver el punto 2 de arriba).
  plan_monthly      NUMERIC(12,2),
  commission_pct    NUMERIC(5,2),
  commission_amount NUMERIC(12,2) CHECK (commission_amount IS NULL OR commission_amount >= 0),
  -- El mes del saldo: primer día del mes (hora argentina) en que se aprobó.
  period            DATE CHECK (period IS NULL OR extract(day FROM period) = 1),
  settlement_id     UUID REFERENCES sovare.vendor_settlements(id) ON DELETE SET NULL,

  voided_at  TIMESTAMPTZ,
  void_notes TEXT,

  -- La ficha de cliente que salió de esta venta, si se creó.
  client_id UUID REFERENCES sovare.clients(id) ON DELETE SET NULL,

  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),

  -- Hay que poder encontrar al cliente: sin teléfono ni mail no se puede
  -- verificar nada de lo que cargó el vendedor.
  CONSTRAINT vendor_sale_contacto CHECK (
    nullif(btrim(coalesce(whatsapp, '')), '') IS NOT NULL
    OR nullif(btrim(coalesce(email, '')), '') IS NOT NULL
  ),
  -- Una venta aprobada sin importe ni mes no se puede sumar a ningún saldo.
  CONSTRAINT vendor_sale_aprobada_completa CHECK (
    status <> 'aprobada'
    OR (commission_amount IS NOT NULL AND period IS NOT NULL AND plan IS NOT NULL)
  ),
  -- Sólo lo aprobado se liquida.
  CONSTRAINT vendor_sale_liquidada_es_aprobada CHECK (settlement_id IS NULL OR status = 'aprobada')
);

CREATE TRIGGER vendor_sales_touch
  BEFORE UPDATE ON sovare.vendor_sales
  FOR EACH ROW EXECUTE FUNCTION sovare.touch_updated_at();

CREATE INDEX vendor_sales_vendor_idx  ON sovare.vendor_sales (vendor_id, status, submitted_at DESC);
CREATE INDEX vendor_sales_pending_idx ON sovare.vendor_sales (submitted_at) WHERE status = 'pendiente';
CREATE INDEX vendor_sales_settle_idx  ON sovare.vendor_sales (settlement_id) WHERE settlement_id IS NOT NULL;

-- El mismo vendedor no puede tener dos veces al mismo negocio pendiente o
-- aprobado. Cubre el doble clic en "Cargar", que si no mandaría dos ventas.
--
-- Entre vendedores distintos NO se bloquea: dos personas pueden ofrecerle el
-- sistema al mismo local, y quién lo cerró es una decisión del dueño. Para eso
-- está sovare.sale_matches(), que lo muestra al revisar.
CREATE UNIQUE INDEX vendor_sales_sin_repetir
  ON sovare.vendor_sales (vendor_id, business_norm)
  WHERE status IN ('pendiente', 'aprobada');

-- ============================================
-- Saldo por vendedor y mes
-- ============================================
-- security_invoker: la vista lee con los permisos de quien la consulta. Sin eso
-- correría con los del dueño de la vista y saltearía RLS.
CREATE VIEW sovare.vendor_period_balances
WITH (security_invoker = true) AS
SELECT
  vendor_id,
  period,
  (period = sovare.current_period())                                         AS is_current,
  count(*)::int                                                              AS sales_count,
  sum(commission_amount)                                                     AS accrued,
  coalesce(sum(commission_amount) FILTER (WHERE settlement_id IS NULL), 0)   AS unsettled,
  (count(*) FILTER (WHERE settlement_id IS NULL))::int                       AS unsettled_count
FROM sovare.vendor_sales
WHERE status = 'aprobada'
GROUP BY vendor_id, period;

-- ============================================
-- Aprobar o rechazar una venta
-- ============================================
-- SECURITY INVOKER (el valor por defecto): corre con los permisos de quien la
-- llama, así que RLS sigue valiendo. El chequeo de is_admin() de adentro no es
-- redundante: es lo que da un mensaje claro en vez de un "0 filas".
CREATE OR REPLACE FUNCTION sovare.decide_vendor_sale(
  p_sale     UUID,
  p_decision TEXT,
  p_plan     TEXT    DEFAULT NULL,
  p_amount   NUMERIC DEFAULT NULL,
  p_notes    TEXT    DEFAULT NULL
)
RETURNS sovare.vendor_sales
LANGUAGE plpgsql
SET search_path = sovare, public
AS $$
DECLARE
  v_sale   sovare.vendor_sales;
  v_plan   sovare.plans;
  v_pct    NUMERIC;
  v_amount NUMERIC;
BEGIN
  IF NOT sovare.is_admin() THEN
    RAISE EXCEPTION 'No tenés permiso.' USING ERRCODE = '42501';
  END IF;

  -- FOR UPDATE: dos clics casi juntos no pueden aprobar la misma venta dos veces.
  SELECT * INTO v_sale FROM sovare.vendor_sales WHERE id = p_sale FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'No encontramos esa venta.';
  END IF;
  IF v_sale.status <> 'pendiente' THEN
    RAISE EXCEPTION 'Esta venta ya está resuelta.';
  END IF;

  IF p_decision = 'rechazada' THEN
    IF nullif(btrim(coalesce(p_notes, '')), '') IS NULL THEN
      RAISE EXCEPTION 'Contale el motivo: el vendedor lo va a leer.';
    END IF;

    UPDATE sovare.vendor_sales
       SET status = 'rechazada', decided_by = auth.uid(), decided_at = now(),
           decision_notes = btrim(p_notes)
     WHERE id = p_sale
     RETURNING * INTO v_sale;
    RETURN v_sale;
  END IF;

  IF p_decision <> 'aprobada' THEN
    RAISE EXCEPTION 'Decisión inválida.';
  END IF;

  SELECT * INTO v_plan FROM sovare.plans WHERE code = coalesce(p_plan, v_sale.plan);
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Elegí el plan que contrató.';
  END IF;
  IF NOT v_plan.is_active THEN
    RAISE EXCEPTION 'Ese plan ya no se vende.';
  END IF;

  SELECT commission_pct INTO v_pct FROM sovare.vendors WHERE id = v_sale.vendor_id;

  -- Sin importe explícito, la comisión es el porcentaje del vendedor sobre la
  -- cuota mensual del plan (sin la puesta a punto). Redondeada a pesos enteros.
  v_amount := coalesce(p_amount, round(v_plan.monthly * v_pct / 100));
  IF v_amount < 0 THEN
    RAISE EXCEPTION 'La comisión no puede ser negativa.';
  END IF;

  UPDATE sovare.vendor_sales
     SET status = 'aprobada',
         plan = v_plan.code,
         plan_monthly = v_plan.monthly,
         commission_pct = v_pct,
         commission_amount = v_amount,
         period = sovare.current_period(),
         decided_by = auth.uid(),
         decided_at = now(),
         decision_notes = nullif(btrim(coalesce(p_notes, '')), '')
   WHERE id = p_sale
   RETURNING * INTO v_sale;

  RETURN v_sale;
END;
$$;

-- ============================================
-- Anular una venta aprobada
-- ============================================
-- Sólo mientras no esté liquidada. Una vez liquidada, la plata ya se juntó en
-- una transferencia: para tocarla hay que deshacer la liquidación primero.
CREATE OR REPLACE FUNCTION sovare.void_vendor_sale(p_sale UUID, p_notes TEXT)
RETURNS sovare.vendor_sales
LANGUAGE plpgsql
SET search_path = sovare, public
AS $$
DECLARE
  v_sale sovare.vendor_sales;
BEGIN
  IF NOT sovare.is_admin() THEN
    RAISE EXCEPTION 'No tenés permiso.' USING ERRCODE = '42501';
  END IF;

  SELECT * INTO v_sale FROM sovare.vendor_sales WHERE id = p_sale FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'No encontramos esa venta.';
  END IF;
  IF v_sale.status <> 'aprobada' THEN
    RAISE EXCEPTION 'Sólo se puede anular una venta aprobada.';
  END IF;
  IF v_sale.settlement_id IS NOT NULL THEN
    RAISE EXCEPTION 'Esta venta ya está en una liquidación. Deshacé la liquidación para poder anularla.';
  END IF;
  IF nullif(btrim(coalesce(p_notes, '')), '') IS NULL THEN
    RAISE EXCEPTION 'Anotá por qué se anula.';
  END IF;

  UPDATE sovare.vendor_sales
     SET status = 'anulada', voided_at = now(), void_notes = btrim(p_notes)
   WHERE id = p_sale
   RETURNING * INTO v_sale;

  RETURN v_sale;
END;
$$;

-- ============================================
-- Liquidar un mes
-- ============================================
-- Junta todo lo aprobado y sin liquidar de ese vendedor y ese mes en una
-- liquidación. El total se calcula con las mismas filas que se marcan: no hay
-- forma de que una venta cuente en el total y quede sin marcar, o al revés.
CREATE OR REPLACE FUNCTION sovare.settle_vendor_period(p_vendor UUID, p_period DATE)
RETURNS sovare.vendor_settlements
LANGUAGE plpgsql
SET search_path = sovare, public
AS $$
DECLARE
  v_period DATE := date_trunc('month', p_period)::date;
  v_id     UUID := gen_random_uuid();
  v_count  INTEGER;
  v_total  NUMERIC;
  v_row    sovare.vendor_settlements;
BEGIN
  IF NOT sovare.is_admin() THEN
    RAISE EXCEPTION 'No tenés permiso.' USING ERRCODE = '42501';
  END IF;
  IF v_period > sovare.current_period() THEN
    RAISE EXCEPTION 'Ese mes todavía no empezó.';
  END IF;

  -- Bloquea al vendedor: dos liquidaciones simultáneas del mismo mes se
  -- pisarían. La segunda espera, no encuentra nada para liquidar, y avisa.
  PERFORM 1 FROM sovare.vendors WHERE id = p_vendor FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'No encontramos al vendedor.';
  END IF;

  INSERT INTO sovare.vendor_settlements (id, vendor_id, period, sales_count, total, settled_by)
  VALUES (v_id, p_vendor, v_period, 0, 0, auth.uid());

  WITH moved AS (
    UPDATE sovare.vendor_sales
       SET settlement_id = v_id
     WHERE vendor_id = p_vendor
       AND status = 'aprobada'
       AND settlement_id IS NULL
       AND period = v_period
    RETURNING commission_amount
  )
  SELECT count(*), coalesce(sum(commission_amount), 0) INTO v_count, v_total FROM moved;

  -- Al lanzar el error se deshace también el INSERT de arriba.
  IF v_count = 0 THEN
    RAISE EXCEPTION 'No hay nada para liquidar en ese mes.';
  END IF;

  UPDATE sovare.vendor_settlements
     SET sales_count = v_count, total = v_total
   WHERE id = v_id
   RETURNING * INTO v_row;

  RETURN v_row;
END;
$$;

-- ============================================
-- Deshacer una liquidación
-- ============================================
-- Sólo si todavía no se marcó como pagada. Las ventas vuelven al saldo y la
-- liquidación queda como 'anulada' (no se borra, ver más arriba).
CREATE OR REPLACE FUNCTION sovare.unsettle_vendor(p_settlement UUID)
RETURNS VOID
LANGUAGE plpgsql
SET search_path = sovare, public
AS $$
DECLARE
  v_row sovare.vendor_settlements;
BEGIN
  IF NOT sovare.is_admin() THEN
    RAISE EXCEPTION 'No tenés permiso.' USING ERRCODE = '42501';
  END IF;

  SELECT * INTO v_row FROM sovare.vendor_settlements WHERE id = p_settlement FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'No encontramos esa liquidación.';
  END IF;
  IF v_row.status = 'pagada' THEN
    RAISE EXCEPTION 'Ya está marcada como pagada. Deshacé el pago primero.';
  END IF;
  IF v_row.status = 'anulada' THEN
    RAISE EXCEPTION 'Esa liquidación ya estaba deshecha.';
  END IF;

  UPDATE sovare.vendor_sales SET settlement_id = NULL WHERE settlement_id = p_settlement;
  UPDATE sovare.vendor_settlements SET status = 'anulada' WHERE id = p_settlement;
END;
$$;

-- ============================================
-- Marcar una liquidación como pagada (o deshacerlo)
-- ============================================
CREATE OR REPLACE FUNCTION sovare.mark_settlement_paid(
  p_settlement UUID,
  p_paid       BOOLEAN,
  p_reference  TEXT DEFAULT NULL
)
RETURNS sovare.vendor_settlements
LANGUAGE plpgsql
SET search_path = sovare, public
AS $$
DECLARE
  v_row sovare.vendor_settlements;
BEGIN
  IF NOT sovare.is_admin() THEN
    RAISE EXCEPTION 'No tenés permiso.' USING ERRCODE = '42501';
  END IF;

  UPDATE sovare.vendor_settlements
     SET status = CASE WHEN p_paid THEN 'pagada' ELSE 'liquidada' END::sovare.settlement_status,
         paid_at = CASE WHEN p_paid THEN now() END,
         paid_reference = CASE WHEN p_paid THEN nullif(btrim(coalesce(p_reference, '')), '') END
   WHERE id = p_settlement AND status <> 'anulada'
   RETURNING * INTO v_row;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'No encontramos esa liquidación, o ya estaba deshecha.';
  END IF;
  RETURN v_row;
END;
$$;

-- ============================================
-- Coincidencias de una venta
-- ============================================
-- Para revisar con el contexto delante: ¿este cliente ya lo cargó otro
-- vendedor, ya contrató desde la página, ya es una ficha? Es la diferencia
-- entre aprobar a ciegas y saber a quién le estás por pagar.
--
-- Compara por mail, teléfono y nombre de negocio, normalizados.
CREATE OR REPLACE FUNCTION sovare.sale_matches(p_sale UUID)
RETURNS TABLE (kind TEXT, ref_id UUID, label TEXT, status TEXT, detail TEXT)
LANGUAGE sql STABLE
SET search_path = sovare, public
AS $$
  WITH s AS (
    SELECT * FROM sovare.vendor_sales WHERE id = p_sale AND sovare.is_admin()
  )
  SELECT 'venta'::text, o.id, o.business_name, o.status::text,
         'Cargada por ' || v.name || ' el '
           || to_char(o.submitted_at AT TIME ZONE 'America/Argentina/Buenos_Aires', 'DD/MM/YYYY')
    FROM s
    JOIN sovare.vendor_sales o ON o.id <> s.id
    JOIN sovare.vendors v ON v.id = o.vendor_id
   WHERE (s.email_norm IS NOT NULL AND o.email_norm = s.email_norm)
      OR (s.whatsapp_norm IS NOT NULL AND o.whatsapp_norm = s.whatsapp_norm)
      OR o.business_norm = s.business_norm

  UNION ALL

  SELECT 'contratacion'::text, g.id, g.business_name, g.status::text,
         'Plan ' || g.plan || ', el '
           || to_char(g.created_at AT TIME ZONE 'America/Argentina/Buenos_Aires', 'DD/MM/YYYY')
    FROM s
    JOIN sovare.signups g
      ON (s.email_norm IS NOT NULL AND lower(btrim(g.email)) = s.email_norm)
      OR (s.whatsapp_norm IS NOT NULL
          AND right(regexp_replace(coalesce(g.whatsapp, ''), '\D', '', 'g'), 10) = s.whatsapp_norm)
      OR lower(btrim(g.business_name)) = s.business_norm

  UNION ALL

  SELECT 'cliente'::text, c.id, c.business_name, c.status::text,
         coalesce(c.plan, 'Sin plan') || ', alta ' || coalesce(to_char(c.started_at, 'DD/MM/YYYY'), 'sin fecha')
    FROM s
    JOIN sovare.clients c
      ON (s.email_norm IS NOT NULL AND lower(btrim(coalesce(c.email, ''))) = s.email_norm)
      OR (s.whatsapp_norm IS NOT NULL
          AND right(regexp_replace(coalesce(c.whatsapp, ''), '\D', '', 'g'), 10) = s.whatsapp_norm)
      OR lower(btrim(c.business_name)) = s.business_norm;
$$;

-- ============================================
-- RLS
-- ============================================
ALTER TABLE sovare.vendors            ENABLE ROW LEVEL SECURITY;
ALTER TABLE sovare.vendor_sales       ENABLE ROW LEVEL SECURITY;
ALTER TABLE sovare.vendor_settlements ENABLE ROW LEVEL SECURITY;

CREATE POLICY "admins manejan vendedores" ON sovare.vendors
  FOR ALL TO authenticated USING (sovare.is_admin()) WITH CHECK (sovare.is_admin());

CREATE POLICY "admins manejan ventas de vendedores" ON sovare.vendor_sales
  FOR ALL TO authenticated USING (sovare.is_admin()) WITH CHECK (sovare.is_admin());

CREATE POLICY "admins manejan liquidaciones" ON sovare.vendor_settlements
  FOR ALL TO authenticated USING (sovare.is_admin()) WITH CHECK (sovare.is_admin());

-- ============================================
-- Permisos
-- ============================================
-- anon no recibe nada: ni siquiera tiene USAGE sobre el esquema.
GRANT SELECT, INSERT, UPDATE, DELETE
  ON sovare.vendors, sovare.vendor_sales, sovare.vendor_settlements
  TO authenticated;
GRANT SELECT ON sovare.vendor_period_balances TO authenticated;

-- La service role de la landing recibe automáticamente todo en este esquema
-- (ALTER DEFAULT PRIVILEGES de 002_signups). Acá se recorta a lo que esa página
-- usa de verdad. Con esto un error en el código de la landing no puede aprobar
-- una venta, cambiar un porcentaje ni marcar nada como pagado.
REVOKE ALL ON sovare.vendors, sovare.vendor_sales, sovare.vendor_settlements,
              sovare.vendor_period_balances FROM service_role;
GRANT SELECT         ON sovare.vendors            TO service_role;
GRANT SELECT, INSERT ON sovare.vendor_sales       TO service_role;
GRANT SELECT         ON sovare.vendor_settlements TO service_role;
GRANT SELECT         ON sovare.vendor_period_balances TO service_role;

-- Las funciones de plata las ejecuta sólo el panel, con sesión de administrador.
-- REVOKE FROM PUBLIC y no sólo de anon: PostgreSQL otorga EXECUTE a PUBLIC por
-- defecto, y revocárselo a un rol puntual no le saca el que hereda de PUBLIC.
REVOKE EXECUTE ON FUNCTION sovare.decide_vendor_sale(UUID, TEXT, TEXT, NUMERIC, TEXT) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION sovare.void_vendor_sale(UUID, TEXT)                         FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION sovare.settle_vendor_period(UUID, DATE)                     FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION sovare.unsettle_vendor(UUID)                                FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION sovare.mark_settlement_paid(UUID, BOOLEAN, TEXT)            FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION sovare.sale_matches(UUID)                                   FROM PUBLIC;

GRANT EXECUTE ON FUNCTION sovare.decide_vendor_sale(UUID, TEXT, TEXT, NUMERIC, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION sovare.void_vendor_sale(UUID, TEXT)                         TO authenticated;
GRANT EXECUTE ON FUNCTION sovare.settle_vendor_period(UUID, DATE)                     TO authenticated;
GRANT EXECUTE ON FUNCTION sovare.unsettle_vendor(UUID)                                TO authenticated;
GRANT EXECUTE ON FUNCTION sovare.mark_settlement_paid(UUID, BOOLEAN, TEXT)            TO authenticated;
GRANT EXECUTE ON FUNCTION sovare.sale_matches(UUID)                                   TO authenticated;

-- Que la API vea las tablas y funciones nuevas sin esperar al próximo reinicio.
NOTIFY pgrst, 'reload schema';
