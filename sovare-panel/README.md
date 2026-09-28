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
