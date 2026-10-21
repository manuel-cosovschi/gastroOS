# Operaciones

Mismo nombre en los tres caminos: herramienta MCP `smf_<nombre>`, `node scripts/smf.mjs <nombre> '<json>'`, o `npm run smf -- op <nombre> '<json>'`.

## Estado y catálogo

| Operación | Entrada | Para qué |
|---|---|---|
| `status` | — | Modo, pausa, política, integraciones, salud, contadores. **Primero siempre.** |
| `products_list` | — | Productos, hechos verificados (claims, ángulos, planes), bloqueos, /conv y píxel |
| `product_analyze` | `refresh?` | Relee los repos, verifica evidencias, detecta cambios |
| `products_discover` | `github_owner?` | Repos sin clasificar (no los agrega) |
| `landing_verify` | `product?` | Verifica /conv: respuesta, texto de cada `?v=`, UTM, cookie de atribución, píxel |

## Creativos

| Operación | Entrada | Para qué |
|---|---|---|
| `concepts_generate` | `product`, `count?`, `angles?`, `templates?` (`demo`/`tour`/`kinetic`), `with_price?` | Conceptos a partir de lo verificado |
| `concept_create_custom` | `product`, `angle`, `hook`, `headline`, `primary_text`, `cta`, `bullets?`, `template?` | Copy propio, validado |
| `concepts_list` | `product?` | |
| `creatives_render` | `concept`, `formats` (`reels_9x16`, `feed_4x5`, `square_1x1`, `landscape_16x9`), `duration?` | Encola renders; devuelve trabajos |
| `creatives_list` | `product?`, `status?` | Videos, validación, archivos |
| `job_status` | `job` | Avance y resultado de un trabajo |

## Campañas de Meta

| Operación | Entrada | Nivel |
|---|---|---|
| `campaign_prepare` | `product`, `creatives[]`, `daily_budget` (ARS), `objective?` (`leads`/`traffic`), `name?` | 1 |
| `campaign_push` | `campaign` | 2 — crea todo EN PAUSA y lo lee de vuelta |
| `campaign_launch` | `campaign` | 2 (3 si es el primer gasto real del producto o supera topes) |
| `campaign_pause` | `campaign`, `reason?` | siempre |
| `campaign_budget` | `campaign`, `daily_budget` | 2 dentro de topes |
| `campaign_refresh` | `campaign` | lee estado y revisión reales |
| `campaign_get` / `campaigns_list` | | |
| `pause_all` | `reason` | freno de emergencia |
| `meta_verify_account` | — | token, permisos, cuenta, página, Instagram (lectura real) |

## Resultados

| Operación | Entrada | Para qué |
|---|---|---|
| `metrics_sync` | `days?` | Trae insights de Meta por anuncio y día |
| `performance` | `days?` | Gasto, CTR, CPC, CPM, consultas (Meta y confirmadas), compras, ingresos, CAC, ROAS; mejores anuncios |
| `events_list` | `product?`, `type?`, `days?` | Consultas y compras confirmadas, con campaña de origen |
| `optimize_analyze` | — | Qué haría el optimizador y por qué |
| `optimize_run` | — | Ejecuta lo autorizado, propone el resto |
| `report_weekly` | `days?` | Reporte en markdown |

## Orgánico

| Operación | Entrada |
|---|---|
| `organic_schedule` | `product`, `creatives[]`, `channel` (`instagram`/`facebook`), `at` (ISO), `kind?`, `caption?` |
| `organic_calendar` | `from?`, `to?` |
| `organic_cancel` | `post` |

## Ciclo completo y operación

| Operación | Entrada | Para qué |
|---|---|---|
| `marketing_run` | `products?`, `launch?` | Todo el ciclo, en el ejecutor. Devuelve un trabajo |
| `approvals_list` | `status?` | Autorizaciones |
| `approval_request` | `action` (nivel 3), `summary`, `scope?` | Pedirle algo al dueño |
| `mode_set` | `mode` | `test` siempre; `live` queda pedido |
| `policy_update` | `patch` | Restringir se aplica; ampliar queda pedido |
| `settings_get` / `settings_update` | `key` (`campaign_defaults`/`optimizer`), `value` | Presupuesto por producto para borradores, formatos, CPL objetivo |
| `alerts_list`, `audit_log`, `jobs_list`, `schedules_list`, `schedule_update` | | |

## Ejemplos

```json
// smf_campaign_prepare
{ "product": "gastroos", "creatives": ["crv_…", "crv_…"], "daily_budget": 5000 }
// smf_concept_create_custom
{ "product": "alojaos", "angle": "comision", "hook": "Para complejos que hoy le pagan a un portal",
  "headline": "Tus reservas, sin comisión", "primary_text": "…", "cta": "Consultá", "bullets": ["sin-comision", "sena-a-tu-cuenta"] }
```
