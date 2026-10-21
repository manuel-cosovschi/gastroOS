# Meta Ads

Graph/Marketing API **v26.0** (configurable con `META_API_VERSION`).

## Estructura que crea la Factory

- **Campaña**: objetivo `OUTCOME_LEADS` (consultas) o `OUTCOME_TRAFFIC` (sólo si no hay píxel y se elige a propósito), `special_ad_categories: []`, presupuesto en el conjunto (`is_adset_budget_sharing_enabled: false`).
- **Conjunto**: presupuesto diario en ARS (Meta lo recibe en centavos), `OFFSITE_CONVERSIONS` con `promoted_object { pixel_id, custom_event_type: LEAD }`, segmentación por defecto Argentina 25-65 con Advantage+ audiencia explícito.
- **Anuncios**: uno por creativo. Video subido a la cuenta, miniatura = póster, texto = concepto, CTA del producto, link a `/conv?v=<ángulo>&utm_source=meta&utm_medium=paid_social&utm_campaign=<producto>-<objetivo>-<fecha>&utm_content=<anuncio>`. Las «mejoras automáticas» de Meta que reescriben texto o video quedan desactivadas.

Todo nace **en pausa** y se verifica leyéndolo de vuelta.

## Ciclo

`campaign_prepare` (local, con bloqueos) → `campaign_push` (Meta, en pausa) → `campaign_launch` (política) → `campaign_refresh` / tarea horaria.

Estados de una campaña en la Factory:

| Estado | Significa |
|---|---|
| `blocked` | El borrador tiene bloqueos (píxel, /conv, creativos). Se arregla y se prepara de nuevo |
| `prepared` | Borrador listo |
| `in_meta_paused` | Creada en Meta y en pausa (o simulada en modo de prueba) |
| `pending_review` | Activada; Meta todavía no la aprobó |
| `active` | **Meta confirmó** `effective_status: ACTIVE` |
| `rejected` | Meta rechazó los anuncios (llega una alerta con el motivo) |
| `paused` | Pausada |

## Bloqueos típicos y qué hacer

| Bloqueo | Solución (de quién) |
|---|---|
| «no hay píxel configurado para X» | Cargar `META_PIXEL_ID_X` en la Factory (dueño) |
| «/conv no carga el píxel» | Cargar `NEXT_PUBLIC_META_PIXEL_ID` en el despliegue del producto (dueño) |
| «sin verificación de las últimas 24 h» | `landing_verify` (vos) |
| `needs_approval` al lanzar | Esperar la decisión del dueño |
| «el canal meta_ads no está activado» | Pedirlo (`approval_request` `channel.activate`, scope `{channel: "meta_ads"}`) |

## Límites y revisión

- La Factory respeta los límites de uso de la API (lee los encabezados y espera) y reintenta los errores transitorios.
- La revisión de anuncios la hace Meta. No hay forma de «acelerarla» ni de evitarla: no lo intentes.
- Políticas de Meta: nada de afirmar atributos personales del que mira, nada de antes/después engañoso, nada de promesas de resultados. El validador de copy ya frena lo obvio.
