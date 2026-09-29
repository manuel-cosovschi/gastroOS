-- ============================================
-- 009 — Notificaciones push del panel
-- ============================================
-- Cada navegador que acepta notificaciones deja acá su suscripción: la URL del
-- servicio de push del fabricante (Google, Apple, Mozilla) más dos claves con
-- las que se cifra el mensaje.
--
-- Una persona puede tener varias: el teléfono y la computadora son dos
-- suscripciones distintas, y quien quiere enterarse de un pedido a las once de
-- la noche lo quiere en el teléfono. Por eso la clave es el endpoint y no el
-- usuario.

CREATE TABLE push_subscriptions (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  user_id     UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

  -- El endpoint identifica al navegador: si el mismo vuelve a suscribirse,
  -- se actualizan las claves en vez de duplicar la fila.
  endpoint TEXT NOT NULL UNIQUE,
  p256dh   TEXT NOT NULL,
  auth     TEXT NOT NULL,

  -- Para poder decir "Chrome en Android" en la pantalla de ajustes, y que se
  -- entienda cuál de las tres suscripciones es la del teléfono.
  user_agent TEXT,

  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_used_at TIMESTAMPTZ
);

CREATE INDEX push_subscriptions_business_idx ON push_subscriptions (business_id);

ALTER TABLE push_subscriptions ENABLE ROW LEVEL SECURITY;

-- Cada uno maneja las suyas. Un miembro del negocio no tiene por qué poder
-- borrarle la suscripción a otro desde su propia pantalla de ajustes.
CREATE POLICY "members manage own subscriptions" ON push_subscriptions
  FOR ALL USING (user_id = auth.uid() AND is_business_member(business_id))
  WITH CHECK (user_id = auth.uid() AND is_business_member(business_id));

-- La tienda pública no lee ni escribe esto: quien manda el aviso de un pedido
-- nuevo es el servidor, con la service role.
REVOKE ALL ON push_subscriptions FROM anon;

/**
 * Las suscripciones de un negocio, para mandarles el aviso.
 *
 * SECURITY DEFINER porque el aviso de un pedido de la tienda lo dispara una
 * acción sin sesión: quien acaba de encargar una torta no es miembro de nada.
 * Devuelve sólo lo que hace falta para cifrar y enviar, y nunca el user_id.
 */
CREATE OR REPLACE FUNCTION business_push_targets(p_business_id uuid)
RETURNS TABLE (endpoint text, p256dh text, auth text)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT s.endpoint, s.p256dh, s.auth
  FROM push_subscriptions s
  WHERE s.business_id = p_business_id;
$$;

-- Sólo el servidor. La anon key es pública: si esto fuera ejecutable desde el
-- navegador, cualquiera podría sacar las suscripciones de cualquier negocio.
REVOKE ALL ON FUNCTION business_push_targets(uuid) FROM public, anon, authenticated;
