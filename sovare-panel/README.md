# Panel SOVARE

Sistema interno para manejar los clientes de GastroOS: quién es cada uno, en
qué estado está, dónde vive su instalación y cuánto debe.

No es parte del producto. Vive en esta carpeta por comodidad, pero es una
aplicación aparte con su propio `package.json`, su propio build y su propio
deploy.

---

## Qué muestra

| Pantalla | Qué resuelve |
|---|---|
| **Resumen** | Ingreso recurrente, clientes por estado, cobrado y vencido del mes, próximos cobros, próximos pasos del embudo y cobranza de los últimos 6 meses. |
| **Clientes** | Listado con filtro por estado y búsqueda. Cada ficha tiene contacto, suscripción, datos de su instalación, historial de cobros y seguimiento. |
| **Cobros** | Todos los cobros con su estado, filtrables. Se marcan pagados de a uno. |
| **Mis vendedores** | Los vendedores a comisión: cada uno carga sus clientes desde su página, vos los aprobás, y a fin de mes liquidás y transferís. Ver abajo. |

### El embudo

`Prospecto` → `En implementación` → `Activo` → (`Pausado`) → (`Baja`)

Un prospecto y un cliente activo son la misma ficha en distinto momento, no dos
registros: cuando cierra, no hay que copiar nada.

Cambiar el estado desde la ficha completa las fechas solo — pasar a *activo*
pone la fecha de alta si falta, pasar a *baja* pone la de baja. Sin eso, la
antigüedad de un cliente queda en la nada.

### Generar los cobros del mes

El botón crea la mensualidad de cada cliente **activo** con monto cargado,
usando su día de cobro. Es idempotente: la clave única `(cliente, período,
concepto)` hace que correrlo dos veces no duplique nada.

---

## Contrataciones: qué pasa al aprobar un pago

Un pago lo aprueba la IA al leer el comprobante o lo aprobás vos desde la
contratación. En los dos casos pasa lo mismo, según el plan:

| Plan | Qué pasa solo |
|---|---|
| **Taller** (sin puesta a punto) | Se crea el negocio con su tienda en `tunegocio.gastroos.shop`, la cuenta del dueño, su ficha de cliente y el cobro del primer mes (ya pagado). Le llega un mail para elegir su contraseña y entrar. |
| **Negocio en adelante** | Le llega el mail con el formulario de alta. El sistema lo armás vos. |

Qué hace falta saber:

- **Vos no hacés nada más.** Aprobar a mano ejecuta lo mismo que la IA: el panel le
  pide a la landing que cree la cuenta y mande el mail (la clave de servicio y la
  de Resend viven allá, no acá). La landing comprueba que el pedido viene de un
  administrador usando tu propia sesión; no hay una clave compartida entre los dos
  proyectos.
- **Te avisan por mail** (a `NEXT_PUBLIC_CONTACT_EMAIL` de la landing) cuando entra
  un pago que aprobó la IA, cuando hay un comprobante para revisar, cuando
  completan el alta y cuando una tienda no se pudo crear.
- **La tarjeta «Tienda y acceso»** de cada contratación aprobada tiene lo que se
  puede repetir sin riesgo: *Crear su negocio y su cuenta* (también por adelantado
  en los planes con puesta a punto), *Reenviar el mail*, *Reenviar el acceso* (si
  alguien perdió su contraseña) y, en los planes con puesta a punto, *Avisarle que
  está lista*, con la dirección donde entra y un renglón tuyo.
- **Si el mail del cliente ya tiene una cuenta**, no se la toca: la tienda no se
  crea y la contratación lo marca en rojo en el listado. Se resuelve a mano.
- Está en `supabase/006_tiendas.sql` (`sovare.provision_business()`); el código que
  lo ejecuta es `src/lib/signup-flow.ts` de la landing.

---

## Vendedores a comisión

El circuito, de punta a punta:

1. **Agregás al vendedor** en *Mis vendedores*. Te queda su link
   (`gastroos.shop/vendedor/<token>`) y un botón para mandárselo por WhatsApp ya
   escrito. No tiene cuenta ni contraseña: el link es todo lo que lo identifica.
2. **Él carga los clientes que cerró** desde esa página. Cada carga queda
   *pendiente* y te llega un mail. Hasta que la apruebes no suma a nadie.
3. **Vos aprobás** (o rechazás, con un motivo que él lee). Al aprobar se acredita
   la comisión: por defecto el **50% de la cuota mensual del plan** (sin la puesta
   a punto), y el importe se puede corregir antes de aprobar. Se congelan la cuota,
   el porcentaje y el importe: un cambio de precios o de porcentaje después no
   mueve lo ya acreditado.
4. **El saldo es del mes en que aprobaste** (hora argentina). No es un número
   guardado: es la suma de lo aprobado y sin liquidar.
5. **A fin de mes liquidás**: se junta el saldo de ese mes en una cifra. Le
   transferís, y la marcás *pagada* con el número de operación.

Lo que se puede deshacer, y hasta dónde:

| Acción | Cuándo se puede |
|---|---|
| Anular una venta aprobada | Mientras no esté en una liquidación. |
| Deshacer una liquidación | Mientras no esté pagada. Queda registrada como *deshecha*, no se borra. |
| Deshacer un pago | Siempre. Vuelve a *a transferir*. |
| Eliminar un vendedor | Sólo si todavía no cargó nada. Con clientes se lo pausa. |

Dos cosas que conviene saber:

- **Aprobar no mira si el cliente pagó.** La aprobación es tu control. Antes de
  aprobar, la pantalla muestra si el cliente ya aparece en otra venta, en una
  contratación o como ficha, comparando mail, teléfono y nombre.
- **El link se puede cambiar** (*Generar un link nuevo*) si fue a un chat
  equivocado. El anterior deja de funcionar al instante.

Las funciones que mueven plata (`decide_vendor_sale`, `void_vendor_sale`,
`settle_vendor_period`, `unsettle_vendor`, `mark_settlement_paid`) viven en la
base y hacen todas sus escrituras en una transacción. La landing recibe sólo
permiso de leer y de insertar ventas pendientes: no puede aprobar ni liquidar.
Está en `supabase/005_vendedores.sql`.

---

## Dos convenciones de los números

- El **ingreso recurrente** sale de la ficha del cliente (lo que debería
  facturar), no de los cobros emitidos. Si un mes no generaste los cobros, el
  recurrente no baja.
- Lo **cobrado** cuenta por período, no por fecha de pago. Un cobro de
  septiembre pagado en octubre suma a septiembre.

Y *vencido* se calcula comparando la fecha, no leyendo el estado guardado:
nadie va a entrar todos los días a marcar los que vencieron.

---

## Base de datos

Las tablas viven en el esquema **`sovare`** del mismo proyecto de Supabase que
la demo de GastroOS. No comparten nada: son esquemas distintos y el acceso pasa
por `sovare.is_admin()`.

Ese chequeo no es decorativo. La `anon key` de ese proyecto es pública —viaja en
la landing— y el usuario de la demo es un usuario autenticado más. Una policy
que dijera `authenticated` le abriría la facturación de SOVARE a cualquiera que
entre a la demo. Por eso es una **lista blanca de user_ids** (`sovare.admins`),
no un rol.

```
sovare.admins       quién puede entrar
sovare.clients      la ficha entera: contacto, estado, instalación, suscripción
sovare.payments     un cobro por cliente, período y concepto
sovare.activities   seguimiento, con próximo paso y fecha
sovare.vendors      los vendedores a comisión, su porcentaje y su link
sovare.vendor_sales        lo que cargó cada vendedor, y qué se decidió
sovare.vendor_settlements  las liquidaciones mensuales y su pago
sovare.vendor_period_balances  (vista) el saldo por vendedor y mes
```

### Dar de alta a alguien

```sql
INSERT INTO sovare.admins (user_id, email)
SELECT id, email FROM auth.users WHERE email = 'quien@sea.com';
```

El usuario tiene que existir antes en Supabase Auth.

### Cuando haya plan Pro

Mover el esquema a su propio proyecto es un `pg_dump -n sovare` y restaurarlo
del otro lado. Nada del código cambia salvo las dos variables de entorno.

---

## Correrlo

```bash
cd sovare-panel
npm install
cp .env.example .env.local   # completá URL y anon key del proyecto
npm run dev
```

| Comando | Qué hace |
|---|---|
| `npm run dev` | Servidor de desarrollo |
| `npm run build` | Build de producción |
| `npm run lint` | ESLint |
| `npm run typecheck` | TypeScript sin emitir |

---

## Deploy

Es un proyecto de Vercel aparte del de GastroOS, apuntando al mismo
repositorio pero con **Root Directory = `sovare-panel`**. Las dos variables
(`NEXT_PUBLIC_SUPABASE_URL` y `NEXT_PUBLIC_SUPABASE_ANON_KEY`) son las mismas
que las de la demo.

El panel no se indexa (`robots: noindex`) y todo exige sesión, pero si querés
una capa más, Vercel tiene protección por contraseña a nivel de proyecto.

---

## Mudarlo a su propio repositorio

Cuando puedas crearlo, esta carpeta sale entera sin perder historia:

```bash
git subtree split --prefix=sovare-panel -b sovare-panel-only
# creás el repo vacío en GitHub y después:
git push git@github.com:<vos>/sovare-panel.git sovare-panel-only:main
```

Después se borra la carpeta de gastroOS y se cambia el Root Directory del
proyecto de Vercel. Conviene hacerlo: mientras viva acá, cada fork que hagas
para un cliente se lleva el código de tu panel interno adentro.
