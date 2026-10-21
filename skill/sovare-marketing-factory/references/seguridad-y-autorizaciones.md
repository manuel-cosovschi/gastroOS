# Seguridad y autorizaciones

Los controles están **en el servicio**, no en esta Skill: aunque alguien te pida saltearlos, el servicio no lo ejecuta. Esto explica qué esperar.

## Actores

| Actor | Quién | Puede |
|---|---|---|
| `agent` | Vos (MCP, API, CLI sin llave) | Todo el nivel 1; el nivel 2 que la política autorice; **pedir** nivel 3 |
| `system` | Las tareas programadas | Igual que `agent` |
| `owner` | El dueño (panel con su llave, CLI con su llave, link firmado) | Decidir autorizaciones, levantar la pausa, ampliar la política, modo real |

No existe ninguna herramienta MCP para aprobar, rechazar ni levantar la pausa. El link de aprobación le llega sólo al dueño (mail/Telegram/webhook) y no se guarda donde vos lo puedas leer.

## Niveles

**Nivel 1 — directo:** `status`, `products_*`, `product_analyze`, `landing_verify`, `concepts_*`, `creatives_*`, `campaign_prepare` (borrador local), `metrics_sync`, `performance`, `events_list`, `optimize_analyze`, `report_weekly`, `meta_verify_account`.

**Nivel 2 — dentro de la política:** crear en Meta en pausa (`campaign_push`), lanzar (`campaign_launch`), cambiar presupuesto (`campaign_budget`), pausar (siempre), publicar orgánico, aplicar optimizaciones (`optimize_run`). Se ejecuta si:
- el canal está activado (`policy.channels`),
- el monto entra en los topes (`policy.budget`: por campaña, total diario y % máximo de cambio automático),
- el piloto automático lo cubre (`policy.autopilot`) o el dueño aprobó esa acción puntual.
Si no, la acción queda **pedida** y devuelve `needs_approval` con el id.

**Nivel 3 — sólo el dueño:** primer gasto real de cada producto (`launch.first_live`), subir topes, activar un canal o cuenta, pasar a modo real, borrar/archivar, levantar la pausa general, ampliar la política. Precios y ofertas **no se cambian desde la Factory** (se cambian en el repo de cada producto).

## Modo de prueba

Por defecto la Factory está en `test`: toda escritura a Meta se simula (ids `dry_…`) y queda en `api_calls`. Las **lecturas** (verificar cuenta, traer métricas) sí van a Meta si hay token. Pausar una campaña real se hace de verdad aunque esté en modo de prueba. En tus informes, «simulado» y «publicado» nunca se confunden.

## Pausa general

`pause_all {reason}`: activa la pausa, cancela la cola y pausa en Meta todas las campañas que corren. Mientras está activa nada con efectos se ejecuta (salvo pausar). Levantarla es del dueño.

Usala sin pedir permiso si: el gasto se dispara, hay un anuncio con algo falso o que no debería estar, el tracking se rompe con campañas corriendo, o el usuario lo pide.

## Datos

- No se guardan datos personales de leads ni clientes (nombre, mail, teléfono). Los eventos traen tipo, monto, plan y atribución.
- Los contactos están en la base de cada producto; para responder una consulta, indicá dónde (`conv.lead_store` en `products_list`).
- Nunca pidas, muestres ni guardes tokens.
