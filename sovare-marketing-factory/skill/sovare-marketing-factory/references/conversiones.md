# Conversiones y atribución

## /conv

Cada producto tiene su página de conversión, a la que mandan todos los anuncios:

- `?v=<variante>` elige el titular (el anuncio de cada ángulo usa su variante).
- La página guarda la campaña de la primera visita (`utm_*`, `fbclid`, `v`) en la cookie `conv_atrib` y la anota en cada consulta.
- Eventos con los nombres de Meta: `PageView`, `ViewContent`, `Contact`, `Demo`, `InitiateCheckout`, `Lead` (el `Lead` sale también por la API de conversiones del producto, con el mismo `event_id`; Meta deduplica).

`landing_verify` comprueba todo eso, en un navegador real, **bloqueando** los envíos al píxel para no ensuciar los datos. Ninguna campaña sale a una /conv sin verificación correcta de las últimas 24 h.

## Qué registra la Factory

| Tipo | Qué es | De dónde |
|---|---|---|
| `lead` | Consulta guardada | Base del producto (lectura) o evento firmado |
| `qualified_lead` | Consulta calificada | Evento firmado del producto |
| `purchase` | Pago aprobado (con monto y plan) | GastroOS: `sovare.signups` aprobado |
| `customer` | Venta asistida cerrada | AlojaOS: consulta en estado `cliente` |
| `disqualified` | Consulta descartada | AlojaOS: estado `descartada` |

Deduplicación por `event_id`. Atribución: `utm_content` → anuncio, `utm_campaign` → campaña. Sin datos personales.

## Compras → Meta

La Factory manda `Purchase` por la API de conversiones cuando registra una compra **que trae `fbp`/`fbc`** (las cookies del píxel). Sin eso Meta no puede atribuirla y descarta el evento, así que no se manda y queda anotado el porqué.

## Brechas conocidas (no las tapes en los informes)

- Píxel y CAPI no están configurados en producción en ninguno de los dos productos: Meta no ve las consultas todavía.
- GastroOS no guarda la campaña ni `fbp`/`fbc` en `sovare.signups`: sus compras entran **sin atribución**. Está propuesto el cambio en `docs/PENDIENTES.md`.
- AlojaOS no vende online: el «cliente» se registra cuando alguien cambia el estado de la consulta.
