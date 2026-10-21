---
name: sovare-marketing-factory
description: Opera la Sovare Marketing Factory, el sistema de marketing de los productos de SOVARE (GastroOS, AlojaOS y los que se sumen al catálogo). Usala cuando pidan analizar productos de Sovare, crear campañas o videos publicitarios, publicar o pausar anuncios de Meta (Facebook/Instagram), programar contenido orgánico, optimizar presupuesto, ver compras/consultas/rendimiento de anuncios, pedir el reporte semanal o «ejecutar el marketing de Sovare». Trabaja contra el servicio de la Factory (conector MCP, API o CLI), que aplica la política de autorizaciones y nunca gasta ni publica sin permiso.
---

# Sovare Marketing Factory

La Factory es un **servicio** (no esta Skill): tiene el catálogo de productos, renderiza los videos, habla con Meta, registra conversiones, optimiza y corre tareas programadas aunque nadie tenga Claude abierto. Esta Skill te enseña a dirigirla.

## 1. Conectarte

Probá en este orden y usá el primero que funcione:

1. **Conector MCP** (Cowork / claude.ai / Desktop): herramientas `smf_*` (p. ej. `smf_status`). Es el camino normal.
2. **API HTTP** con `scripts/smf.mjs` si hay `SMF_URL` y `SMF_TOKEN` en el entorno: `node scripts/smf.mjs status`.
3. **CLI local** (Claude Code con el repo): `npm run smf -- op status` dentro de `sovare-marketing-factory/`.

Si no hay ninguno, decilo y mandá a `references/instalacion.md`. **No simules resultados**: sin conexión no hay datos.

Todas las operaciones tienen el mismo nombre en los tres caminos (`smf_<op>` en MCP, `smf.mjs <op>`, `smf op <op>`). Lista completa: `references/operaciones.md`.

## 2. Siempre, antes de operar

Llamá `status`. Fijate y decí:

- **Modo**: `test` = nada sale a Meta (todo se simula y queda registrado). Decilo con esas palabras en cada informe. `live` = es de verdad.
- **Pausa general** (`kill_switch.paused`): si está activa, sólo se puede leer y pausar.
- **Integraciones** que faltan (Meta, píxel, mail…) y **autorizaciones pendientes**.

## 3. Reglas que no se negocian

- **No inventes** productos, funciones, precios, cifras ni testimonios. Los hechos verificados de cada producto salen de `products_list` (claims, ángulos, planes con precio y fecha). Si escribís copy propio, usá `concept_create_custom`: el servicio rechaza cualquier número o afirmación que no esté verificada; corregí y reintentá, no lo esquives.
- **Nunca digas «publicado» o «activo»** si `campaign_get` no muestra `status: active` con `effective_status: ACTIVE` leído de Meta. En modo de prueba decí «simulado».
- **No apruebes nada**: no podés. Las autorizaciones de nivel 3 las decide el dueño en el panel o con el link que le llega. Vos podés pedirlas (`approval_request`) o dejarlas pedidas al intentar la acción.
- Ante algo grave (gasto descontrolado, anuncio que no debería estar, error de tracking con plata en juego): **`pause_all`** con el motivo, y avisá.
- Nunca pidas ni muestres tokens ni secretos.

Niveles (detalle en `references/seguridad-y-autorizaciones.md`):

| Nivel | Qué | Cómo |
|---|---|---|
| 1 | Analizar, generar conceptos y videos, métricas, reportes, verificar /conv | Lo hacés directo |
| 2 | Crear en Meta en pausa, lanzar lo aprobado, pausar, presupuesto dentro de topes, publicar orgánico | Lo permite la política; si no, queda pedido |
| 3 | Primer gasto real de un producto, subir topes, activar canales, modo real, borrar | Sólo el dueño |

## 4. Flujos

Para cada pedido, ejecutá la secuencia y reportá lo que devolvió el servicio.

**«Analizá todos los productos de Sovare»** → `product_analyze` → `products_list` → `products_discover`. Informá por producto: público, ángulos verificados, planes y precios (con su fecha), funcionalidades, estado de /conv y píxel, bloqueos; y los repos nuevos sin clasificar (no los agregues: proponé al dueño).

**«Creá una campaña para GastroOS»** → `landing_verify {product}` → `concepts_generate {product, count: 3}` → `creatives_render {concept, formats: ["reels_9x16","feed_4x5"]}` por concepto → esperá con `job_status` → `campaign_prepare {product, creatives, daily_budget}` (si no te dieron presupuesto, preguntá; no lo inventes) → si quedó `blocked`, explicá cada bloqueo y qué hace falta; si quedó `prepared`, `campaign_push` (queda en pausa). Lanzar es otro paso y lo pide el usuario.

**«Generá cinco videos para AlojaOS»** → `concepts_generate {product: "alojaos", count: 5}` → `creatives_render` (9:16 por defecto) → `job_status` hasta terminar → `creatives_list {product}`: pasá ids, formato, estado de validación y dónde verlos (panel → Creativos).

**«Mostrame los anuncios que mejor convierten»** → `metrics_sync` → `performance {days: 7}`. Ordená por costo por consulta y marcá los de muestra chica como **no concluyentes**. Mostrá Meta vs. confirmadas por el producto.

**«Prepará las campañas de todos los productos»** → `marketing_run {launch: false}` → `job_status` → resumen por producto con cada paso (`done`, `blocked`, `needs_approval`).

**«Publicá las campañas aprobadas»** → `campaigns_list {status: "in_meta_paused"}` → `campaign_launch` cada una → `campaign_get` para confirmar el estado real. Si devuelve `needs_approval`, decí qué se pidió y que le llegó al dueño.

**«Optimizá el presupuesto autorizado»** → `metrics_sync` → `optimize_analyze` (mostrá hallazgos con evidencia) → `optimize_run` → informá qué se ejecutó y qué quedó propuesto. No saques conclusiones con muestras chicas: el servicio ya las marca.

**«Mostrame las compras generadas por Meta Ads»** → `events_list {type: "purchase"}` (y `customer` para AlojaOS, que vende asistido) → separá atribuidas a campaña/anuncio de las sin atribuir; sumá ingresos.

**«Pausá todas las campañas»** → `pause_all {reason}` → `campaigns_list` para confirmar. Recordá que levantar la pausa es del dueño.

**«Dame el reporte semanal»** → `metrics_sync` → `report_weekly {days: 7}` → devolvé el markdown.

**«Ejecutá el marketing de Sovare»** → `status` → `marketing_run` → `job_status` hasta `done` → informe: por producto, qué se hizo, qué está bloqueado (con el porqué) y qué espera autorización. Si está en modo de prueba, decilo arriba de todo.

**Activar automatizaciones** → `schedules_list` / `schedule_update`. Las tareas corren solas en el servicio (también con Claude cerrado). Activar canales o piloto automático ampliado se pide con `approval_request` o `policy_update` (queda pedido).

## 5. Cómo informar

- Primero el estado: modo, pausa, bloqueos.
- Después lo hecho, con ids (campaña, creativo, trabajo) para que se pueda revisar en el panel.
- Después lo que falta y quién lo hace (dueño / configuración / producto).
- Números con su fuente («según Meta», «confirmado por la base de GastroOS») y el período.
- Sin adornos ni promesas de resultados.

## Referencias

- `references/operaciones.md` — todas las operaciones, entradas y ejemplos.
- `references/productos.md` — cómo está armado el catálogo y cómo leerlo.
- `references/marca.md` — identidad visual y tono por producto.
- `references/estrategia-creativa.md` — ángulos, plantillas y formatos.
- `references/meta-ads.md` — cómo se crean y verifican campañas.
- `references/optimizacion.md` — reglas y muestras mínimas.
- `references/conversiones.md` — /conv, píxel, CAPI, eventos y atribución.
- `references/seguridad-y-autorizaciones.md` — niveles, pausa general, qué nunca hacer.
- `references/instalacion.md` — conectar Cowork y qué hace falta del lado del servicio.
