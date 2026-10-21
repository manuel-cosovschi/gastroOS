# Auditoría del ecosistema (20–21/10/2026)

Hecha leyendo los repositorios, los proyectos de Vercel y Supabase visibles, la instancia de n8n y las páginas en producción. Nada de esto se modificó.

## Productos de SOVARE

| | GastroOS | AlojaOS |
|---|---|---|
| Qué es | SaaS de gestión para negocios gastronómicos que trabajan por encargo (pedidos, calendario, clientes, productos con receta, stock, gastos, estadísticas, tienda pública) | Sistema de reservas propio para complejos de 3 a 15 unidades (página de reservas con su marca, calendario sin superposiciones, precios por temporada, seña con comprobante, panel del dueño) |
| URL | https://gastroos.shop — `/conv` responde 200 | https://alojaos.shop — `/conv` responde 200 |
| Repo | `manuel-cosovschi/gastroOS`, rama de producción `claude/gastroos-saas-transformation-x4uz9r` | `manuel-cosovschi/alojaOS`, `main` |
| Stack | Next.js 15, React 19, TS, Tailwind, Supabase (Postgres + RLS), Vercel | Ídem + Resend |
| Precios (del código) | Taller $15.000, Negocio $32.000 (+$55.000 puesta a punto), Cocina grande $56.000 (+$95.000), A medida desde $89.000. «Precios de octubre de 2026, en pesos y con IVA incluido.» | Familiar $29.000 (+$65.000), Complejo $45.000 (+$90.000), Complejo grande $65.000 (+$120.000), A medida desde $90.000 (+$150.000) |
| Cómo se vende | Online: planes → `/contratar` (transferencia + comprobante; una IA lo lee y aprueba o deja en revisión) | Asistida: formulario de consulta → la cierra una persona |
| `/conv` | 4 variantes `?v=`: base, stock, costos, pedidos | 3 variantes: base, comision, whatsapp |
| Eventos | PageView, ViewContent, Demo, Contact, InitiateCheckout, Lead (+ CAPI con `event_id`). **Purchase no se envía** | PageView, Demo, Contact, Lead (+ CAPI) |
| Píxel en producción | **No** (falta `NEXT_PUBLIC_META_PIXEL_ID`) — verificado en HTML y en navegador | **No** — ídem |
| CAPI | Código listo, **falta `META_CAPI_TOKEN`**; usa Graph **v21.0** (se retira el 21/01/2027) | Ídem |
| Dónde quedan los leads | `sovare.clients` (estado prospecto; la atribución resumida en `source`) | `public.consultas` (`origen` jsonb, `estado` nueva/contactada/cliente/descartada) — proyecto Supabase `rlejzukedyzfnlatyjfk`; 0 filas al 21/10 |
| Dónde quedan las ventas | `sovare.signups` (aprobado + monto), **sin atribución ni fbp/fbc** | No hay venta online |
| Recursos visuales reales | 5 capturas (demo «Dulce Estudio») + grabación del alta de un pedido | 6 capturas (complejo de ejemplo) + grabación de una reserva + caso Las Cañas |
| Scripts propios | `capturas`, `videos`, `og`, `prueba:conv` (Playwright, con guarda de datos personales) | Ídem + `verificar`, `caso` |

**Panel SOVARE** (`gastroOS/sovare-panel`, proyecto Vercel `sovare-panel`): interno (clientes, cobros, contrataciones, vendedores). No se anuncia. Es donde se aprueban los pagos de GastroOS (`decideSignup`), el punto natural para mandar `Purchase`.

## Otros repositorios

| Repo | Qué es | Decisión |
|---|---|---|
| restOps | «Sistema operativo de operaciones internas de un restaurante». Base de datos lista, sin interfaz | Candidato; no se anuncia hasta tener producto, /conv y precios |
| cosovGO | Instalación de GastroOS para COSOV. (pastelería) | Caso de cliente (ya citado por GastroOS) |
| las_canias_landing | Sistema del complejo Las Cañas (Netlify + n8n + Google Sheets) | Caso de cliente, origen de AlojaOS |
| casacadecancha, mgb_*, cerquita, tuday_app, matchTurn, rankeate, ic-comercial-crm, cuanto_cuesta, smart_landing, trove, … | Ecommerce, plataforma MGB, apps personales, sitios de clientes | Fuera de alcance: sin marca SOVARE. Requieren confirmación del dueño |

La lista está en `catalog/ecosystem.json`; `products_discover` avisa si aparece algo nuevo.

## Infraestructura disponible

- **Vercel** (equipo `manuel-cosovschi's projects`): `gastroos`, `alojaos`, `sovare-panel`, `cosov-pedidos`, `casacadecancha`, y ~35 proyectos más.
- **Supabase** visible: sólo el proyecto `alojaos` (São Paulo). La base de GastroOS/SOVARE está en otra cuenta u organización no conectada.
- **n8n**: 36 workflows, todos de Las Cañas (bot de WhatsApp, reservas, avisos). WhatsApp Cloud API ya se usa ahí.
- **Mail**: Resend en los productos.
- **GitHub**: la integración de esta sesión no puede crear repositorios nuevos (403).

## Meta

- No hay credenciales de Meta en ningún entorno revisado; no hay cuenta publicitaria, página ni Instagram conectados a nada que la Factory pueda usar.
- El «repositorio de Meta» mencionado en el pedido **no llegó**: cuando esté, se evalúa (SDK, integración o documentación) sin asumir que da acceso a una cuenta.

## Consecuencias para el diseño

1. Nada se puede publicar ni pagar hasta tener: token de usuario del sistema, cuenta publicitaria, página, Instagram y píxel por producto. La Factory arranca en **modo de prueba** y lo dice.
2. Las campañas por consultas quedan **bloqueadas** mientras el /conv no cargue el píxel (política `require_pixel_for_conversion_campaigns`).
3. Las ventas de GastroOS entran a la Factory sin atribución hasta que `sovare.signups` guarde la campaña y las cookies del píxel (`docs/PENDIENTES.md`).
