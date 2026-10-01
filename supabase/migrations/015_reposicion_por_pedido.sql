-- Un tipo de movimiento para cuando el stock vuelve.
--
-- Hasta ahora el stock sólo sabía salir: un pedido que se confirmaba
-- descontaba, y si después se cancelaba no pasaba nada. El inventario quedaba
-- bajo para siempre, y como las alertas de faltante miran ese número, el
-- negocio empezaba a ver avisos de productos que sí tenía.
--
-- La reposición es un movimiento más, con su fila y su nota, no un retoque
-- silencioso del número: en el historial del producto se ve de qué pedido vino
-- y por qué, y el negocio puede corregir a mano si la realidad fue otra.

ALTER TABLE public.stock_movements
  DROP CONSTRAINT IF EXISTS stock_movements_movement_type_check;

ALTER TABLE public.stock_movements
  ADD CONSTRAINT stock_movements_movement_type_check
  CHECK (movement_type = ANY (ARRAY[
    'purchase',
    'production',
    'order_deduction',
    'production_consumption',
    'order_reversal',
    'adjustment',
    'waste'
  ]));
