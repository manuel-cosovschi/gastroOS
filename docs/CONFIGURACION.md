# Configuración: de dónde sale cada clave y dónde va

Guía para completar las variables de entorno. Cada sección dice **qué
habilita**, **de dónde se saca** y **dónde se pega**.

## Son dos proyectos distintos en Vercel

No mezclarlos es lo más importante de esta guía:

| Proyecto en Vercel | Qué es | Qué le falta |
|---|---|---|
| **`gastroos`** | La plantilla y la página de venta (`gastroos-gilt.vercel.app`) | Resend, OpenAI, VAPID, datos de transferencia, service role |
| **`cosov-pedidos`** | El sistema real de COSOV., en producción | Sólo Resend (2 variables) |

Una sola cuenta de Resend sirve para los dos. Se verifica **un** dominio y se
usan dos direcciones distintas de remitente.

## Lo que ya está cargado (no lo toques)

**`gastroos`:** `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`,
`NEXT_PUBLIC_DEMO_MODE`, `NEXT_PUBLIC_DEMO_EMAIL`, `NEXT_PUBLIC_WHATSAPP`,
`NEXT_PUBLIC_CONTACT_EMAIL`, `NEXT_PUBLIC_BOOKING_URL`,
`NEXT_PUBLIC_SOVARE_PANEL_URL`.

**`cosov-pedidos`:** las de Supabase (incluida la service role), `ADMIN_EMAIL`
y las dos de Google Sheets.

---

## Cómo se carga una variable en Vercel

Vale para los dos proyectos. Se hace una vez y después se repite:

1. Entrá a <https://vercel.com> y abrí el proyecto.
2. Pestaña **Settings** (arriba).
3. Menú de la izquierda, **Environment Variables**.
4. Escribí el nombre en **Key**, el valor en **Value**, dejá marcados los tres
   entornos (Production, Preview, Development) y **Save**.
5. Repetí con las que falten.

> **El paso que se olvida siempre:** cuando termines de cargar todas, andá a la
> pestaña **Deployments**, abrí el último, botón **⋯** → **Redeploy**. Vercel
> no aplica las variables nuevas al deploy que ya está arriba. Sin esto parece
> que no funcionó.

Para probar en tu computadora, las mismas variables van en `.env.local` (copiá
`.env.example` y renombralo). Ese archivo nunca se sube al repositorio.

---

# PRIMERO: Resend

Empezá por acá porque la verificación del dominio es lo único que puede tardar
horas. Mientras se verifica, hacé el resto.

Habilita los mails en los dos proyectos.

## Paso 1 — crear la cuenta

<https://resend.com> → **Sign up**. El plan gratis da 3.000 mails por mes y 100
por día.

## Paso 2 — verificar el dominio

1. Menú izquierdo, **Domains** → **Add Domain**.
2. Escribí tu dominio (por ejemplo `gastroos.app`) → **Add**.
3. Resend muestra una tabla con 3 o 4 registros DNS (`MX`, `TXT`, a veces
   `CNAME`). Hay que cargarlos donde compraste el dominio:
   - **Si está en Vercel:** proyecto → **Settings** → **Domains** → tu dominio
     → **DNS Records** → **Add**. Copiá cada fila tal cual: Type, Name, Value.
   - **Si está en otro lado** (NIC.ar, GoDaddy, Namecheap…): buscá "DNS" o
     "Zona DNS" en ese panel y cargá los mismos registros.
4. Volvé a Resend → **Verify**. Tarda entre 5 minutos y unas horas.

> **¿No tenés dominio propio?** Resend deja mandar desde `onboarding@resend.dev`
> pero **sólo a tu propia casilla**. Sirve para probar, no para mandarle a
> clientes. Para eso hace falta el dominio verificado.

## Paso 3 — sacar la clave

1. Menú izquierdo, **API Keys** → **Create API Key**.
2. Nombre: cualquiera. Permission: **Sending access**.
3. **Add**. La muestra una sola vez y empieza con `re_`. Copiala ahora.

La misma clave sirve para los dos proyectos.

---

# PROYECTO 1 — `gastroos`

## 1.1 · Supabase service role

**Habilita:** los avisos push al celular y la contratación de planes.

**De dónde:**

1. <https://supabase.com/dashboard> → proyecto **`gastroos`**.
2. Abajo del todo en el menú izquierdo, el engranaje **Project Settings**.
3. **API Keys** (o **API**, según la versión).
4. La fila **`service_role`** aparece tapada, con un botón **Reveal**.

**Qué cargar:**

```
SUPABASE_SERVICE_ROLE_KEY = <lo que revelaste>
```

> ⚠️ Esta clave saltea todos los permisos de la base. No la pegues en un chat,
> no la subas al repositorio, y **nunca** en una variable que empiece con
> `NEXT_PUBLIC_` — esas viajan al navegador.

## 1.2 · Resend

**Habilita:** los tres mails de pedidos (confirmación al cliente, aviso al
negocio, cambio de estado).

```
RESEND_API_KEY = re_...            (la del paso 3 de arriba)
MAIL_FROM      = GastroOS <hola@tudominio.com>
```

`MAIL_FROM` tiene que usar **el dominio que verificaste**. La casilla no hace
falta que exista; alcanza con que el dominio esté verificado.

**Opcional:**

```
ORDER_NOTIFICATION_EMAIL = otra@casilla.com
```

Vacío = el aviso va al email del negocio cargado en Configuración, que es lo
normal.

## 1.3 · OpenAI

**Habilita:** que una IA lea el comprobante de transferencia de quien contrata
un plan y, si coincide con lo que esperábamos cobrar, apruebe el pago sola.

**De dónde:**

1. <https://platform.openai.com> — ojo, **no** es chatgpt.com.
2. **Settings** (arriba a la derecha) → **Billing** → **Add payment method**.
   Sin saldo la clave devuelve error. Cargá lo mínimo.
3. Menú izquierdo, **API keys** → **Create new secret key**.
4. Empieza con `sk-` y no se vuelve a mostrar.

```
OPENAI_API_KEY = sk-...
OPENAI_MODEL   = gpt-4o
```

`OPENAI_MODEL` dejalo así. Tiene que ser un modelo que acepte imágenes.

**Costo:** cada comprobante leído sale menos de un centavo de dólar.

> Sin esta clave la contratación funciona igual: el comprobante se guarda y
> queda esperando que lo apruebes a mano desde el panel de SOVARE. No se pierde
> ningún pago.

## 1.4 · VAPID (notificaciones al celular)

**Habilita:** el aviso en el teléfono cuando entra un pedido, con el panel
cerrado.

Estas **no se sacan de ningún lado: se generan**. Son un par propio de tu
aplicación. En una terminal, en la carpeta del proyecto:

```bash
npx web-push generate-vapid-keys
```

Devuelve dos valores largos, una Public Key y una Private Key.

```
NEXT_PUBLIC_VAPID_PUBLIC_KEY = <la Public Key>
VAPID_PRIVATE_KEY            = <la Private Key>
VAPID_SUBJECT                = mailto:sovare.studio@gmail.com
```

La pública lleva `NEXT_PUBLIC_` porque el navegador la necesita para
suscribirse: es pública por diseño. La privada nunca sale del servidor.

> Generalas **una sola vez** y no las cambies. Si las cambiás, todos los
> teléfonos que ya habían activado las notificaciones dejan de recibirlas.

Después del redeploy: entrá al panel desde el celular → **Configuración** →
**Notificaciones** → **Activar**. En iPhone primero hay que agregar la app a la
pantalla de inicio (Safari → botón compartir → *Agregar a inicio*); la pantalla
te lo explica sola.

## 1.5 · Datos de transferencia

**Habilita:** las pantallas `/contratar` y `/alta`, donde alguien contrata un
plan y sube el comprobante.

No se sacan de ningún lado: son los datos de tu cuenta, los mismos que le
pasarías a alguien por WhatsApp.

```
TRANSFER_HOLDER = Nombre y apellido del titular
TRANSFER_BANK   = Nombre del banco o billetera
TRANSFER_ALIAS  = tu.alias.aca
TRANSFER_CBU    = 0000003100000000000000
TRANSFER_CUIT   = 20-12345678-9
```

Si falta el titular, el alias o el CBU, `/contratar` y `/alta` devuelven 404 a
propósito: mostrar datos bancarios a medias es peor que no mostrarlos.

## 1.6 · URL del sitio (opcional)

En Vercel se deduce sola del deploy de producción. Cargala sólo si usás un
dominio propio:

```
NEXT_PUBLIC_SITE_URL = https://tudominio.com
```

Sin barra al final.

## 1.7 · Tiendas por subdominio

Cada cliente del plan Taller tiene su tienda en `tunegocio.gastroos.shop`. Para que
funcione hacen falta tres cosas.

**1. El DNS de `gastroos.shop` en Vercel.** Vercel sólo emite el certificado de un
comodín (`*.gastroos.shop`) si maneja el DNS del dominio. El comodín ya está
agregado al proyecto `gastroos`; falta que el dominio use los servidores de
nombres de Vercel:

1. En Vercel → **Domains** → `gastroos.shop` → **DNS Records**, cargá los
   registros del mail antes de cambiar nada (si falta alguno, el mail de COSOV.
   deja de salir):

   | Tipo | Nombre | Valor |
   |---|---|---|
   | CNAME | `send` | `send.forge.rmta.net.` |
   | TXT | `resend._domainkey` | la clave que figura hoy en GoDaddy (`p=MIGfMA0G…`) |
   | TXT | `_dmarc` | `v=DMARC1; p=quarantine; adkim=r; aspf=r; rua=mailto:dmarc_rua@onsecureserver.net;` |

   El apex y `www` los resuelve Vercel solo, no hace falta cargarlos.
2. Comparar con la tabla de DNS de GoDaddy: cualquier otro registro que tenga
   (MX, TXT, CNAME) hay que copiarlo también.
3. En GoDaddy → el dominio → **Servidores de nombres** → **Cambiar** → «Ingresar
   mis propios servidores de nombres» → `ns1.vercel-dns.com` y
   `ns2.vercel-dns.com`.
4. Si algo sale mal, volver a poner `ns05.domaincontrol.com` y
   `ns06.domaincontrol.com`. Los registros de GoDaddy siguen ahí.

**2. La tienda de ejemplo fijada.** `NEXT_PUBLIC_STOREFRONT_BUSINESS_SLUG =
dulce-estudio`. Sin esto, la primera tienda de un cliente por orden alfabético
reemplazaría a la de ejemplo en `gastroos.shop/catalogo`.

**3. Prender las direcciones.** Cuando `https://cualquiercosa.gastroos.shop` abra,
cargá `TENANT_STORES = on` y redeployá. Hasta entonces los mails y las pantallas
dicen que la tienda «se activa en las próximas horas» en vez de mostrar un link
muerto.

---

# PROYECTO 2 — `cosov-pedidos`

Este es el sistema real de COSOV., que está andando. **Sólo faltan dos
variables**, las dos de Resend. El resto ya está cargado.

> ⚠️ **El orden importa.** El cambio saca Brevo del todo, sin respaldo. Si
> mergeás antes de cargar estas dos, COSOV. se queda sin mandar mails hasta que
> las cargues.

## Paso 1 — cargar las dos variables

Vercel → proyecto **`cosov-pedidos`** → Settings → Environment Variables:

```
RESEND_API_KEY = re_...                              (la misma de antes)
MAIL_FROM      = COSOV. <pedidos@tudominio.com>
```

El dominio tiene que ser el que verificaste en Resend. Podés usar el mismo que
para gastroOS con otra dirección: por ejemplo `hola@tudominio.com` para
GastroOS y `pedidos@tudominio.com` para COSOV.

## Paso 2 — mergear el PR

<https://github.com/manuel-cosovschi/cosovGO/pull/29> → **Merge**. Vercel
despliega solo.

## Paso 3 — probar que salen

Entrá a `cosov-pedidos.vercel.app/admin/debug-email` y mandá un mail de prueba.
Esa pantalla muestra el error textual de Resend si algo falla — es donde se ve
el problema más común: que el dominio de `MAIL_FROM` no esté verificado.

## Paso 4 — limpiar Brevo

Recién cuando el paso 3 salga bien, borrá de Vercel:

```
BREVO_API_KEY
FROM_EMAIL
FROM_NAME
```

Ya no las lee nadie.

## Qué mails manda COSOV. después de esto

| A quién | Asunto | Cuándo |
|---|---|---|
| Al cliente | Pedido #N recibido | al encargar por la web · **nuevo** |
| A Valen | Nuevo pedido #N | al encargar por la web |
| Al cliente | ¡Tu pedido #N fue confirmado! | cuando Valen aprueba |

El mail al cliente al encargar es nuevo: antes no recibía nada hasta que Valen
aprobaba. Sólo alcanza a los pedidos que entren de ahí en adelante; los que ya
están cargados no reciben nada.

Los pedidos que Valen carga a mano desde el panel siguen sin mandar mail: ahí
ya está hablando con el cliente por WhatsApp.

---

# Resumen: qué prende cada cosa

## `gastroos`

| Variables | Qué prende | Si falta |
|---|---|---|
| `SUPABASE_SERVICE_ROLE_KEY` | Avisos push + contratación | Sin avisos y sin contratación |
| `RESEND_API_KEY` + `MAIL_FROM` | Los tres mails de pedidos | No sale ningún mail, y la pantalla deja de prometerlo |
| `OPENAI_API_KEY` | Aprobación automática de comprobantes | Esperan aprobación manual |
| `NEXT_PUBLIC_VAPID_PUBLIC_KEY` + `VAPID_PRIVATE_KEY` | Notificaciones al celular | Se instala igual, sin avisos |
| `TRANSFER_*` | Las pantallas de contratación | `/contratar` y `/alta` dan 404 |
| `NEXT_PUBLIC_STOREFRONT_BUSINESS_SLUG` | Fija la tienda de ejemplo del dominio principal | La primera tienda por orden alfabético la reemplaza |
| `TENANT_STORES=on` | Las direcciones `tunegocio.gastroos.shop` en mails y pantallas | Dicen que la tienda «se activa en breve» |

## `cosov-pedidos`

| Variables | Qué prende | Si falta |
|---|---|---|
| `RESEND_API_KEY` + `MAIL_FROM` | Los tres mails de COSOV. | **No sale ningún mail** |

---

# Si algo no anda

**Cargué las variables y no cambió nada.** Falta el redeploy: Vercel →
**Deployments** → último → **⋯** → **Redeploy**.

**Los mails no llegan.** <https://resend.com> → **Logs**: ahí figura cada
intento con su error. Lo más común es que `MAIL_FROM` use un dominio distinto
al verificado. En COSOV. también podés usar `/admin/debug-email`.

**Las notificaciones no llegan al iPhone.** Tiene que estar agregada a la
pantalla de inicio y abierta desde ahí. Safari en su ventana normal no recibe
notificaciones, y no avisa por qué.

**`/contratar` da 404.** Falta alguno de `TRANSFER_HOLDER`, `TRANSFER_ALIAS`,
`TRANSFER_CBU`, o la `SUPABASE_SERVICE_ROLE_KEY`.

**La IA no aprueba ningún comprobante.** Revisá que la cuenta de OpenAI tenga
saldo. Sin saldo la clave existe pero devuelve error, y todo cae a revisión
manual — que es el comportamiento correcto, pero no el que esperabas.
