# Configuración: de dónde sale cada clave y dónde va

Guía para completar las variables de entorno. Cada sección dice **qué habilita**,
**de dónde se saca** y **dónde se pega**.

Nada de esto es obligatorio para que el sistema ande. Si una sección queda
vacía, esa función simplemente no aparece — no se rompe nada.

---

## Antes de empezar: los dos lugares donde se pegan las claves

**En tu computadora**, para probar: el archivo `.env.local` en la raíz del
proyecto. Si no existe, copiá `.env.example` y renombralo:

```bash
cp .env.example .env.local
```

Ese archivo está en `.gitignore`: nunca se sube al repositorio.

**En producción (Vercel)**, que es lo que ve la gente:

1. Entrá a <https://vercel.com> y abrí el proyecto (`gastroos`).
2. Arriba, pestaña **Settings**.
3. Menú de la izquierda, **Environment Variables**.
4. Por cada variable: escribí el nombre en **Key**, el valor en **Value**,
   dejá marcados los tres entornos (Production, Preview, Development) y
   **Save**.
5. Cuando termines de cargar todas, andá a la pestaña **Deployments**, abrí el
   último deploy, botón **⋯** → **Redeploy**.

> **Importante:** Vercel no aplica las variables nuevas al deploy que ya está
> arriba. Sin el redeploy del punto 5, seguís viendo la versión vieja y parece
> que no funcionó.

---

## 1. Supabase — la base de datos

Ya está configurada. Sólo falta una tercera variable para las funciones nuevas.

**Dónde se saca:**

1. Entrá a <https://supabase.com/dashboard> y abrí el proyecto `gastroos`.
2. Menú de la izquierda, abajo del todo: el engranaje **Project Settings**.
3. Dentro, **API Keys** (o **API**, según la versión).
4. Vas a ver tres cosas:
   - **Project URL** → es `NEXT_PUBLIC_SUPABASE_URL` (ya está cargada)
   - **anon / public** → es `NEXT_PUBLIC_SUPABASE_ANON_KEY` (ya está cargada)
   - **service_role** → aparece tapada, con un botón **Reveal**. Esa es la que
     falta.

**Dónde va:**

```
SUPABASE_SERVICE_ROLE_KEY=<lo que copiaste de service_role>
```

**Qué habilita:** los avisos al teléfono cuando entra un pedido por la tienda,
y la contratación de planes desde la página.

> ⚠️ **Esta clave saltea todos los permisos de la base.** No la pegues en un
> chat, no la subas al repositorio, no la pongas en ninguna variable que
> empiece con `NEXT_PUBLIC_` (esas viajan al navegador). Va sólo en Vercel y en
> tu `.env.local`.

---

## 2. Resend — los mails

Habilita los tres mails del sistema: la confirmación a quien encarga, el aviso
al negocio cuando entra un pedido, y el aviso al cliente cuando el pedido
cambia de estado.

**Paso 1 — crear la cuenta**

1. Entrá a <https://resend.com> y **Sign up**. El plan gratis da 3.000 mails
   por mes y 100 por día, de sobra para arrancar.

**Paso 2 — verificar un dominio** (es lo que más demora, hacelo primero)

1. En el menú de la izquierda, **Domains** → botón **Add Domain**.
2. Escribí tu dominio (por ejemplo `gastroos.app`) y **Add**.
3. Resend te muestra una tabla con 3 o 4 registros DNS (`MX`, `TXT`, a veces
   `CNAME`). Hay que cargarlos donde compraste el dominio.
   - **Si el dominio está en Vercel:** proyecto → **Settings** → **Domains** →
     tu dominio → **DNS Records** → **Add**. Copiá cada fila tal cual: Type,
     Name y Value.
   - **Si está en otro lado** (NIC.ar, GoDaddy, Namecheap…): buscá en el panel
     de ese servicio la sección "DNS" o "Zona DNS" y cargá los mismos
     registros.
4. Volvé a Resend y tocá **Verify**. Puede tardar entre 5 minutos y unas
   horas. Cuando el dominio quede en verde, seguí.

> **¿No tenés dominio propio?** Resend te deja mandar igual desde
> `onboarding@resend.dev`, pero **sólo a tu propia dirección**. Sirve para
> probar, no para mandarle a clientes. Para eso hace falta el dominio.

**Paso 3 — sacar la clave**

1. Menú de la izquierda, **API Keys** → **Create API Key**.
2. Nombre: cualquiera (por ejemplo `gastroos-produccion`).
3. Permission: **Sending access**.
4. **Add**. Te muestra la clave una sola vez, empieza con `re_`. Copiala ahora.

**Dónde va:**

```
RESEND_API_KEY=re_...
MAIL_FROM=Nombre del negocio <pedidos@tudominio.com>
```

`MAIL_FROM` tiene que usar **el dominio que verificaste en el paso 2**. Si
verificaste `gastroos.app`, puede ser `pedidos@gastroos.app`, `hola@gastroos.app`,
lo que quieras — la casilla no tiene que existir, alcanza con que el dominio
esté verificado.

**Opcional:**

```
ORDER_NOTIFICATION_EMAIL=otra@casilla.com
```

Si lo dejás vacío, el aviso de pedido nuevo va al email del negocio que está
cargado en Configuración, que es lo normal.

---

## 3. OpenAI — leer los comprobantes de transferencia

Habilita que una IA lea el comprobante que sube quien contrata un plan y, si
coincide con lo que esperábamos cobrar, apruebe el pago sola.

**Dónde se saca:**

1. Entrá a <https://platform.openai.com> (es distinto de chatgpt.com) e iniciá
   sesión.
2. **Settings** (arriba a la derecha) → **Billing** → **Add payment method**.
   Sin saldo, la clave devuelve error. Cargá lo mínimo, son unos dólares.
3. Menú de la izquierda, **API keys** → **Create new secret key**.
4. Nombre: cualquiera. **Create secret key**.
5. Copiala ahora: empieza con `sk-` y no se vuelve a mostrar.

**Dónde va:**

```
OPENAI_API_KEY=sk-...
OPENAI_MODEL=gpt-4o
```

`OPENAI_MODEL` podés dejarlo así. Tiene que ser un modelo que acepte imágenes.

**Costo:** cada comprobante leído sale menos de un centavo de dólar.

> Sin esta clave, la contratación funciona igual: el comprobante se guarda y
> queda esperando que lo apruebes a mano desde el panel de SOVARE. No se pierde
> ningún pago.

---

## 4. VAPID — las notificaciones al teléfono

Habilita el aviso en el celular cuando entra un pedido, con el panel cerrado.

Estas claves **no se sacan de ningún lado: se generan**. Son un par propio de
tu aplicación.

**Cómo generarlas:**

Abrí una terminal en la carpeta del proyecto y corré:

```bash
npx web-push generate-vapid-keys
```

Te devuelve algo así:

```
=======================================
Public Key:
BEl62iUYgUivxIkv69yViEuiBIa-Ib9-SkvMeAtA3LFgDzkrxZJjSgSnfckjBJuBkr3qBUYIHBQFLXYp5Nksh8U

Private Key:
UUxI4O8-FbRouAevSmBQ6o18hgE4nSG3qwvJTfKc-ls
=======================================
```

**Dónde van:**

```
NEXT_PUBLIC_VAPID_PUBLIC_KEY=<la Public Key>
VAPID_PRIVATE_KEY=<la Private Key>
VAPID_SUBJECT=mailto:tu@email.com
```

La pública lleva `NEXT_PUBLIC_` porque el navegador la necesita para
suscribirse — es pública por diseño. La privada nunca sale del servidor.

> Generalas **una sola vez** y no las cambies. Si las cambiás, todos los
> teléfonos que ya habían activado las notificaciones dejan de recibirlas y
> hay que activarlas de nuevo.

Después de cargarlas y hacer el redeploy: entrá al panel desde el celular,
**Configuración** → **Notificaciones** → **Activar**. En iPhone primero hay
que agregar la app a la pantalla de inicio (Safari → botón compartir →
*Agregar a inicio*); la pantalla te lo explica sola.

---

## 5. Datos de transferencia — cobrar los planes

Sólo para el deploy de SOVARE, donde se venden planes de GastroOS. **En la
instalación de un cliente esto va vacío.**

No se sacan de ningún lado: son los datos de tu propia cuenta bancaria, los
mismos que le pasarías a alguien por WhatsApp.

```
TRANSFER_HOLDER=Nombre y apellido del titular
TRANSFER_BANK=Nombre del banco o billetera
TRANSFER_ALIAS=tu.alias.aca
TRANSFER_CBU=0000003100000000000000
TRANSFER_CUIT=20-12345678-9
```

Si falta el titular, el alias o el CBU, las pantallas `/contratar` y `/alta`
devuelven 404 a propósito: mostrar datos bancarios a medias es peor que no
mostrarlos.

---

## 6. La URL del sitio

Sirve para que los links de los mails apunten a algún lado.

En Vercel **no hace falta cargarla**: se deduce sola del deploy de producción.
Cargala sólo si usás un dominio propio y querés forzarlo:

```
NEXT_PUBLIC_SITE_URL=https://tudominio.com
```

Sin barra al final.

---

## Resumen: qué habilita cada cosa

| Variables | Qué prende | Si falta |
|---|---|---|
| `SUPABASE_SERVICE_ROLE_KEY` | Avisos push + contratación de planes | Sin avisos y sin contratación |
| `RESEND_API_KEY` + `MAIL_FROM` | Los tres mails de pedidos | No sale ningún mail, y la pantalla deja de prometerlo |
| `OPENAI_API_KEY` | Aprobación automática de comprobantes | Los comprobantes esperan aprobación manual |
| `NEXT_PUBLIC_VAPID_PUBLIC_KEY` + `VAPID_PRIVATE_KEY` | Notificaciones al celular | El panel se instala igual, sin avisos |
| `TRANSFER_*` | Las pantallas de contratación | `/contratar` y `/alta` dan 404 |

---

## Si algo no anda

**Cargué las variables y no cambió nada.** Falta el redeploy. Vercel →
**Deployments** → último deploy → **⋯** → **Redeploy**.

**Los mails no llegan.** Entrá a <https://resend.com> → **Logs**. Ahí figura
cada intento con su error. Lo más común es que `MAIL_FROM` use un dominio
distinto al que verificaste.

**Las notificaciones no llegan al iPhone.** Tiene que estar agregada a la
pantalla de inicio y abierta desde ahí. Safari en su ventana normal no recibe
notificaciones, y no avisa por qué.

**La contratación da 404.** Falta alguno de `TRANSFER_HOLDER`,
`TRANSFER_ALIAS`, `TRANSFER_CBU`, o la `SUPABASE_SERVICE_ROLE_KEY`.
