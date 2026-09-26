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
│   └── supabase/         Clientes de Supabase (browser, server, admin)
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
