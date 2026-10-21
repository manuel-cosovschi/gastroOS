/**
 * Meta Ads + orgánico + conversiones contra el servidor que imita la Graph API.
 * Prueba el código de punta a punta; NO reemplaza la validación con una cuenta
 * real (ver docs/INFORME-DE-PRUEBAS.md).
 */

import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { startMockGraph, type MockGraph } from './mock-graph.ts';

let mock: MockGraph;
const dir = join(tmpdir(), `smf-meta-${process.pid}`);
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let m: Record<string, any> = {};

before(async () => {
  mock = await startMockGraph();
  Object.assign(process.env, {
    META_GRAPH_URL: mock.url,
    META_ACCESS_TOKEN: 'token-de-prueba',
    META_AD_ACCOUNT_ID: '111',
    META_PAGE_ID: '555',
    META_IG_USER_ID: '17840000000',
    META_PIXEL_ID_GASTROOS: '999',
    META_CAPI_TOKEN_GASTROOS: 'capi-de-prueba',
    SUPABASE_URL: mock.url,
    SUPABASE_SERVICE_ROLE_KEY: 'srv',
    SMF_INGEST_SECRET: 'secreto-de-ingesta-de-prueba',
    SMF_OUT_DIR: dir,
  });
  m = {
    ...(await import('../src/db/index.ts')),
    ...(await import('../src/core/policy.ts')),
    ...(await import('../src/core/settings.ts')),
    ...(await import('../src/catalog/index.ts')),
    ...(await import('../src/creative/concepts.ts')),
    ...(await import('../src/meta/ads.ts')),
    ...(await import('../src/meta/insights.ts')),
    ...(await import('../src/meta/organic.ts')),
    ...(await import('../src/conversion/events.ts')),
  };
  await m.openTestDb();
  await m.syncCatalog();
});
after(async () => {
  await m.closeDb?.();
  await mock?.close();
});

/** Un creativo listo con un video chico de verdad (no se renderiza acá). */
async function creativoListo(): Promise<string> {
  const [c] = await m.generateConcepts('gastroos', { count: 1, templates: ['tour'] });
  const id = `crv_test${Math.random().toString(16).slice(2, 8)}`;
  const out = join(dir, id);
  mkdirSync(out, { recursive: true });
  execFileSync('ffmpeg', ['-v', 'error', '-y', '-f', 'lavfi', '-i', 'testsrc=size=1080x1920:rate=30:duration=3', '-f', 'lavfi', '-i', 'anullsrc=r=48000:cl=stereo', '-shortest', '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-c:a', 'aac', join(out, 'video.mp4')]);
  execFileSync('ffmpeg', ['-v', 'error', '-y', '-i', join(out, 'video.mp4'), '-frames:v', '1', join(out, 'poster.jpg')]);
  const d = await m.db();
  await d.query(`INSERT INTO smf.creatives (id, concept_id, product_id, format, width, height, duration_s, path, poster_path, status) VALUES ($1,$2,'gastroos','reels_9x16',1080,1920,3,$3,$4,'ready')`, [id, c.id, join(out, 'video.mp4'), join(out, 'poster.jpg')]);
  return id;
}

async function landingOk() {
  const d = await m.db();
  await d.query(`INSERT INTO smf.landing_checks (product_id, url, ok, pixel, checks) VALUES ('gastroos','https://gastroos.shop/conv',true,'present','[]')`);
}

test('preparar sin /conv verificada queda bloqueada', async () => {
  const cr = await creativoListo();
  const c = await m.prepareCampaign({ product: 'gastroos', creativeIds: [cr], dailyBudget: 5000, actor: 'agent' });
  assert.equal(c.status, 'blocked');
  assert.ok(c.blockers.some((b: string) => b.includes('/conv')));
});

test('modo de prueba: todo se simula y nada llega a Meta', async () => {
  await landingOk();
  const cr = await creativoListo();
  const c = await m.prepareCampaign({ product: 'gastroos', creativeIds: [cr], dailyBudget: 5000, actor: 'agent' });
  assert.equal(c.status, 'prepared', JSON.stringify(c.blockers));
  assert.equal(c.dry_run, true);
  assert.match(c.plan.ads[0].url, /v=\w+&utm_source=meta&utm_medium=paid_social&utm_campaign=gastroos-leads-/);
  const antes = mock.calls.length;
  const p = await m.pushCampaign(c.id, 'agent');
  assert.equal(p.status, 'in_meta_paused');
  assert.match(p.meta_campaign_id, /^dry_campaign_/);
  const l = await m.launchCampaign(c.id, 'agent');
  assert.equal(l.status, 'active');
  assert.equal(l.meta_status.simulated, true);
  assert.equal(mock.calls.length, antes, 'en modo de prueba no tiene que salir ninguna llamada');
  const d = await m.db();
  const [{ n }] = await d.query(`SELECT count(*)::int AS n FROM smf.api_calls WHERE dry_run = true`);
  assert.ok(n >= 7, `registró ${n} llamadas simuladas`);
});

test('verificación de cuenta: lectura contra la API', async () => {
  const r = await m.verifyAccount();
  assert.equal(r.ok, true, JSON.stringify(r.checks.filter((c: { ok: boolean }) => !c.ok)));
});

test('modo real: crea en pausa, verifica leyendo, lanza y confirma ACTIVE', async () => {
  await m.setMode('owner', 'live');
  await m.updatePolicy('owner', { channels: { meta_ads: true, instagram: true }, budget: { max_daily_total_ars: 20000, max_daily_per_campaign_ars: 10000 }, autopilot: { launch_approved_campaigns: true }, products_live: ['gastroos'] });
  const cr = await creativoListo();
  const c = await m.prepareCampaign({ product: 'gastroos', creativeIds: [cr], dailyBudget: 8000, actor: 'agent' });
  assert.equal(c.dry_run, false);
  const p = await m.pushCampaign(c.id, 'agent');
  assert.equal(p.status, 'in_meta_paused');
  assert.match(p.meta_campaign_id, /^\d+$/);
  const camp = mock.calls.find((x) => x.path === 'act_111/campaigns');
  assert.equal(camp?.body.status, 'PAUSED');
  assert.equal(camp?.body.objective, 'OUTCOME_LEADS');
  const adset = mock.calls.find((x) => x.path === 'act_111/adsets');
  assert.equal(adset?.body.daily_budget, '800000', 'presupuesto en centavos');
  assert.equal(JSON.parse(adset!.body.promoted_object).custom_event_type, 'LEAD');
  assert.equal(JSON.parse(adset!.body.targeting).targeting_automation.advantage_audience, 1);
  assert.ok(mock.calls.find((x) => x.path === 'act_111/advideos')?.multipart, 'el video sube como multipart');
  const creative = mock.calls.find((x) => x.path === 'act_111/adcreatives');
  const link = JSON.parse(creative!.body.object_story_spec).video_data.call_to_action.value.link;
  assert.match(link, /^https:\/\/gastroos\.shop\/conv\?v=/);
  assert.ok(p.meta_status.campaign, 'leyó la campaña de vuelta');

  const l = await m.launchCampaign(c.id, 'agent');
  assert.equal(l.status, 'active');
  const ads = await (await m.db()).query(`SELECT effective_status FROM smf.ads WHERE campaign_id = $1`, [c.id]);
  assert.equal(ads[0].effective_status, 'ACTIVE');
});

test('si Meta rechaza el anuncio, la campaña no figura activa y avisa', async () => {
  const cr = await creativoListo();
  const c = await m.prepareCampaign({ product: 'gastroos', creativeIds: [cr], dailyBudget: 2000, actor: 'agent' });
  await m.pushCampaign(c.id, 'agent');
  mock.adEffectiveStatus = 'DISAPPROVED';
  const l = await m.launchCampaign(c.id, 'agent');
  mock.adEffectiveStatus = 'ACTIVE';
  assert.notEqual(l.status, 'active');
  const [a] = await (await m.db()).query(`SELECT count(*)::int AS n FROM smf.alerts WHERE kind = 'campaign_rejected'`);
  assert.ok(a.n >= 1);
});

test('un lanzamiento que pasa el tope total se frena y pide autorización', async () => {
  const cr = await creativoListo();
  const c = await m.prepareCampaign({ product: 'gastroos', creativeIds: [cr], dailyBudget: 9000, actor: 'agent' });
  await m.pushCampaign(c.id, 'agent');
  // Ya hay 8.000 por día activos: con un tope total de 15.000, 9.000 más no entran.
  await m.updatePolicy('owner', { budget: { max_daily_total_ars: 15000 } });
  await assert.rejects(() => m.launchCampaign(c.id, 'agent'), (e: { code: string }) => e.code === 'needs_approval');
});

test('métricas: trae insights por anuncio y día', async () => {
  const r = await m.syncInsights({ days: 3 });
  assert.ok(r.rows >= 1);
  const [row] = await (await m.db()).query(`SELECT leads, spend::float8 AS spend, campaign_id FROM smf.metrics_daily WHERE campaign_id IS NOT NULL LIMIT 1`);
  assert.equal(row.leads, 6, 'no suma dos veces el mismo lead con dos nombres');
  assert.equal(row.spend, 9000.5);
});

test('eventos: firma, deduplicación, atribución y compra a CAPI', async () => {
  const d = await m.db();
  const [ad] = await d.query(`SELECT utm_content, campaign_id FROM smf.ads WHERE meta_ad_id IS NOT NULL LIMIT 1`);
  const cuerpo = JSON.stringify({ product: 'gastroos', type: 'purchase', event_id: 'gastroos:signup:test-1', value: 47000, plan: 'negocio', email: 'no@debe.guardarse', fbp: 'fb.1.1.1', attribution: { utm_source: 'meta', utm_campaign: 'x', utm_content: ad.utm_content } });
  const h = m.signBody(cuerpo, 'secreto-de-ingesta-de-prueba');
  const e = m.sanitize(m.verifySignature(cuerpo, { signature: h['x-smf-signature'], timestamp: h['x-smf-timestamp'] }));
  assert.equal((e as Record<string, unknown>).email, undefined);
  const r1 = await m.recordEvent(e, 'push');
  assert.equal(r1.stored, true);
  assert.equal(r1.campaign_id, ad.campaign_id);
  const r2 = await m.recordEvent(e, 'push');
  assert.equal(r2.duplicate, true);
  assert.ok(mock.calls.some((x) => x.path === '999/events'), 'la compra fue a la API de conversiones');
  assert.throws(() => m.verifySignature(cuerpo, { signature: 'sha256=00', timestamp: h['x-smf-timestamp'] }), /Firma/);
  const [al] = await d.query(`SELECT count(*)::int AS n FROM smf.alerts WHERE kind = 'purchase'`);
  assert.equal(al.n, 1);
});

test('orgánico: programa y publica un reel en Instagram', async () => {
  const cr = await creativoListo();
  const post = await m.schedulePost({ product: 'gastroos', creativeIds: [cr], channel: 'instagram', at: new Date(Date.now() - 1000).toISOString(), actor: 'owner' });
  assert.equal(post.kind, 'reel');
  const r = await m.publishDue('owner');
  assert.deepEqual(r.published, [post.id]);
  const p = await m.getPost(post.id);
  assert.match(p.permalink, /instagram\.com\/reel\//);
  assert.ok(mock.calls.some((x) => x.path === '17840000000/media' && x.body.media_type === 'REELS'));
});

test('el agente no publica orgánico sin piloto automático: queda pidiendo aprobación', async () => {
  const cr = await creativoListo();
  const post = await m.schedulePost({ product: 'gastroos', creativeIds: [cr], channel: 'instagram', at: new Date(Date.now() - 1000).toISOString(), actor: 'agent' });
  await m.publishDue('agent');
  assert.equal((await m.getPost(post.id)).status, 'needs_approval');
});

test('pausa general: pausa todo lo que corre, de verdad', async () => {
  const antes = mock.calls.filter((x) => x.body.status === 'PAUSED' && /^\d+$/.test(x.path)).length;
  await m.engageKillSwitch('agent', 'prueba de emergencia');
  const r = await m.pauseAll('agent', 'pausa general');
  assert.ok(r.paused.length >= 1);
  assert.equal(r.errors.length, 0);
  const despues = mock.calls.filter((x) => x.body.status === 'PAUSED' && /^\d+$/.test(x.path)).length;
  assert.ok(despues > antes);
  const cr = await creativoListo();
  await assert.rejects(() => m.prepareCampaign({ product: 'gastroos', creativeIds: [cr], dailyBudget: 1000, actor: 'agent' }).then((c: { id: string }) => m.pushCampaign(c.id, 'agent')));
});
