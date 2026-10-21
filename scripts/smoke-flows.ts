/**
 * Recorre los flujos de la Skill contra un servicio corriendo, por la API (el
 * mismo camino que `scripts/smf.mjs`), y escribe la transcripción.
 *
 *   SMF_URL=http://127.0.0.1:8787 SMF_TOKEN=… npx tsx scripts/smoke-flows.ts out/flujos.md
 */

import { writeFileSync } from 'node:fs';

const base = (process.env.SMF_URL ?? '').replace(/\/$/, '');
const tok = process.env.SMF_TOKEN ?? '';
const out = process.argv[2] ?? 'flujos.md';

async function op(name: string, input: unknown = {}): Promise<{ ok: boolean; status: number; body: any }> { // eslint-disable-line @typescript-eslint/no-explicit-any
  const r = await fetch(`${base}/api/ops/${name}`, { method: 'POST', headers: { Authorization: `Bearer ${tok}`, 'Content-Type': 'application/json' }, body: JSON.stringify(input) });
  return { ok: r.ok, status: r.status, body: await r.json() };
}

const lines: string[] = ['# Flujos de la Skill contra el servicio', '', `Servicio: ${base} · ${new Date().toISOString()}`, ''];
const resumen = (x: unknown, max = 1600) => {
  const s = JSON.stringify(x, null, 1);
  return s.length > max ? `${s.slice(0, max)}\n…` : s;
};
async function flujo(titulo: string, pasos: [string, unknown, ((b: any) => unknown)?][]) { // eslint-disable-line @typescript-eslint/no-explicit-any
  lines.push(`## «${titulo}»`, '');
  for (const [name, input, pick] of pasos) {
    const r = await op(name, input);
    const body = r.ok ? r.body.result : r.body;
    lines.push(`- \`${name}\` ${JSON.stringify(input)} → HTTP ${r.status}`, '```json', resumen(pick && r.ok ? pick(body) : body), '```');
  }
  lines.push('');
}

await flujo('Analizá todos los productos de Sovare', [
  ['product_analyze', { refresh: false }, (b) => b.map((x: any) => ({ product: x.product, failed_evidence: x.failed_evidence.length, plans: x.plans.map((p: any) => `${p.name} ${p.monthly}`), features: x.features }))], // eslint-disable-line @typescript-eslint/no-explicit-any
  ['products_list', {}, (b) => b.map((x: any) => ({ id: x.id, marketable: x.marketable, angles: x.angles, landing: x.landing, blockers: x.blockers.map((y: any) => y.id) }))], // eslint-disable-line @typescript-eslint/no-explicit-any
  ['products_discover', {}, (b) => ({ products: b.products, unclassified: b.unclassified.map((u: any) => u.repo) })], // eslint-disable-line @typescript-eslint/no-explicit-any
]);
const concepts = (await op('concepts_list', { product: 'gastroos' })).body.result as { id: string }[];
const creatives = ((await op('creatives_list', { product: 'gastroos', status: 'ready' })).body.result as { id: string }[]).map((c) => c.id);
await flujo('Creá una campaña para GastroOS', [
  ['landing_verify', { product: 'gastroos' }, (b) => b.map((x: any) => ({ ok: x.ok, pixel: x.pixel }))], // eslint-disable-line @typescript-eslint/no-explicit-any
  ['campaign_prepare', { product: 'gastroos', creatives: creatives.slice(0, 2), daily_budget: 5000 }, (b) => ({ id: b.id, status: b.status, blockers: b.blockers, urls: b.plan.ads.map((a: any) => a.url) })], // eslint-disable-line @typescript-eslint/no-explicit-any
  ['campaign_prepare', { product: 'gastroos', creatives: creatives.slice(0, 2), daily_budget: 5000, objective: 'traffic' }, (b) => ({ id: b.id, status: b.status, blockers: b.blockers, notes: b.plan.notes })],
]);
const camps = (await op('campaigns_list', { product: 'gastroos', status: 'prepared' })).body.result as { id: string }[];
if (camps[0]) {
  await flujo('Publicá las campañas aprobadas (en modo de prueba)', [
    ['campaign_push', { campaign: camps[0].id }, (b) => ({ status: b.status, meta_campaign_id: b.meta_campaign_id, dry_run: b.dry_run })],
    ['campaign_launch', { campaign: camps[0].id }, (b) => ({ status: b.status, meta_status: b.meta_status })],
  ]);
}
await flujo('Generá cinco videos para AlojaOS (pedido de render)', [
  ['concepts_generate', { product: 'alojaos', count: 5 }, (b) => b.map((c: any) => ({ id: c.id, angle: c.angle, headline: c.headline, template: c.meta?.template, check: c.meta?.check?.ok }))], // eslint-disable-line @typescript-eslint/no-explicit-any
]);
await flujo('Copy propio con una cifra inventada', [
  ['concept_create_custom', { product: 'gastroos', angle: 'base', hook: 'Para pastelerías', headline: 'Ahorrá 10 horas por semana', primary_text: 'El mejor sistema: ahorrá 10 horas por semana. Miles de clientes ya lo usan.', cta: 'Probá la demo' }, (b) => b.check],
]);
await flujo('Mostrame los anuncios que mejor convierten', [['performance', { days: 7 }, (b) => ({ products: b.products.map((p: any) => ({ p: p.product, spend: p.spend, leads: p.meta_leads })), top: b.topAds.length })]]); // eslint-disable-line @typescript-eslint/no-explicit-any
await flujo('Optimizá el presupuesto autorizado', [['optimize_analyze', {}, (b) => b.findings.slice(0, 5)]]);
await flujo('Mostrame las compras generadas por Meta Ads', [['events_list', { type: 'purchase', days: 30 }]]);
await flujo('Dame el reporte semanal', [['report_weekly', { days: 7 }, (b) => b.markdown.split('\n').slice(0, 14).join('\n')]]);
await flujo('Prepará las campañas de todos los productos / Ejecutá el marketing de Sovare', [['marketing_run', { launch: false }]]);
await flujo('Pasar a modo real desde el agente (tiene que quedar pedido)', [['mode_set', { mode: 'live' }]]);
await flujo('Pausá todas las campañas', [
  ['pause_all', { reason: 'prueba de los flujos de la Skill' }, (b) => ({ paused: b.paused, errors: b.errors, kill_switch: b.kill_switch.paused })],
  ['approvals_list', { status: 'pending' }, (b) => b.map((a: any) => ({ action: a.action, summary: a.summary }))], // eslint-disable-line @typescript-eslint/no-explicit-any
]);
// Con la pausa activa: preparar (nivel 1) se puede; crear en Meta, no.
const nueva = await op('campaign_prepare', { product: 'gastroos', creatives: creatives.slice(0, 1), daily_budget: 1000, objective: 'traffic' });
const push = await op('campaign_push', { campaign: nueva.body.result?.id });
lines.push('## Con la pausa general activa', '', `- \`campaign_prepare\` → HTTP ${nueva.status} (${nueva.body.result?.status})`, `- \`campaign_push\` → HTTP ${push.status}`, '```json', resumen(push.body), '```', '');
void concepts;
writeFileSync(out, lines.join('\n'));
console.log(`✓ ${out}`);
