# Auditoría de GastroOS — 1 de octubre de 2026

Revisión completa de la página, la tienda, el panel y la base. Lo que sigue
separa tres cosas: lo que estaba roto y ya arreglé, lo que revisé y está bien, y
lo que queda anotado sin urgencia.

Encontré **tres bugs de verdad**. Los tres están arreglados, probados contra la
base real y en producción. Hay una sola decisión de negocio ahí adentro —qué
pasa con los insumos cuando se cancela un pedido ya en producción— que resolví
con el criterio que me parece correcto y que está marcada abajo para que la
cambies si no coincidís.

---

## 1. Lo que estaba roto y ya está arreglado

### 1.1 El stock se descontaba una vez y nunca volvía

Era el bug más caro de los tres, porque no se ve: el número queda mal y nadie se
entera hasta que no cierran las cuentas.

`updateOrderStatus` descontaba el stock una sola vez, al salir de "pendiente".
El comentario del código lo decía tal cual: *"El stock se descuenta una sola
vez, al salir de 'pendiente'"*. Pero las transiciones permitidas incluyen
`confirmado → cancelado`, `en preparación → cancelado` y `listo → cancelado`, y
**no había ningún movimiento de reversa en todo `src/actions/inventory.ts`**.

Cancelar un pedido confirmado dejaba el inventario bajo para siempre. Y como las
alertas de faltante miran ese número, el negocio empezaba a ver avisos de
productos que sí tenía, y a reponer de más.

Lo mismo al editar las cantidades de un pedido ya confirmado: se recalculaban el
total y el costo, se reemplazaba el detalle, y el stock quedaba descontado por
las cantidades viejas.

**Cómo quedó.** Hay una función nueva, `reverseStockForOrder`, que no recalcula
nada a partir de las líneas del pedido: lee los movimientos que el descuento
dejó registrados en `stock_movements` y los invierte. Eso importa porque las
líneas pueden haber cambiado entre el descuento y la devolución, y porque lo que
hay que devolver es exactamente lo que salió. Es idempotente: cada reposición
queda registrada, así que un segundo intento no devuelve nada dos veces.

La devolución no es un retoque silencioso del número: deja su fila en el
historial del producto, con el tipo "Reposición por pedido" y la nota "Pedido
#38: vuelven 1 × Box Cumpleaños". Se ve de dónde vino.

**La decisión de negocio, que es la única que hay acá.** Qué vuelve depende de
cuándo se cancela:

| Se cancela desde | Producto terminado | Insumos |
|---|---|---|
| Confirmado | vuelve | vuelven |
| En preparación | vuelve | **no vuelven** |
| Listo | vuelve | **no vuelven** |

El razonamiento: el producto terminado vuelve siempre, porque sigue existiendo —
está en la heladera. Los insumos se descuentan al confirmar, contando la
producción que va a hacer falta; si el pedido se cae antes de empezar a producir,
esa harina sigue en el depósito. Si ya se produjo, la torta está hecha y la
harina no vuelve.

Si para tu caso tiene que ser otra cosa, es una línea: el parámetro se llama
`incluirInsumos` y hoy vale `currentStatus === 'confirmed'`.

Al editar las cantidades de un pedido ya confirmado, en cambio, se devuelve todo
y se vuelve a descontar con las cantidades nuevas. El neto es la diferencia, y de
paso vuelve a decidir qué sale de producto terminado y qué hay que producir, que
con las cantidades nuevas puede no ser lo mismo.

**Probado de punta a punta** en el panel, contra la base real: confirmar el
pedido #38 bajó el stock de "Box Cumpleaños" de 4 a 3 y dejó un movimiento de
−1; cancelarlo lo devolvió a 4 con un movimiento de +1. Después dejé la
plantilla de la demo exactamente como estaba.

Migración `015_reposicion_por_pedido.sql` (el tipo de movimiento nuevo), aplicada.

### 1.2 El pedido de la tienda no se revisaba del lado del servidor

Este es el hallazgo más importante.

`create_storefront_order` —la función que crea el pedido— es ejecutable por el
rol anónimo, y **tiene que serlo**: la tienda es pública y la clave anónima
viaja en el navegador de quien entra. Eso significa que la función se puede
llamar de frente, por HTTP, sin pasar nunca por la pantalla de pedido.

Los precios ya estaban bien: la función los toma del catálogo filtrado por
negocio y producto activo, nunca de lo que llega de afuera. Pero todo lo demás
lo chequeaba **únicamente el formulario**:

| Qué | Qué chequeaba el navegador | Qué chequeaba el servidor |
|---|---|---|
| Fecha de entrega | no anterior a hoy, y con la anticipación mínima | sólo que no viniera vacía |
| Cantidad | mínimo del producto, sin tope | sólo que fuera mayor a cero |
| Mínimo por producto | sí | no |
| Largo de los textos | nada | nada |
| Email | formato válido | nada |

Lo que valida sólo el navegador, no está validado. Y no hace falta mala
intención para que esto duela: **alcanza con una pestaña abierta desde anoche**
para que entre un pedido con fecha de ayer, que después cae en el calendario en
un día que ya pasó, donde nadie lo mira.

Ahora la función, antes de crear nada:

- compara la fecha contra el día **del negocio**, no del servidor. A las 22 en
  Buenos Aires, en Postgres ya es mañana: la zona sale de `businesses.timezone`;
- acota las cantidades entre 1 y 9999, y las líneas del pedido a 100;
- respeta el mínimo por producto que el negocio cargó en el panel;
- corta los textos desmedidos (nombre, teléfono, email, dirección, comentarios).

Y `storefrontOrderSchema`, que existía en el código sin que nadie lo llamara,
ahora corre en la acción del servidor antes de llegar a la función.

Probado: las cuatro guardas rechazan lo que tienen que rechazar, y un pedido
legítimo entra igual que antes (pedido de prueba creado y después borrado, con
la numeración devuelta a donde estaba).

Migración `014_pedido_tienda_a_prueba.sql`, aplicada.

### 1.3 Reemplazar las líneas de un pedido podía dejarlo vacío con total

En `updateOrder`, cuando se cambian los items, el detalle se reemplaza en dos
pasos: borrar las líneas viejas, insertar las nuevas. **El error de la
inserción no se miraba en absoluto.** Si el segundo paso fallaba, el pedido
quedaba con el total nuevo escrito y sin una sola línea adentro: en la lista
parece un pedido de cero pesos, y no se puede ni preparar ni facturar.

Ahora se leen las líneas de antes, se mira el error, y si la inserción falla se
reponen y la pantalla avisa.

### 1.4 Diez botones que un lector de pantalla no sabía nombrar

En el carrito, el catálogo, categorías y el armado de combos había diez botones
que son sólo un ícono. Un lector de pantalla los anunciaba como "botón" a
secas. Ahora tienen nombre, y donde el botón actúa sobre algo concreto el nombre
lo dice: "Sumar uno de Torta de chocolate", no "sumar".

### 1.5 Cuatro cosas de la base

Lo que venía marcando el revisor de Supabase, resuelto en
`013_apretar_tuercas.sql`:

- **Cuatro funciones sin `search_path` fijo.** Ninguna tocaba tablas, así que no
  había nada que secuestrar, pero dejarlo fijo no cuesta nada.
- **Dos funciones `SECURITY DEFINER` al alcance de cualquiera.**
  `assign_order_number` (el disparador que numera los pedidos) y
  `current_business_id` (sobra del esquema de un solo negocio: ninguna política
  la usa, el código tampoco) estaban expuestas como endpoints RPC. Revocadas.
  Verifiqué que la numeración sigue funcionando: Postgres chequea el permiso al
  crear el disparador, no cada vez que se dispara.
- **Dos políticas que llamaban a `auth.uid()` una vez por fila.** Envueltas en
  un `select`, se resuelven una vez por consulta.
- **Ocho claves foráneas sin índice.** Sin eso, borrar un producto obliga a
  recorrer entero `order_items`. Con pocos datos no se nota; con un año de
  pedidos encima, sí.

Después de esto, de las advertencias de rendimiento que había quedan dos
grupos, los dos a propósito (ver punto 3).

---

## 2. Lo que revisé y está bien

- **Precios.** El pedido público nunca manda precios: manda ids y cantidades, y
  la función los busca en el catálogo del negocio. Un precio que llega de afuera
  no es un precio, y acá no llega de afuera.
- **Numeración de pedidos.** Correlativa por negocio, sin huecos ni repetidos.
  Probado con un pedido real de punta a punta.
- **Separación entre negocios.** Las políticas filtran por `business_id` con
  `is_business_member()`. Un negocio no ve nada del otro. La demo de cada
  visitante es una copia aparte.
- **Seguimiento público.** Pasa por `get_order_tracking`, que devuelve sólo lo
  que le sirve a quien encargó. No filtra teléfono, email ni dirección de nadie.
- **Secretos.** Revisé el paquete que llega al navegador: lo único que viaja es
  la clave anónima, que es pública por diseño. Nada más.
- **Recorrida completa.** 9 pantallas públicas y 22 del panel, cada una en
  escritorio y en teléfono, registrando errores de JavaScript, de consola,
  pedidos fallidos, imágenes rotas, pantallas en blanco y links muertos.
  16 anotaciones, **todas** artefactos de este entorno (el proxy de la máquina
  donde corre esto corta conexiones al azar), ninguna del sistema.
- **Checkout de punta a punta.** Dos productos al carrito, datos, enviar,
  confirmación con número. Funciona. El pedido de prueba quedó borrado y la
  numeración devuelta a donde estaba.
- **COSOV. no se tocó.** Es otra base, otro proyecto de Supabase y otro deploy.
  Nada de esta auditoría lo roza.

---

## 3. Lo que queda anotado, sin urgencia

- **La anticipación mínima sigue chequeada sólo en el navegador.** Es la única
  de las validaciones del formulario que no bajé al servidor, porque depende de
  la hora exacta y de la zona del negocio, y preferí no arriesgar que rechace un
  pedido legítimo por una hora de diferencia. El riesgo real es bajo: el
  calendario del formulario ya no deja elegir antes del mínimo, y lo peor que
  pasa es que entre un pedido con menos aviso del que el negocio querría, que
  igual se revisa a mano.
- **Protección contra contraseñas filtradas, desactivada.** Supabase puede
  chequear cada contraseña nueva contra HaveIBeenPwned. Es un switch en el panel
  de Supabase (Authentication → Policies), no se puede prender desde el código.
  Vale la pena antes de que haya clientes de verdad.
- **Índices sin usar.** El revisor marca trece. Son todos nuevos o de tablas con
  casi nada adentro: "sin usar" acá quiere decir "todavía no hubo tráfico". No
  hay nada que borrar.
- **Políticas múltiples por tabla.** 25 avisos, que son en realidad 5 tablas por
  5 roles. Cada una de esas tablas tiene dos políticas de lectura a propósito:
  una para los miembros del negocio y otra para la tienda pública. Unificarlas
  sería reescribir el modelo de permisos de la tienda para ganar microsegundos
  en tablas de once filas. No vale el riesgo.
- **La clave de Resend** está en el historial de nuestra conversación. Cuando
  tengas un minuto, rotala desde el panel de Resend y actualizá la variable en
  Vercel.

---

## Resumen

Tres bugs de verdad —el stock que no volvía, el pedido de la tienda sin revisar
del lado del servidor, y el detalle que podía quedar vacío—, más la
accesibilidad y cuatro cosas de la base. Todo arreglado, probado y en producción.

De decisiones tuyas queda una sola, y es chica: si los insumos tienen que volver
o no cuando se cancela un pedido que ya estaba en producción. Lo dejé en que no
vuelven, que es lo que pasa en la cocina. Si en tu caso es distinto, decime y es
una línea.

El resto —precios, numeración, separación entre negocios, seguimiento, secretos,
las 31 pantallas— está bien.
