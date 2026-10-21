# Flujos de la Skill contra el servicio

Servicio: http://127.0.0.1:8899 · 2026-10-21T02:41:17.439Z

## «Analizá todos los productos de Sovare»

- `product_analyze` {"refresh":false} → HTTP 200
```json
[
 {
  "product": "alojaos",
  "failed_evidence": 0,
  "plans": [
   "Familiar 29000",
   "Complejo 45000",
   "Complejo grande 65000",
   "A medida 90000"
  ],
  "features": 6
 },
 {
  "product": "gastroos",
  "failed_evidence": 0,
  "plans": [
   "Taller 15000",
   "Negocio 32000",
   "Cocina grande 56000",
   "A medida 89000"
  ],
  "features": 10
 }
]
```
- `products_list` {} → HTTP 200
```json
[
 {
  "id": "alojaos",
  "marketable": true,
  "angles": [
   "base",
   "comision",
   "whatsapp"
  ],
  "landing": {
   "ok": true,
   "pixel": "missing",
   "checked_at": "2026-10-21T02:27:35.816Z"
  },
  "blockers": [
   "pixel",
   "capi",
   "graph-version"
  ]
 },
 {
  "id": "gastroos",
  "marketable": true,
  "angles": [
   "base",
   "stock",
   "costos",
   "pedidos"
  ],
  "landing": {
   "ok": true,
   "pixel": "missing",
   "checked_at": "2026-10-21T02:39:56.329Z"
  },
  "blockers": [
   "pixel",
   "capi",
   "purchase",
   "graph-version"
  ]
 }
]
```
- `products_discover` {} → HTTP 200
```json
{
 "products": [
  "alojaos",
  "gastroos"
 ],
 "unclassified": []
}
```

## «Creá una campaña para GastroOS»

- `landing_verify` {"product":"gastroos"} → HTTP 200
```json
[
 {
  "ok": true,
  "pixel": "missing"
 }
]
```
- `campaign_prepare` {"product":"gastroos","creatives":["crv_0e20a133cb32abfe","crv_f18660d878c16f9a"],"daily_budget":5000} → HTTP 200
```json
{
 "id": "cmp_d7813c3d8ae9e4b6",
 "status": "blocked",
 "blockers": [
  "no hay píxel configurado para gastroos (META_PIXEL_ID_GASTROOS): no se puede optimizar por consultas"
 ],
 "urls": [
  "https://gastroos.shop/conv?v=stock&utm_source=meta&utm_medium=paid_social&utm_campaign=gastroos-leads-2026-10-20&utm_content=stock-feed_4x5-416f5f",
  "https://gastroos.shop/conv?v=stock&utm_source=meta&utm_medium=paid_social&utm_campaign=gastroos-leads-2026-10-20&utm_content=stock-reels_9x16-13610d"
 ]
}
```
- `campaign_prepare` {"product":"gastroos","creatives":["crv_0e20a133cb32abfe","crv_f18660d878c16f9a"],"daily_budget":5000,"objective":"traffic"} → HTTP 200
```json
{
 "id": "cmp_f8ac3359e3ec19aa",
 "status": "prepared",
 "blockers": [],
 "notes": [
  "Objetivo tráfico: optimiza por clics, no por consultas. Útil sólo mientras no haya píxel."
 ]
}
```

## «Publicá las campañas aprobadas (en modo de prueba)»

- `campaign_push` {"campaign":"cmp_f8ac3359e3ec19aa"} → HTTP 200
```json
{
 "status": "in_meta_paused",
 "meta_campaign_id": "dry_campaign_5LEn6JPp",
 "dry_run": true
}
```
- `campaign_launch` {"campaign":"cmp_f8ac3359e3ec19aa"} → HTTP 200
```json
{
 "status": "active",
 "meta_status": {
  "note": "Simulada: no se publicó nada en Meta.",
  "simulated": true
 }
}
```

## «Generá cinco videos para AlojaOS (pedido de render)»

- `concepts_generate` {"product":"alojaos","count":5} → HTTP 200
```json
[
 {
  "id": "cpt_d29e35a9ac05367a",
  "angle": "comision",
  "headline": "Tus reservas, sin comisión por cada una",
  "template": "demo",
  "check": true
 },
 {
  "id": "cpt_6bd1071669118d01",
  "angle": "whatsapp",
  "headline": "Dejá de contestar «¿está libre?» todo el día",
  "template": "tour",
  "check": true
 },
 {
  "id": "cpt_7919ccc84e5c8237",
  "angle": "base",
  "headline": "Tu complejo se reserva mientras dormís.",
  "template": "demo",
  "check": true
 },
 {
  "id": "cpt_48d49e2c8cc2027b",
  "angle": "comision",
  "headline": "Tus reservas, sin comisión por cada una",
  "template": "tour",
  "check": true
 },
 {
  "id": "cpt_cc18b4d79d3b7cab",
  "angle": "whatsapp",
  "headline": "Dejá de contestar «¿está libre?» todo el día",
  "template": "kinetic",
  "check": true
 }
]
```

## «Copy propio con una cifra inventada»

- `concept_create_custom` {"product":"gastroos","angle":"base","hook":"Para pastelerías","headline":"Ahorrá 10 horas por semana","primary_text":"El mejor sistema: ahorrá 10 horas por semana. Miles de clientes ya lo usan.","cta":"Probá la demo"} → HTTP 200
```json
{
 "ok": false,
 "errors": [
  "no se puede: superlativo sin respaldo",
  "no se puede: prueba social no medida",
  "el número 10 no está en los hechos verificados de GastroOS"
 ],
 "warnings": []
}
```

## «Mostrame los anuncios que mejor convierten»

- `performance` {"days":7} → HTTP 200
```json
{
 "products": [
  {
   "p": "alojaos",
   "spend": 0,
   "leads": 0
  },
  {
   "p": "gastroos",
   "spend": 0,
   "leads": 0
  }
 ],
 "top": 0
}
```

## «Optimizá el presupuesto autorizado»

- `optimize_analyze` {} → HTTP 200
```json
[]
```

## «Mostrame las compras generadas por Meta Ads»

- `events_list` {"type":"purchase","days":30} → HTTP 200
```json
[]
```

## «Dame el reporte semanal»

- `report_weekly` {"days":7} → HTTP 200
```json
"# Reporte de marketing — últimos 7 días (al 2026-10-20)\n\nModo: **prueba (nada se publicó ni gastó)**\n\n| Producto | Gasto | Impr. | CTR | CPC | CPM | Consultas (Meta) | CPL | Consultas confirmadas | Calificadas | Compras | Ingresos | CAC | ROAS |\n|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|\n| AlojaOS | $0 | 0 | — | — | — | 0 | — | 0 | 0 | 0 | $0 | — | — |\n| GastroOS | $0 | 0 | — | — | — | 0 | — | 0 | 0 | 0 | $0 | — | — |\n\n- **AlojaOS**: 0 campaña(s) activa(s), 4 creativo(s) listos, 0 publicación(es) orgánica(s).\n- **GastroOS**: 1 campaña(s) activa(s), 4 creativo(s) listos, 0 publicación(es) orgánica(s).\n\n## Anuncios con menor costo por consulta\n"
```

## «Prepará las campañas de todos los productos / Ejecutá el marketing de Sovare»

- `marketing_run` {"launch":false} → HTTP 200
```json
{
 "job": "job_65a7d29867937cc5",
 "note": "Consultar el avance con job_status. Todo lo que gaste o publique pasa por la política."
}
```

## «Pasar a modo real desde el agente (tiene que quedar pedido)»

- `mode_set` {"mode":"live"} → HTTP 403
```json
{
 "ok": false,
 "error": "Requiere autorización explícita del dueño (nivel 3). Se pidió la autorización apr_d95671ce491ab082: le llega al dueño por sus canales de aviso.",
 "code": "needs_approval",
 "details": {
  "approvalId": "apr_d95671ce491ab082",
  "tier": 3
 }
}
```

## «Pausá todas las campañas»

- `pause_all` {"reason":"prueba de los flujos de la Skill"} → HTTP 200
```json
{
 "paused": [
  "cmp_f8ac3359e3ec19aa"
 ],
 "errors": [],
 "kill_switch": true
}
```
- `approvals_list` {"status":"pending"} → HTTP 200
```json
[
 {
  "action": "mode.set_live",
  "summary": "Pasar la Factory a modo real: las llamadas a Meta dejan de simularse."
 }
]
```

## Con la pausa general activa

- `campaign_prepare` → HTTP 200 (prepared)
- `campaign_push` → HTTP 403
```json
{
 "ok": false,
 "error": "Pausa general activa: prueba de los flujos de la Skill. Sólo se permiten acciones que frenan.",
 "code": "denied",
 "details": {}
}
```
