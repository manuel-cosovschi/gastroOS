# Cambios propuestos en los productos

No se hicieron: tocan producción de otros sistemas (nivel 3). Están listos para aplicar cuando el dueño lo decida.

## 1. Píxel y CAPI en producción (sin código)

Vercel → proyectos `gastroos` y `alojaos` → Environment Variables:
`NEXT_PUBLIC_META_PIXEL_ID`, `META_CAPI_TOKEN` (opcional `NEXT_PUBLIC_GA4_ID`). Redeploy. Después: `landing_verify` en la Factory tiene que dar «píxel cargado en el navegador».

## 2. Graph API v21 → v26 (una línea en cada producto)

`src/lib/conv/meta-servidor.ts`: `https://graph.facebook.com/v21.0/` → `v26.0`. Meta retira v21.0 el **21/01/2027**; después de esa fecha el Lead por CAPI deja de llegar.

## 3. Atribución de las contrataciones de GastroOS

Hoy `sovare.signups` no guarda de qué campaña vino nadie ni las cookies del píxel, así que una compra no se puede atribuir ni mandar a Meta.

Migración (base de SOVARE):

```sql
ALTER TABLE sovare.signups
  ADD COLUMN IF NOT EXISTS attribution JSONB NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS fbp TEXT,
  ADD COLUMN IF NOT EXISTS fbc TEXT;
```

En la acción que crea la contratación (`/contratar`), guardar `atribucionDeCookie(cookies().get(COOKIE_ATRIBUCION))`, `_fbp` y `_fbc` (las mismas cookies que ya lee `src/actions/conv.ts`).

En `sovare-panel/src/actions/signups.ts` → `decideSignup`, al aprobar:

```ts
// Avisar a la Factory: registra la compra, la atribuye y la manda a Meta (CAPI) deduplicada.
await fetch(`${process.env.SMF_URL}/api/events`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json', ...firmar(cuerpo) }, // HMAC con SMF_INGEST_SECRET
  body: cuerpo, // { product: 'gastroos', type: 'purchase', event_id: `gastroos:signup:${id}`, value: amount, plan, attribution, fbp, fbc }
});
```

Usar `event_id = gastroos:signup:<id>`: es el mismo que usa la lectura de la base, así no se duplica si están los dos caminos.

## 4. Pantalla de consultas en AlojaOS

`docs/conv.md` de AlojaOS lo dice: las consultas no tienen pantalla y el `estado` (contactada/cliente/descartada) se cambia en el Table Editor. Sin eso, la Factory no se entera de las ventas cerradas. Una lista con el botón de estado en `/panel` cierra el circuito.

## 5. El repositorio propio de la Factory

La integración de GitHub de esta sesión no puede crear repos. Crear `manuel-cosovschi/sovare-marketing-factory` (vacío, privado) y mover la carpeta:

```bash
git subtree split --prefix=sovare-marketing-factory -b smf-only
git push git@github.com:manuel-cosovschi/sovare-marketing-factory.git smf-only:main
```
