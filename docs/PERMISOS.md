# Permisos y credenciales pendientes

Lista exacta de lo que falta para que cada parte funcione de verdad. Nada de esto está en el repo ni en la Skill: va en las variables del servicio.

## Imprescindible para operar

| Qué | Variable | Cómo se consigue | Para qué |
|---|---|---|---|
| Postgres | `DATABASE_URL` | Proyecto de Supabase nuevo (o cualquier Postgres) | Todo |
| URL pública HTTPS | `SMF_PUBLIC_URL` | El hosting del servicio | OAuth de Cowork, links de aprobación |
| Llave del dueño | `SMF_OWNER_KEY` | `openssl rand -base64 32` | Panel, consentimiento OAuth, decisiones |
| Secreto de firma | `SMF_SIGNING_SECRET` | `openssl rand -base64 48` | Sesiones y CSRF |
| Token de máquina | `SMF_API_TOKEN` | `openssl rand -base64 32` | API para n8n / scripts |

## Meta (para publicar, medir y optimizar)

1. **Business Manager** con la cuenta publicitaria, la página de Facebook y la cuenta profesional de Instagram vinculada.
2. **App de Meta** (tipo Business) con el producto *Marketing API*; agregar los casos de uso de Instagram y Páginas.
3. **Usuario del sistema** (Business Settings → Usuarios del sistema) con acceso de anunciante a la cuenta publicitaria, a la página y a Instagram; generar un token **sin vencimiento** con:
   `ads_management`, `ads_read`, `business_management`, `pages_show_list`, `pages_read_engagement`, `pages_manage_posts`, `instagram_basic`, `instagram_content_publish`.
   - Para publicar con la app fuera de modo desarrollo hace falta la revisión de la app de Meta para esos permisos (Advanced Access). Con la app en desarrollo, funciona para los usuarios que tienen rol en la app.
4. **Píxel por producto** (o uno compartido) y **token de la API de conversiones** (Events Manager → Configuración → Generar token).

| Variable | Valor |
|---|---|
| `META_ACCESS_TOKEN` | token del usuario del sistema |
| `META_AD_ACCOUNT_ID` | id de la cuenta (sin `act_`) |
| `META_PAGE_ID` | id de la página |
| `META_PAGE_ACCESS_TOKEN` | sólo si la página exige su propio token para publicar |
| `META_IG_USER_ID` | id de la cuenta de Instagram profesional |
| `META_PIXEL_ID_GASTROOS`, `META_CAPI_TOKEN_GASTROOS` | píxel y token CAPI de GastroOS |
| `META_PIXEL_ID_ALOJAOS`, `META_CAPI_TOKEN_ALOJAOS` | ídem AlojaOS |

**En los productos (Vercel)**, el mismo píxel: `NEXT_PUBLIC_META_PIXEL_ID` y `META_CAPI_TOKEN` en los proyectos `gastroos` y `alojaos` (y redeploy). Sin esto `/conv` no carga el píxel y la Factory bloquea las campañas por consultas.

## Avisos (al menos uno)

| Canal | Variables |
|---|---|
| Mail | `RESEND_API_KEY` (la misma cuenta de los productos sirve), `SMF_MAIL_FROM` (remitente verificado), `SMF_NOTIFY_EMAIL` |
| Telegram | `TELEGRAM_BOT_TOKEN` (BotFather), `TELEGRAM_CHAT_ID` |
| Webhook | `SMF_NOTIFY_WEBHOOK` (p. ej. un workflow de n8n que reenvíe por WhatsApp) |

## Media pública para Instagram

`SUPABASE_URL` + `SUPABASE_SERVICE_ROLE_KEY` del proyecto de la Factory. Se crea un bucket público `smf-media` sólo con los videos renderizados.

## Lectura de leads y ventas (sólo lectura)

En la base de **AlojaOS** (proyecto `rlejzukedyzfnlatyjfk`):

```sql
CREATE ROLE smf_lector LOGIN PASSWORD '…' NOINHERIT;
GRANT USAGE ON SCHEMA public TO smf_lector;
GRANT SELECT (id, creada, origen, estado) ON public.consultas TO smf_lector;
ALTER ROLE smf_lector SET default_transaction_read_only = on;
```

En la base de **GastroOS/SOVARE**:

```sql
CREATE ROLE smf_lector LOGIN PASSWORD '…' NOINHERIT;
GRANT USAGE ON SCHEMA sovare TO smf_lector;
GRANT SELECT (id, created_at, source) ON sovare.clients TO smf_lector;
GRANT SELECT (id, created_at, decided_at, plan, amount, currency, status) ON sovare.signups TO smf_lector;
ALTER ROLE smf_lector SET default_transaction_read_only = on;
```

(Permisos por columna: el rol no puede leer nombres, mails ni teléfonos aunque quisiera. Ojo con RLS: si las tablas tienen RLS forzado, agregar `BYPASSRLS` al rol o una policy de SELECT para él.)

Cadenas: `ALOJAOS_DATABASE_URL`, `GASTROOS_DATABASE_URL`.

## Para Cowork

- Plan con Skills y conectores personalizados habilitados.
- «Ejecución de código y creación de archivos» activado.
- En organizaciones: un Owner agrega el conector.

## Decisiones del dueño (nivel 3) antes del primer peso

- Topes: `max_daily_total_ars`, `max_daily_per_campaign_ars`.
- Canales: `meta_ads`, `instagram`, `facebook`.
- Presupuesto por producto para los borradores (`campaign_defaults.daily_budget_ars`).
- CPL objetivo por producto (`optimizer.target_cpl_ars`) si se quiere que el optimizador pause por costo.
- Pasar a modo real y aprobar el primer gasto real de cada producto.
