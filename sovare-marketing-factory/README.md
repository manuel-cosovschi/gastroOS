# Sovare Marketing Factory

El sistema de marketing de los productos de SOVARE: descubre y analiza los productos desde sus repositorios, genera videos con capturas y grabaciones reales, crea y opera campañas en Meta, publica orgánico en Instagram y Facebook, mide consultas y compras, optimiza dentro de reglas autorizadas y avisa sólo lo importante. Corre solo (tareas programadas) y se dirige desde Claude Cowork con la Skill **`sovare-marketing-factory`**.

**Estado**: funciona de punta a punta en **modo de prueba**. Las integraciones con Meta están implementadas y probadas contra un servidor que imita la Graph API, pero **no fueron validadas con una cuenta real** porque todavía no hay credenciales (ver `docs/PERMISOS.md`). Informe completo: `docs/INFORME-DE-PRUEBAS.md`.

## Qué hay

| Módulo | Carpeta | Qué hace |
|---|---|---|
| Product Intelligence | `src/catalog/`, `catalog/` | Catálogo editable (JSON) donde cada claim, ángulo y precio tiene una evidencia en el repo del producto, verificada en cada análisis. Precios leídos del código con el AST de TypeScript. Detecta cambios y repos nuevos |
| Creative Engine | `src/creative/` | Conceptos a partir de lo verificado; validador de copy (bloquea números y afirmaciones sin respaldo); composición HTML animada; render cuadro a cuadro con Chromium + FFmpeg en 9:16, 4:5, 1:1 y 16:9; validación con ffprobe; proyecto editable por video |
| Meta Ads | `src/meta/ads.ts`, `graph.ts` | Graph API v26: campañas, conjuntos, creativos y anuncios en pausa, verificados leyéndolos; lanzamiento que sólo se informa activo si Meta lo confirma; pausa; presupuesto; insights; límites de uso y reintentos; modo simulado |
| Orgánico | `src/meta/organic.ts` | Reels, imágenes y carruseles en Instagram; videos y fotos en Facebook; calendario; tope de 24 h |
| Conversión | `src/conversion/` | Verificación de /conv en navegador (sin mandar eventos), eventos firmados con HMAC, lectura de las bases de los productos (sólo lectura, sin datos personales), deduplicación, atribución por UTM, Purchase por CAPI |
| Optimización | `src/optimize/` | CTR, CPC, CPM, CPL, CAC, ROAS, conversión de landing, calidad; muestra mínima e intervalos de Wilson; fatiga; reparto prudente de presupuesto |
| Avisos | `src/notify/` | Compras, consultas, autorizaciones y problemas por mail, Telegram o webhook |
| Runtime | `src/runtime/` | Cola en Postgres idempotente, cron en hora argentina, reintentos, latidos, health; `smf serve` o `smf tick` |
| Seguridad | `src/core/policy.ts` | Niveles 1/2/3 aplicados en código, pausa general, topes, canales, autorizaciones que sólo decide el dueño, registro de todo |
| Servidor | `src/server/` | MCP para Cowork con OAuth 2.1, API, panel del dueño |
| Skill | `skill/sovare-marketing-factory/` | Instrucciones operativas, referencias y cliente HTTP; `npm run skill:pack` arma el ZIP para Cowork |

## Empezar (local, modo de prueba)

```bash
npm install
npx tsx src/cli.ts doctor                 # qué está configurado
npx tsx src/cli.ts op product_analyze     # analiza los repos de al lado (../gastroOS, ../alojaOS)
npx tsx src/cli.ts op landing_verify      # verifica las /conv en producción
npx tsx src/cli.ts run --render           # el ciclo completo, simulado
npx tsx src/cli.ts serve                  # API + MCP + panel en :8787
```

Sin `DATABASE_URL` usa PGlite en `./data`. Los repos de los productos se buscan en la carpeta de al lado (`SMF_REPOS_DIR`) o se clonan.

## Documentación

- `docs/AUDITORIA.md` — lo que se encontró en el ecosistema.
- `docs/ARQUITECTURA.md` — cómo está armado y por qué.
- `docs/INSTALACION.md` — servicio, base, Cowork, Claude Code, pasar a real.
- `docs/PERMISOS.md` — credenciales y permisos pendientes, exactos.
- `docs/AGREGAR-PRODUCTO.md` — sumar un producto sin tocar la Skill.
- `docs/PENDIENTES.md` — cambios propuestos en los productos.
- `docs/INFORME-DE-PRUEBAS.md` — qué se probó, cómo, y qué no.

## Pruebas

```bash
npm test            # 48 pruebas: política, catálogo, Meta (simulado), runtime, servidor/OAuth/MCP
npm run test:render # render real de punta a punta (Chromium + FFmpeg)
```
