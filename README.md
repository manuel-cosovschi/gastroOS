# GastroOS

**El sistema operativo de tu negocio gastronómico.**

GastroOS es un SaaS de gestión para negocios gastronómicos chicos que trabajan
principalmente **por pedidos**: pastelerías, panaderías, emprendimientos de
tortas, catering, viandas, repostería, comida por encargo, dark kitchens y
pequeños productores.

En una sola pantalla muestra qué se entrega hoy, cuánto entró, cuánto salió y
qué insumo está por faltar. Los pedidos se cargan en menos de un minuto y el
cliente queda asociado automáticamente.

---

## Qué incluye

| Módulo | Qué resuelve |
|---|---|
| **Dashboard** | Resumen del día y del mes, próximas entregas, alertas y evolución de facturación. |
| **Pedidos** | Alta rápida, estados, señas y saldos, búsqueda y filtros, próximos e históricos. |
| **Calendario** | Vista mensual de entregas; al tocar un día se ven los pedidos y se abren desde ahí. |
| **Clientes** | CRM básico: historial, total gastado, ticket promedio, último pedido y notas. |
| **Productos** | Catálogo con precio, costo, margen calculado, stock y receta por lote. |
| **Stock** | Insumos con mínimos, alertas de faltante, valorización y lista de compra sugerida. |
| **Gastos** | Registro por categoría, proveedor y método de pago. |
| **Estadísticas** | Ventas por período, ticket promedio, mejores clientes y productos, gastos por categoría, comparación contra el período anterior. |
| **Configuración** | Datos del negocio, logo, moneda y zona horaria. Nada hardcodeado. |
| **Tienda pública** | Catálogo online opcional: el cliente arma el pedido y entra directo al panel. |

### Estados de pedido

`Pendiente` → `Confirmado` → `En preparación` → `Listo` → `Entregado`
(`Cancelado` en cualquier momento antes del cierre).

Al salir de *Pendiente* el sistema descuenta stock: primero producto terminado
y, si falta, produce el resto consumiendo los insumos de la receta. Todo queda
registrado en movimientos de stock.

---

## Stack

- **Next.js 15** (App Router) + **React 19** + **TypeScript**
- **Tailwind CSS** para estilos, **Radix UI** para primitivas accesibles
- **Supabase**: PostgreSQL con Row Level Security, Auth y Storage
- **Server Actions** para toda la escritura (no hay capa de API REST propia)
- Gráficos propios en HTML/CSS, sin dependencias de charting

---

## Requisitos

- Node.js 20 o superior
- Una cuenta de [Supabase](https://supabase.com) (el plan gratuito alcanza)

---

## Instalación

### 1. Clonar e instalar

```bash
git clone https://github.com/manuel-cosovschi/gastroOS.git
cd gastroOS
npm install
```

### 2. Crear el proyecto de Supabase

Creá un proyecto nuevo en [supabase.com](https://supabase.com/dashboard). Anotá
de **Project Settings → API**: la URL y la `anon key`. La `service_role key`
sólo hace falta si vas a usar `npm run demo:seed`.

### 3. Configurar las variables de entorno

```bash
cp .env.example .env.local
```

Completá `.env.local`:

| Variable | Obligatoria | Para qué |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | sí | URL del proyecto |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | sí | Clave pública (protegida por RLS) |
| `SUPABASE_SERVICE_ROLE_KEY` | sólo para `demo:seed` | Clave secreta. La app no la usa: no la cargues en el hosting |
| `SUPABASE_ACCESS_TOKEN` | no | Token personal, sólo para `npm run db:migrate` |
| `SUPABASE_PROJECT_REF` | no | Ref del proyecto, sólo para `npm run db:migrate` |
| `NEXT_PUBLIC_DEMO_MODE` | no | `true` muestra el cartel de demo |
| `DEMO_EMAIL` / `DEMO_PASSWORD` | para el seed | Usuario demo que crea el seed |
| `NEXT_PUBLIC_STOREFRONT_BUSINESS_SLUG` | no | Qué negocio publica la tienda |
| `NEXT_PUBLIC_BOOKING_URL` | no | Link de reserva de la home comercial |
| `NEXT_PUBLIC_WHATSAPP` | no | WhatsApp de contacto, sin `+` ni espacios |
| `NEXT_PUBLIC_CONTACT_EMAIL` | no | Mail de contacto |

### 4. Crear el esquema de la base

```bash
npm run db:migrate
```

Si preferís no usar un token personal, abrí el **SQL Editor** del dashboard y
pegá los archivos de `supabase/migrations/` **en orden numérico**.

### 5. Cargar los datos de demostración

```bash
npm run demo:seed
```

### 6. Levantar la aplicación

```bash
npm run dev
```

- Panel: <http://localhost:3000/admin>
- Tienda pública: <http://localhost:3000/catalogo>

---

## Demo

El seed crea un negocio ficticio, **Dulce Estudio** (pastelería artesanal), con
datos coherentes entre sí:

- 8 clientes, varios con más de un pedido
- 11 productos y 2 combos, con receta y costo real
- 15 insumos, 3 de ellos deliberadamente **bajo el mínimo** para que el
  dashboard abra con alertas
- 42 pedidos repartidos entre el período anterior, los últimos 30 días, hoy y
  la próxima semana, en todos los estados
- 31 gastos por categoría

Los números cierran: el costo de producción sale de las recetas, las recetas
consumen los insumos cargados y el margen del período es el que muestran las
estadísticas.

### Credenciales

| | |
|---|---|
| Email | `demo@gastroos.app` (configurable con `DEMO_EMAIL`) |
| Contraseña | la que pusiste en `DEMO_PASSWORD` |

**No hay contraseña por defecto en el código.** El seed falla si `DEMO_PASSWORD`
está vacía: así ninguna instancia queda publicada con una clave conocida.

### Visita guiada

El panel trae una guía de 16 pasos que recorre el sistema entero: qué hace cada
módulo, dónde está, cómo funcionan los estados y qué conviene probar. Arranca
sola la primera vez que se entra a una copia de la demo o a un negocio de menos de
una semana, y después queda a mano en el botón **Guía** de la barra superior. Los
dos pasos que hablan de la demo tienen su versión para un negocio real (`real` en
cada paso de `src/lib/tour.ts`).

El guion vive en `src/lib/tour.ts` y se edita como un texto corrido. Cada paso
declara cómo se muestra:

| | |
|---|---|
| `focus` | Ilumina un elemento y oscurece el resto. Para «esto es esto, y está acá». |
| `page` | No oscurece nada: la pantalla queda entera a la vista y se puede tocar. |
| `center` | Tarjeta al medio. Apertura y cierre. |

Los pasos `focus` apuntan a atributos `data-tour` (no a clases de Tailwind, que
cambian cuando se retoca el diseño). Si un ancla desaparece, la guía no se
rompe: ese paso se muestra sin señalar nada.

El progreso se guarda en `localStorage`, así que recargar no vuelve al paso uno.
La clave está versionada: si cambiás el guion, subí la versión en
`TOUR_STORAGE_KEY` y la guía se vuelve a ofrecer.

### Resetear la demo

```bash
npm run demo:reset
```

Borra los datos del negocio demo y los vuelve a crear desde cero. **No toca el
esquema** de la base, y sólo borra el negocio cuyo slug es `dulce-estudio`: si
la instancia tiene otros negocios, quedan intactos. Las fechas son relativas al
día en que se corre, así que la demo siempre se ve "de hoy".

El dataset se edita en `scripts/demo-data.ts`.

### Sin `service_role` key

`demo:seed` necesita la `service_role` key porque crea el usuario de Auth por
API. Si no la tenés a mano:

```bash
npm run demo:sql > demo.sql
```

y pegá el resultado en el **SQL Editor** del dashboard. Sale del mismo dataset,
es idempotente (borra y recrea) y hashea la contraseña con bcrypt dentro de
Postgres, así que nunca viaja en texto plano.

---

## Home comercial

La raíz (`/`) es la página de venta: rubros, problema, módulos, recorrido con
capturas reales, cómo funciona, diferenciales, contacto y preguntas frecuentes.
Todo el texto vive en `src/lib/marketing.ts`, así que se edita sin tocar
componentes.

Los botones de contacto salen de variables de entorno y **cada uno se muestra
sólo si su variable está cargada**: una landing con un botón que no lleva a
ningún lado es peor que no tener el botón.

| Variable | Botón |
|---|---|
| `NEXT_PUBLIC_BOOKING_URL` | «Reservar una demo» |
| `NEXT_PUBLIC_WHATSAPP` | «WhatsApp» |
| `NEXT_PUBLIC_CONTACT_EMAIL` | «Escribinos» |

Sin `NEXT_PUBLIC_BOOKING_URL` la página no promete coordinar una reunión: el
llamado a la acción pasa a ser entrar a la demo y escribir por WhatsApp.

### El link de reserva

Se genera en Google Calendar, no hay API que lo cree: **Crear → Página de
citas**, se define duración y disponibilidad, y **Compartir** devuelve una URL
`https://calendar.app.google/…`. Esa URL es la que va en la variable.

El tope de horario se pone ahí, en la disponibilidad de la página de citas: hoy
el último turno no puede empezar después de las **16 h**. La landing lo anuncia
antes del clic con `BOOKING_NOTE`, en `src/lib/marketing.ts`; si cambiás la
franja en Calendar, cambiá también esa línea.

---

## Scripts

| Comando | Qué hace |
|---|---|
| `npm run dev` | Servidor de desarrollo |
| `npm run build` | Build de producción |
| `npm run start` | Sirve el build de producción |
| `npm run lint` | ESLint |
| `npm run typecheck` | TypeScript sin emitir |
| `npm run db:migrate` | Aplica `supabase/migrations/` al proyecto |
| `npm run demo:seed` | Crea el negocio demo con todos sus datos |
| `npm run demo:reset` | Borra y recrea los datos de la demo |
| `npm run demo:sql` | Emite la demo como SQL, para pegar en el SQL Editor |

---

## Estructura

```
src/
├── actions/              Server actions: toda la escritura y las consultas
│   ├── business.ts       Datos del negocio y preferencias
│   ├── catalog.ts        Lecturas y alta de pedidos de la tienda pública
│   ├── customers.ts      CRM
│   ├── dashboard.ts      Agregados del tablero
│   ├── expenses.ts       Gastos y sus categorías
│   ├── ingredients.ts    Insumos y recetas
│   ├── inventory.ts      Alertas, valorización y descuento de stock
│   ├── orders.ts         Pedidos
│   └── stats.ts          Estadísticas y calendario
├── app/
│   ├── (tienda)/         Tienda pública: catálogo, combos, pedido, seguimiento
│   ├── admin/            Panel de gestión
│   └── login/            Autenticación
├── components/
│   ├── admin/            Formularios y piezas del panel
│   │   └── tour/         Visita guiada: estado y dibujado
│   ├── brand/            Logo e identidad
│   ├── cart/             Carrito de la tienda pública
│   ├── catalog/          Tarjetas y filtros del catálogo
│   ├── charts/           Gráficos (HTML/CSS, sin dependencias)
│   ├── layout/           Sidebar, topbar, header y footer
│   └── ui/               Primitivas: botón, input, card, dialog…
├── lib/
│   ├── analytics.ts      Motor de métricas compartido
│   ├── business.ts       Resolución del negocio activo (tenant)
│   ├── production-cost.ts Costo unitario desde receta u override
│   ├── marketing.ts      Contenido y contactos de la home comercial
│   ├── tour.ts           Guion de la visita guiada del panel
│   └── supabase/         Clientes de Supabase (browser y server)
└── types/                Tipos y constantes del dominio

scripts/
├── demo-data.ts          Dataset de la demo
├── demo.ts               Seed y reset
└── migrate.ts            Aplica las migraciones

supabase/migrations/      Esquema SQL, en orden
```

---

## Arquitectura multi-tenant

Cada entidad cuelga de un **negocio** (`businesses`), y un usuario pertenece a
uno o más negocios vía `business_members`:

```
Business
├── Users (business_members)
├── Customers
├── Orders → OrderItems → OrderStatusHistory
├── Products → RecipeItems
├── Packages → PackageItems
├── Ingredients → StockMovements
├── Expenses → ExpenseCategories
└── Settings
```

Las policies de RLS resuelven siempre contra esa pertenencia
(`is_business_member(business_id)`), así que la base ya aísla los datos de cada
negocio. La aplicación nunca asume "el negocio": lo pide con
`requireBusiness()` y filtra por `business_id`.

Hoy la interfaz asume un negocio por usuario. Para abrir el producto a varios
negocios por usuario alcanza con agregar un selector y pasar el id elegido a
`getCurrentBusiness()`; el resto del código ya está preparado.

### Cómo se entrega

Hay dos formas, y conviven:

- **Cuenta compartida (plan Taller).** El cliente vive en el mismo deploy y la
  misma base que el resto, aislado por RLS. Al aprobar su pago se crea solo su
  negocio, su cuenta y su tienda en `tunegocio.gastroos.shop`. Ver
  [Tiendas por subdominio](#tiendas-por-subdominio).
- **Con identidad propia (Negocio en adelante).** Un deploy con su marca, sus
  colores y su dominio (ver [Personalizar la identidad de un cliente](#personalizar-la-identidad-de-un-cliente)).
  Sus datos pueden vivir en esta misma base, aislados por RLS. Si el cliente
  tiene su propio proyecto de Supabase, cada cambio de esquema hay que correrlo
  en cada uno: `npm run db:migrate` toma `SUPABASE_PROJECT_REF` del entorno, así
  que es cambiar esa variable y volver a correrlo.

---

## Tiendas por subdominio

Cada negocio de la cuenta compartida tiene su tienda pública en
`tunegocio.gastroos.shop`. Estas son las piezas:

| Pieza | Dónde |
|---|---|
| Reconoce el subdominio, lo valida y lo pasa en la cabecera `x-tenant-slug` | `src/middleware.ts`, `src/lib/tenant.ts` |
| Qué tienda se muestra según esa cabecera | `getStorefrontBusiness()` en `src/lib/business.ts` |
| Crear negocio, cuenta del dueño y ficha de cliente al aprobar el pago | `src/lib/signup-flow.ts` y `sovare.provision_business()` |
| Mails de la contratación, uno por tipo de plan | `src/lib/signup-mail.ts` |
| Lo que el panel de SOVARE le pide a la landing | `src/app/api/interno/contratacion/route.ts` |

**Cómo se reconoce una tienda.** El middleware mira el host. `dulce.gastroos.shop`
sirve la tienda de `dulce` (la raíz `/` muestra su catálogo). Cualquier otra ruta
de un subdominio (el panel, el login, `/contratar`) redirige al dominio
principal: la sesión nunca queda atada a una tienda. `www`, `admin`, `demo-…` y el
resto de la lista reservada también redirigen. El middleware borra la cabecera
`x-tenant-slug` que llegue de afuera, porque es la que decide qué tienda se lee.

**La tienda del dominio principal.** `gastroos.shop/catalogo` es la tienda de
ejemplo. Con varios negocios en la base hay que fijarla con
`NEXT_PUBLIC_STOREFRONT_BUSINESS_SLUG=dulce-estudio`; sin esa variable, el primer
negocio por orden alfabético se queda con ella.

**Qué pasa al aprobar un pago.** Lo aprueba la IA al leer el comprobante, o una
persona desde el panel, y las dos terminan en `afterApproval()`:

1. Plan sin puesta a punto (el Taller): se crea el negocio, la cuenta del dueño
   (con una contraseña que nadie conoce) y su ficha de cliente con el primer cobro
   pagado, y se le manda el mail. El cliente elige su contraseña desde el link de
   su contratación y queda con la sesión abierta.
2. Plan con puesta a punto: se le manda el mail del formulario de alta. La cuenta
   se arma a mano, o por adelantado con el botón del panel.

Si el mail ya tenía una cuenta, no se la toca ni se le cuelga el negocio: queda
anotado en la contratación y el panel lo muestra. Todos los pasos se pueden
repetir y dejan el mismo resultado. El pago nunca se deshace por una falla de
estos pasos.

**Qué se le avisa al dueño de SOVARE** (a `NEXT_PUBLIC_CONTACT_EMAIL`): pago
aprobado por la IA, comprobante para revisar, alta completada, y una tienda que no
se pudo crear.

**Variables.**

| Variable | Para qué |
|---|---|
| `NEXT_PUBLIC_SITE_URL` | El dominio raíz (`https://gastroos.shop`). De ahí sale el de las tiendas. |
| `NEXT_PUBLIC_ROOT_DOMAIN` | Sólo si las tiendas cuelgan de otro dominio que el sitio. |
| `NEXT_PUBLIC_STOREFRONT_BUSINESS_SLUG` | La tienda de ejemplo del dominio principal. |
| `TENANT_STORES=on` | Prende las direcciones `tunegocio.gastroos.shop` en mails y pantallas. Se prende cuando el comodín del DNS ya funciona; mientras no, los mails dicen que la tienda se activa en breve en vez de mostrar un link muerto. |

**DNS.** Hace falta un comodín `*.gastroos.shop` con certificado, y Vercel sólo lo
emite si el dominio usa sus servidores de nombres. Por eso `gastroos.shop` tiene
que estar en Vercel DNS, con los registros de mail de Resend copiados tal cual.
El comodín ya está agregado al proyecto `gastroos`.

**Seguridad.** El slug de un negocio no lo puede cambiar quien lo usa
(`016_slug_inmutable.sql`). `ORDER_NOTIFICATION_EMAIL` sólo vale para la tienda
fijada, no para las de los clientes. El texto que escriben terceros entra
escapado a los mails, y el remitente de los mails de un pedido lleva el nombre del
negocio sin `@`, `:` ni `/`.

**Probarlo en local.** Poné `NEXT_PUBLIC_SITE_URL=http://gastroos.test:3100`,
resolvé `*.gastroos.test` a 127.0.0.1 y abrí `http://tunegocio.gastroos.test:3100`.
`RESEND_API_URL` y `OPENAI_API_URL` permiten apuntar los mails y la lectura del
comprobante a un servidor de prueba. Los chequeos puros están en
`src/lib/__tests__/*.manual.mts` (`npx tsx …`).

---


## Personalizar la identidad de un cliente

Es lo que diferencia una instalación de la siguiente, y son dos archivos:

| Dónde | Qué |
|---|---|
| `tailwind.config.ts` | La escala `brand` (acentos, botones, gráficos) y, si hace falta, `stone` (fondos, bordes, texto) |
| `src/app/layout.tsx` | Las familias tipográficas, vía `next/font/google` |

Si el cliente usa una tipografía con serifa para los títulos, se suma la
variable en `tailwind.config.ts` (`fontFamily.serif`) y una regla en
`globals.css` para `h1, h2`.

Conviene mover también `themeColor` en `layout.tsx`: es el color de la barra
del navegador en mobile, y con el verde por defecto canta que es plantilla.

La referencia real es COSOV.: bordó `#5B1A1A` con una escala crema, Inter para
el cuerpo y Playfair Display para los títulos.

---

## Seguridad

- Ningún secreto vive en el repositorio: todo sale de variables de entorno, y
  `.env*.local` está en `.gitignore`.
- La aplicación no usa la `service_role` key en ningún punto: las subidas de
  imágenes van con la sesión del usuario, contra las policies del bucket. La
  clave sólo la necesita `demo:seed` para crear el usuario de Auth, y ni
  siquiera eso si sembrás con `demo:sql`. El hosting nunca la ve.
- Todas las tablas tienen RLS activo. El acceso anónimo se limita al catálogo
  activo de un negocio con la tienda habilitada y a crear pedidos; los pedidos
  no son legibles por anónimos (el seguimiento devuelve sólo campos concretos,
  resuelto en el servidor).
- Las contraseñas las maneja Supabase Auth (bcrypt). El proyecto nunca guarda
  ni registra contraseñas.

---

## Todavía no implementado

Estas piezas no están y la arquitectura no las bloquea: Mercado Pago y pagos
online, facturación AFIP/ARCA, WhatsApp API, envío automático de emails,
integraciones de delivery, funciones de IA y planes/suscripciones de SaaS.

---

GastroOS es un producto de **SOVARE**.
