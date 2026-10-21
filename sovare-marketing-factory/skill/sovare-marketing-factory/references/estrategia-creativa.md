# Estrategia creativa

## De qué está hecho un concepto

ángulo verificado (titular + bajada + variante `?v=`) + 2-3 claims verificados + precio de entrada (opcional, con fecha) + CTA + plantilla visual.

`concepts_generate` recorre la grilla para que los conceptos se diferencien de verdad: primero un concepto por ángulo, después cambia de plantilla, de claims y de CTA. Pedí más ángulos antes que más variantes del mismo.

## Plantillas

| Plantilla | Abre con | Cuerpo | Ideal para |
|---|---|---|---|
| `demo` | Gancho (público + titular) | La **grabación real** del producto usándose, acelerada hasta 2,6× para que entre el recorrido | Reels/Stories: «mirá cómo se carga un pedido» |
| `tour` | Gancho | Dos **capturas reales** con zoom/scroll y un claim encima | Feed: mostrar el panel |
| `kinetic` | El titular palabra por palabra | Capturas | Variante para refrescar un ángulo fatigado |

Todas cierran con: claims con tilde → precio (si va) → logo, CTA y la dirección (`gastroos.shop/conv`).

## Formatos

| Formato | Medidas | Ubicaciones |
|---|---|---|
| `reels_9x16` | 1080×1920 | Reels y Stories de IG/FB (zona segura: 250 px arriba, 400 abajo) |
| `feed_4x5` | 1080×1350 | Feed de IG/FB |
| `square_1x1` | 1080×1080 | Feed, Marketplace |
| `landscape_16x9` | 1920×1080 | In-stream y feed de Facebook |

Para una campaña: 9:16 + 4:5 de cada concepto. Videos de 15 s (10 a 30).

**Requisito del dueño, todavía no implementado** (`docs/REQUISITOS-VIDEO.md` del servicio): Remotion, música y efectos, voz en off rioplatense natural, subtítulos sincronizados con la voz, y hooks de verdad en el primer segundo. Los videos actuales son mudos y con el titular como gancho: no los presentes como la versión final. Si te piden videos antes de que esté listo, decilo.

## Validación

Cada video se mide con ffprobe (H.264, yuv420p, medidas exactas, 30 fps, duración, AAC, peso) y se revisa que ningún cuadro esté vacío. Un creativo `invalid` no se puede subir. Si ves `failed`, `creatives_list` trae el error.

## Copy propio

Si el usuario quiere otro texto: `concept_create_custom`. Reglas del validador:
- Todo número tiene que estar en los hechos verificados (planes, claims, ángulos).
- Bullets = claims verificados (por id o texto exacto).
- Prohibido: «garantizado», «el mejor», «#1», «100%», «miles de clientes», estrellas, citas atribuidas, atributos personales del lector.
- Titular ideal ≤ 40 caracteres (Meta corta).

## Editar un video

Cada creativo deja `project.json` (textos, recursos, línea de tiempo). Se edita y se vuelve a renderizar con `npm run smf -- rerender <ruta>` en el servicio. Desde Cowork: pedí un concepto nuevo en vez de editar a mano.
