-- Apretar tuercas: lo que marcó la auditoría de la base.
--
-- Nada de esto cambia cómo se comporta el sistema. Son tres cosas que el
-- revisor de Supabase viene señalando y que conviene dejar resueltas antes de
-- que haya clientes de verdad adentro.

-- ---------------------------------------------------------------------------
-- 1. Funciones con el camino de búsqueda fijo
--
-- Una función sin `search_path` resuelve los nombres con el camino de quien la
-- llama. Estas cuatro no tocan ninguna tabla —`now()`, `md5()`,
-- `split_part()`— así que hoy no hay nada que secuestrar, pero dejarlo fijo
-- cuesta nada y cierra la puerta para siempre.
-- ---------------------------------------------------------------------------

ALTER FUNCTION public.update_updated_at() SET search_path = public;
ALTER FUNCTION public.demo_copy_id(uuid, uuid) SET search_path = public;
ALTER FUNCTION public.media_owner(text) SET search_path = public;
ALTER FUNCTION sovare.touch_updated_at() SET search_path = sovare, public;

-- ---------------------------------------------------------------------------
-- 2. Dos funciones que nadie necesita poder llamar
--
-- `assign_order_number` es el disparador que numera los pedidos: Postgres
-- chequea el permiso al crear el disparador, no cada vez que se dispara, así
-- que sacarle el permiso de ejecución no lo afecta.
--
-- `current_business_id` quedó del esquema de un solo negocio. Ninguna política
-- la usa y el código tampoco. Mientras siga existiendo con permiso para todos,
-- es una función SECURITY DEFINER colgada al alcance de cualquiera.
-- ---------------------------------------------------------------------------

REVOKE EXECUTE ON FUNCTION public.assign_order_number() FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.current_business_id() FROM anon, authenticated;

-- ---------------------------------------------------------------------------
-- 3. Las políticas que llamaban a auth.uid() una vez por fila
--
-- Envuelto en un `select`, Postgres lo resuelve una sola vez por consulta en
-- lugar de una vez por fila. Mismo permiso, mismo resultado.
-- ---------------------------------------------------------------------------

ALTER POLICY "members read own memberships" ON public.business_members
  USING (user_id = (SELECT auth.uid()));

ALTER POLICY "members manage own subscriptions" ON public.push_subscriptions
  USING (user_id = (SELECT auth.uid()) AND is_business_member(business_id))
  WITH CHECK (user_id = (SELECT auth.uid()) AND is_business_member(business_id));

-- ---------------------------------------------------------------------------
-- 4. Índices en las claves foráneas que no los tenían
--
-- Sin esto, borrar un producto obliga a recorrer entero `order_items` para ver
-- si alguien lo pidió alguna vez. Con pocos datos no se nota; con un año de
-- pedidos encima, sí.
-- ---------------------------------------------------------------------------

CREATE INDEX IF NOT EXISTS idx_order_items_product ON public.order_items (product_id);
CREATE INDEX IF NOT EXISTS idx_order_items_package ON public.order_items (package_id);
CREATE INDEX IF NOT EXISTS idx_package_items_product ON public.package_items (product_id);
CREATE INDEX IF NOT EXISTS idx_push_subscriptions_user ON public.push_subscriptions (user_id);
CREATE INDEX IF NOT EXISTS idx_stock_movements_order ON public.stock_movements (order_id);

CREATE INDEX IF NOT EXISTS idx_sovare_signups_client ON sovare.signups (client_id);
CREATE INDEX IF NOT EXISTS idx_sovare_signups_decided_by ON sovare.signups (decided_by);
CREATE INDEX IF NOT EXISTS idx_sovare_signups_plan ON sovare.signups (plan);
