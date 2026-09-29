-- ============================================
-- 008 — El seguimiento público de pedido, que nunca funcionó
-- ============================================
--
-- `getOrderTracking` decía en un comentario que se resolvía "acá y no vía RLS,
-- porque los pedidos no son legibles por anónimos". La intención era la
-- correcta, pero la implementación leía `orders` de frente con el cliente
-- anónimo: RLS no tiene (ni debe tener) policy de SELECT para anónimos, así que
-- la consulta volvía vacía siempre y la pantalla decía "Pedido no encontrado"
-- para todos los pedidos, incluido el que el cliente acababa de hacer.
--
-- Esta función es lo que el comentario describía: SECURITY DEFINER, devuelve
-- sólo los campos que le sirven a quien encargó y nada más.
--
-- Del nombre sale sólo la primera palabra. Los números de pedido son
-- correlativos, así que cualquiera puede probar del 1 al 500; que eso devuelva
-- "A nombre de Juan" está bien, que devuelva el apellido completo de toda la
-- clientela del negocio no.

CREATE OR REPLACE FUNCTION get_order_tracking(
  p_business_id uuid,
  p_order_number integer
) RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT jsonb_build_object(
    'order_number',    o.order_number,
    'status',          o.status,
    'contact_name',    split_part(btrim(o.contact_name), ' ', 1),
    'delivery_date',   o.delivery_date,
    'delivery_method', o.delivery_method,
    'subtotal',        o.subtotal,
    'created_at',      o.created_at,
    'items', coalesce((
      SELECT jsonb_agg(jsonb_build_object(
               'name',       i.item_name,
               'quantity',   i.quantity,
               'unit_price', i.unit_price,
               'subtotal',   i.subtotal
             ) ORDER BY i.item_name)
        FROM order_items i WHERE i.order_id = o.id), '[]'::jsonb),
    'timeline', coalesce((
      SELECT jsonb_agg(jsonb_build_object(
               'status', h.to_status,
               'date',   h.created_at,
               'notes',  h.notes
             ) ORDER BY h.created_at)
        FROM order_status_history h WHERE h.order_id = o.id), '[]'::jsonb)
  )
  FROM orders o
  WHERE o.business_id = p_business_id
    AND o.order_number = p_order_number
    AND is_storefront_open(o.business_id);
$$;

REVOKE ALL ON FUNCTION get_order_tracking(uuid, integer) FROM public;
GRANT EXECUTE ON FUNCTION get_order_tracking(uuid, integer) TO anon, authenticated;
