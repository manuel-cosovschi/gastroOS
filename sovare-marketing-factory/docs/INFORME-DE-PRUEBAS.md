# Informe de pruebas (21/10/2026)

Tres clases de prueba, y no se mezclan:

- **Real**: contra sistemas de verdad (repos de los productos, páginas en producción, Chromium + FFmpeg).
- **Simulada contra la API**: el código HTTP real contra un servidor que imita la Graph API de Meta (`tests/mock-graph.ts`). Prueba parámetros, multipart, paginación, verificación y manejo de errores; **no** prueba permisos, revisión de anuncios ni políticas de Meta.
- **Modo de prueba de la Factory**: el sistema entero corriendo con las escrituras a Meta simuladas (`dry_…`).

**Ninguna integración con Meta está validada contra una cuenta real**: no hay credenciales. Cuando estén, `npx tsx src/cli.ts doctor --meta` y la sección «Validación con Meta» de abajo son lo que falta correr.

## Resultado

`npm test` → **54 pruebas, 54 pasan** (`tests/*.test.ts`). `npm run test:render` → render real en 4 formatos, 2 productos, todo validado.

## Las 14 pruebas pedidas

| # | Prueba | Clase | Resultado | Dónde |
|---|---|---|---|---|
| 1 | Descubrimiento de productos | Real | ✅ Los 2 productos del catálogo; 14 repos clasificados; `products_discover` marca los nuevos | `tests/catalog.test.ts` › discover |
| 2 | Extracción de funcionalidades | Real | ✅ Precios de GastroOS (4 planes) y AlojaOS (4 planes) leídos del código; tabla de funcionalidades del README; **todas** las evidencias de claims, ángulos y públicos encontradas en los repos (también después de un commit nuevo en gastroOS durante la sesión) | `tests/catalog.test.ts` |
| 3 | Generación de un creativo | Real | ✅ Conceptos sólo con hechos verificados; el validador rechaza cifras, superlativos, prueba social y testimonios inventados | `tests/creative.test.ts` |
| 4 | Render de un video | Real | ✅ Chromium cuadro a cuadro + FFmpeg; GastroOS 9:16 y 1:1 (plantilla demo, con la grabación real del alta de un pedido); AlojaOS 4:5 y 16:9 (plantilla tour, capturas reales) | `tests/render.e2e.ts` |
| 5 | Validación del archivo | Real | ✅ ffprobe: H.264, yuv420p, medidas exactas, 30 fps, duración, AAC; ningún cuadro vacío | `src/creative/validate.ts` |
| 6 | Preparación de campaña | Simulada / modo prueba | ✅ UTMs y variante `?v=` por anuncio; bloqueos honestos (sin /conv verificada, sin píxel) | `tests/meta.test.ts` |
| 7 | Verificación de cuenta publicitaria | Simulada | ✅ el código lee token, permisos, cuenta, página e IG. ⚠️ **No probada contra Meta real** (sin credenciales) | `tests/meta.test.ts` › verificación de cuenta |
| 8 | Validación de URL /conv | **Real (producción)** | ✅ gastroos.shop/conv y alojaos.shop/conv responden, muestran el texto de las 7 variantes, conservan UTM, guardan `conv_atrib`, sin errores de JS. ❌ **Píxel ausente en los dos** (HTML y navegador) | `src/conversion/landing.ts` |
| 9 | Prueba de eventos | Simulada | ✅ firma HMAC (rechaza firma mala), descarte de datos personales, deduplicación por `event_id`, atribución a campaña/anuncio, Purchase a CAPI; lead firmado contra el servidor HTTP | `tests/meta.test.ts`, `tests/server.test.ts` |
| 10 | Recuperación de métricas | Simulada | ✅ insights por anuncio y día; un lead con dos nombres no se cuenta doble | `tests/meta.test.ts` › métricas |
| 11 | Generación de reporte | Real (con datos de prueba) | ✅ reporte semanal en markdown | `tests/runtime.test.ts`, flujos |
| 12 | Ejecución de tarea programada | Real (local) | ✅ cron en hora argentina, encolado idempotente, tick, latido, health | `tests/runtime.test.ts` |
| 13 | Gestión de errores | Real (local) | ✅ reintento con espera creciente, trabajo muerto con aviso; lo frenado por la política no se reintenta | `tests/runtime.test.ts` |
| 14 | Pausa de emergencia | Simulada + real local | ✅ `pause_all` pausa en la API lo que corre, cancela la cola y frena todo lo que tiene efectos; levantarla exige al dueño | `tests/meta.test.ts`, `tests/policy.test.ts` |

## Seguridad y autorizaciones

| Prueba | Resultado |
|---|---|
| El agente no puede pasar a modo real, ampliar la política ni levantar la pausa | ✅ queda pedido / se niega |
| Topes: por campaña, total diario contando lo activo, % de ajuste automático | ✅ |
| Primer gasto real de un producto exige al dueño; aprobarlo queda como regla | ✅ |
| Link de aprobación con token equivocado | ✅ rechazado |
| El link firmado no le llega al agente (ni en la respuesta ni en las alertas guardadas) | ✅ |
| No hay herramienta MCP para aprobar o levantar la pausa | ✅ |
| Panel: llave del dueño, CSRF en formularios | ✅ |
| Precios u ofertas desde la Factory | ✅ siempre negado |

## Servidor, OAuth y MCP (`tests/server.test.ts`)

✅ `/mcp` sin token → 401 con `resource_metadata`; metadatos de recurso y de servidor de autorización; registro dinámico (rechaza redirecciones que no son de Claude); consentimiento con la llave; PKCE S256; código de un solo uso; refresh rotado; `initialize`, `tools/list` y `tools/call` del MCP real; API con token de máquina; ingesta firmada.

⚠️ No se probó conectando desde Cowork: hace falta el servicio publicado con HTTPS.

## Validación con Meta (pendiente de credenciales)

Cuando estén las credenciales (`docs/PERMISOS.md`), en este orden y todavía en modo de prueba:

1. `doctor --meta` → todo en verde (token, 8 permisos, cuenta activa en ARS, página, IG).
2. `metrics_sync` → lectura real de insights (aunque dé 0 filas).
3. CAPI con `META_TEST_EVENT_CODE` → un `Purchase` de prueba visible en «Probar eventos».
4. `landing_verify` con el píxel instalado → «píxel cargado en el navegador».
5. Modo real + topes chicos → `campaign_push` → revisar en el Administrador de anuncios que todo esté **en pausa** → `campaign_launch` con aprobación → `campaign_refresh` hasta `ACTIVE`.
6. `organic_schedule` de un reel → publicado → `permalink`.

## Ciclo completo y flujos de la Skill

- **«Ejecutá el marketing de Sovare»**, corrida real en modo de prueba: `docs/pruebas/ciclo-completo.md`. Analizó los dos productos, verificó /conv en producción, generó 4 conceptos, renderizó y validó 8 videos y dejó las campañas bloqueadas por la falta de píxel (correcto).
- **Los 11 pedidos de la Skill** contra el servicio corriendo, por la API: `docs/pruebas/flujos-de-la-skill.md`. Incluye: copy con una cifra inventada rechazado; campaña de tráfico creada y «lanzada» en simulación (`dry_…`, «Simulada: no se publicó nada en Meta»); `mode_set live` desde el agente → 403 y autorización pedida; `pause_all` y, con la pausa activa, `campaign_push` → 403.
- **Una pasada del scheduler** sobre esos datos: encoló y corrió `events.pull`, `organic.publish_due` y `health.check`.
- **Panel** revisado en Chromium a 1280 px y 390 px.

## Errores que encontraron las pruebas (corregidos)

1. Levantar la pausa general quedaba bloqueado por la propia pausa.
2. Programar orgánico (sin efectos) pedía aprobación; ahora se pide al publicar.
3. La CLI pasaba una lista vacía de productos y el ciclo no hacía nada.
4. En modo de prueba, crear en Meta exigía `META_AD_ACCOUNT_ID`; ahora la simulación funciona sin cuenta y lo deja registrado.
5. El link firmado de una autorización volvía a quien la pedía y quedaba guardado en las alertas (que el agente puede leer). Ahora va sólo por los canales del dueño.
6. Render: en 9:16 el texto quedaba chico, la grabación tenía 1,3 s y con tres recursos las transiciones se comían la escena; en 1:1 y 4:5 el rótulo se pisaba con la marca.
