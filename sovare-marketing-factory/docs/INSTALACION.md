# Instalación

Tres piezas: **el servicio** (hace el trabajo), **la base** (Postgres) y **la Skill** (le enseña a Claude a dirigirlo).

## 1. Base de datos

Un Postgres cualquiera. Recomendado: un proyecto de Supabase **nuevo** (`sovare-marketing`) para no mezclar con las bases de los productos. Las migraciones se aplican solas al arrancar (esquema `smf`).

`DATABASE_URL` = cadena de conexión (Supabase → Project Settings → Database). Si el hosting no tiene IPv6, usar la del *pooler* en modo sesión.

## 2. Servicio

### Opción A — Docker (recomendada: API + MCP + panel + scheduler + render)

```bash
cp .env.example .env      # completar
docker build -t sovare-marketing-factory .
docker run -d --name smf --restart unless-stopped --env-file .env -p 8787:8787 -v smf-out:/app/out sovare-marketing-factory
```

Sirve en cualquier VPS o en Railway / Fly.io / Render (puerto `PORT`, healthcheck `/healthz`). Tiene que estar detrás de HTTPS con la URL de `SMF_PUBLIC_URL`. Necesita ~1 GB de RAM para renderizar.

### Opción B — Sólo GitHub Actions (sin servidor)

`.github/workflows/scheduler.yml` corre `smf tick` cada 15 min con la base de producción. Cargar los secretos del repo (`DATABASE_URL` y los de Meta, avisos, Supabase Storage, lectura de productos). Sirve para que las tareas programadas corran solas, **pero sin servicio no hay MCP ni panel**: Cowork no se puede conectar. Útil como respaldo del render.

### Comprobar

```bash
npx tsx src/cli.ts doctor          # qué está configurado
npx tsx src/cli.ts doctor --meta   # lectura real de la cuenta de Meta
curl https://<servicio>/healthz
```

Panel: `https://<servicio>/panel` (llave `SMF_OWNER_KEY`).

## 3. Claude Cowork

Cowork no hereda nada de Claude Code: ni repos, ni archivos, ni conectores, ni variables, ni permisos de Meta. Todo pasa por el servicio.

1. **Skill**: `npm run skill:pack` genera `dist/sovare-marketing-factory.zip` (la carpeta de la Skill en la raíz). En Claude: *Personalizar → Skills* (o *Configuración → Capacidades*) → **Subir skill** → elegir el ZIP → activarla. Requiere «Ejecución de código y creación de archivos» activado; en planes Team/Enterprise, que un owner habilite Skills.
2. **Conector**: *Configuración → Conectores → Agregar conector personalizado* → URL `https://<servicio>/mcp`. Claude descubre el OAuth del servicio, abre la pantalla de consentimiento de la Factory: escribir `SMF_OWNER_KEY` → **Permitir**. En organizaciones, lo agrega un Owner.
3. Probar en Cowork: «¿En qué estado está la Marketing Factory?» → tiene que llamar `smf_status`.

El token que recibe Claude actúa como **agente**: opera dentro de la política y pide autorizaciones; no puede aprobarlas. Para cortar el acceso: panel → Configuración → *Revocar todos los accesos OAuth*.

## 4. Claude Code

En la carpeta del repo, la Skill se puede usar directo (`skill/sovare-marketing-factory`) y las operaciones con `npm run smf -- op <operación> '<json>'`. Para Claude Code como cliente MCP: `claude mcp add --transport http sovare-factory https://<servicio>/mcp` (hace el mismo OAuth con un puerto local).

## 5. Productos → Factory (opcional, recomendado)

- **Lectura de bases** (sin tocar los productos): crear un rol de sólo lectura en cada base y cargar `ALOJAOS_DATABASE_URL` / `GASTROOS_DATABASE_URL` (SQL en `docs/PERMISOS.md`).
- **Eventos empujados**: los productos pueden mandar `POST /api/events` firmado con `SMF_INGEST_SECRET` (formato en `src/conversion/events.ts`). Usar uno de los dos caminos por producto, no ambos (los `event_id` difieren).

## 6. Pasar a real

En este orden, todo desde el panel:
1. Cargar credenciales de Meta y del píxel; `doctor --meta` en verde.
2. Verificar /conv con el píxel instalado (`landing_verify`).
3. Política: topes de presupuesto, canales (`meta_ads`, `instagram`), piloto automático deseado.
4. Configuración → **Pasar a modo REAL**.
5. Lanzar la primera campaña de cada producto → llega el pedido «primer gasto real» → aprobar.
