-- SOVARE — Índices para las claves foráneas que se recorren al borrar
-- ============================================
-- Postgres indexa sola la clave primaria, no las foráneas. Cuando se borra una
-- fila del lado "padre", tiene que buscar en cada tabla que la referencia para
-- aplicar el ON DELETE; sin índice, esa búsqueda es un recorrido completo de la
-- tabla hija, una vez por fila borrada.
--
-- Acá eso no es teórico: la demo le da a cada visitante su propia copia y después
-- la limpia, así que `DELETE FROM auth.users` corre seguido. Cada una de esas
-- bajas obliga hoy a recorrer entero `signups`, `vendor_sales` y
-- `vendor_settlements` para poner en NULL las columnas que apuntan al usuario,
-- aunque ninguna de las tres tenga nada que ver con la demo. Con cuatro filas no
-- se nota; con unos miles de contrataciones y ventas, cada visita a la demo
-- empieza a pagarlo.
--
-- Sólo van las que están en un camino de borrado real. `vendor_sales.plan`
-- también es una foránea sin índice, pero apunta a `plans`, que es una tabla de
-- referencia de cinco filas que no se borra nunca: un índice ahí sería peso
-- muerto.

-- Las tres que mira cada baja de un usuario.
CREATE INDEX IF NOT EXISTS idx_sovare_signups_owner_user
  ON sovare.signups (owner_user_id);

CREATE INDEX IF NOT EXISTS idx_sovare_vendor_sales_decided_by
  ON sovare.vendor_sales (decided_by);

CREATE INDEX IF NOT EXISTS idx_sovare_vendor_settlements_settled_by
  ON sovare.vendor_settlements (settled_by);

-- Y la que mira cada baja de un cliente. Esta además se usa para leer: es cómo
-- se averigua de qué venta de un vendedor salió un cliente.
CREATE INDEX IF NOT EXISTS idx_sovare_vendor_sales_client
  ON sovare.vendor_sales (client_id);
