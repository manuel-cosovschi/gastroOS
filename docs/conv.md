# Páginas de conversión (`/conv`)

La página a donde llegan los anuncios. No es la de inicio: un objetivo, sin menú,
y la acción principal según cómo se vende el producto.

| Producto | Ruta | Camino | Acción principal | Secundarias |
|---|---|---|---|---|
| GastroOS | `gastroos.shop/conv` | A — compra directa | Planes → `/contratar` (transferencia + comprobante) | Demo, «que me escriban» |
| AlojaOS | `alojaos.shop/conv` | B — venta asistida | Formulario de consulta | WhatsApp, demo |

Si las contrataciones de GastroOS se apagan (faltan los datos de transferencia o
la clave de la base), la acción principal pasa sola al formulario: nunca queda un
botón que lleva a planes sin «Contratar».

## Lo que mide, y con qué nombre

Los mismos nombres en los dos productos (`src/lib/conv/eventos.ts`):

| Evento | Cuándo |
|---|---|
| `PageView` | al abrir (lo manda el píxel) |
| `ViewContent` | al ver los planes |
| `Demo` | al abrir la demo |
| `Contact` | al tocar WhatsApp |
| `InitiateCheckout` | al tocar «Contratar» un plan |
| `Lead` | cuando **el servidor confirmó** que guardó la consulta. Va también por la API de conversiones con el mismo `event_id`, y Meta cuenta uno solo |
| `Purchase` | **todavía no se manda** (ver abajo) |

Nunca viaja un dato de la persona: ni nombre, ni teléfono, ni mail.

La campaña (`utm_*`, `fbclid`, `gclid`, `?v=`) se guarda en la primera visita en
una cookie propia (`conv_atrib`) y queda anotada en cada consulta.

## Variables de entorno (Vercel)

| Variable | Para qué | Estado |
|---|---|---|
| `NEXT_PUBLIC_META_PIXEL_ID` | Carga el píxel de Meta | **falta** |
| `META_CAPI_TOKEN` | API de conversiones (Lead desde el servidor) | **falta** |
| `NEXT_PUBLIC_GA4_ID` | Carga GA4 (`G-…`) | **falta** |
| `CONV_AVISO_A` | A quién le llega el mail de cada consulta (si no, `NEXT_PUBLIC_CONTACT_EMAIL`) | opcional |

Sin el píxel ni GA4 no se baja ningún script de terceros: la atribución y las
consultas funcionan igual.

## Experimentos

El titular cambia con `?v=` (`src/app/conv/variantes.ts`): `base`, `stock`,
`costos`, `pedidos`. Lo elige cada anuncio, no el azar: sin volumen, un reparto
aleatorio da ruido. La comparación se hace por costo por consulta y por
contratación en el administrador de anuncios, no por clics. No hay ganadora
declarada.

## Lo que falta para cerrar el circuito

- **`Purchase`**: una contratación se confirma cuando alguien de SOVARE aprueba el
  pago en el panel (`sovare-panel/src/actions/signups.ts`, `decideSignup`). Ahí
  hay que llamar a la API de conversiones con el monto del plan. Requiere
  `META_CAPI_TOKEN` en el proyecto del panel y guardar el `fbp`/`fbc` en la
  contratación, lo que pide una columna nueva en `sovare.signups`: no se hizo
  porque hoy no hay acceso a esa base.
- **Política de privacidad**: `/privacidad` se adapta sola a si hay medición o no.
  Si se suma otra herramienta, se actualiza en el mismo cambio.

## Agregar un producto

1. La ruta `src/app/conv/page.tsx` en el repo del producto, con sus componentes
   comerciales (no una plantilla común: cada uno tiene su marca y su público).
2. Copiar `src/lib/conv/` (atribución, eventos, Meta servidor) y
   `src/components/conv/` (rastreo, formulario). Son chicos y no dependen del
   producto, salvo el destino de la consulta en la acción del servidor.
3. Decidir el camino: si se compra online, la acción principal va al alta real;
   si no, al formulario.
4. Copiar `scripts/prueba-conv.mts` y ajustar los selectores. Correrla contra
   producción antes de prender un anuncio.
