# «Ejecutá el marketing de todos los productos de Sovare» — corrida real en modo de prueba

Inicio 2026-10-21T02:27:29.411Z · fin 2026-10-21T02:39:23.002Z (12 minutos, con 8 renders reales).

`npx tsx src/cli.ts run --render` con `campaign_defaults.daily_budget_ars = {gastroos: 5000, alojaos: 5000}` y 2 conceptos por producto.

## alojaos

| Paso | Estado | Detalle |
|---|---|---|
| catálogo | done | hechos verificados (7 claims, 3 ángulos, 4 planes) |
| /conv | done | responde y muestra cada variante; píxel: NO instalado |
| conceptos | done | 2 concepto(s) nuevo(s) |
| creativos | done | 4 renderizado(s) y validado(s) |
| campaña | blocked | no hay píxel configurado para alojaos (META_PIXEL_ID_ALOJAOS): no se puede optimizar por consultas |
| orgánico | skipped | orgánico apagado en campaign_defaults.organic |

## gastroos

| Paso | Estado | Detalle |
|---|---|---|
| catálogo | done | hechos verificados (8 claims, 4 ángulos, 4 planes) |
| /conv | done | responde y muestra cada variante; píxel: NO instalado |
| conceptos | done | 2 concepto(s) nuevo(s) |
| creativos | done | 4 renderizado(s) y validado(s) |
| campaña | blocked | no hay píxel configurado para gastroos (META_PIXEL_ID_GASTROOS): no se puede optimizar por consultas |
| orgánico | skipped | orgánico apagado en campaign_defaults.organic |

Las campañas quedan **bloqueadas** por la falta de píxel: es el comportamiento esperado (política `require_pixel_for_conversion_campaigns`). Con objetivo «tráfico» (elegido a propósito) la campaña se prepara, se crea en Meta y se lanza en simulación: ver `flujos-de-la-skill.md`.
