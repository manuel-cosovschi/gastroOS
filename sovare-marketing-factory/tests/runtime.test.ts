import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { closeDb, openTestDb, db } from '../src/db/index.ts';
import { matches, parseCron, slotsBetween } from '../src/runtime/cron.ts';
import { claim, enqueue, getJob } from '../src/runtime/jobs.ts';
import { enqueueDue, ensureSchedules, health, HANDLERS, runJob, tick } from '../src/runtime/worker.ts';
import { wilson, analyze } from '../src/optimize/index.ts';
import { engageKillSwitch, releaseKillSwitch } from '../src/core/policy.ts';

before(async () => {
  await openTestDb();
});
after(closeDb);

test('cron en hora argentina', () => {
  // 12:00 UTC = 09:00 en Argentina.
  assert.equal(matches(parseCron('0 9 * * *'), new Date('2026-10-21T12:00:00Z')), true);
  assert.equal(matches(parseCron('0 9 * * *'), new Date('2026-10-21T09:00:00Z')), false);
  assert.equal(matches(parseCron('*/15 * * * *'), new Date('2026-10-21T12:45:00Z')), true);
  assert.equal(matches(parseCron('0 8 * * 1'), new Date('2026-10-26T11:00:00Z')), true, 'lunes 26/10 a las 8');
  assert.equal(slotsBetween('*/10 * * * *', new Date('2026-10-21T12:00:00Z'), new Date('2026-10-21T12:35:00Z')).length, 3);
  assert.throws(() => parseCron('61 * * * *'));
});

test('cola: idempotencia por clave', async () => {
  const a = await enqueue('report.weekly', {}, { key: 'x:1' });
  const b = await enqueue('report.weekly', {}, { key: 'x:1' });
  assert.equal(a.created, true);
  assert.equal(b.created, false);
  assert.equal(a.id, b.id);
});

test('cola: un ejecutor sin render no toma trabajos de render', async () => {
  await enqueue('creative.render', { concept: 'nada', format: 'reels_9x16' }, { needs: 'render', key: 'r:1' });
  const j = await claim('w-light', ['light']);
  assert.ok(!j || j.type !== 'creative.render');
});

test('reintentos con espera y trabajo muerto con aviso', async () => {
  HANDLERS['test.falla'] = { needs: 'light', description: 'prueba que falla', run: async () => { throw new Error('se rompió a propósito'); } };
  const { id } = await enqueue('test.falla', {}, { maxAttempts: 2, needs: 'light', key: 'falla:1' });
  let job = await claim('w', ['light']);
  while (job && job.id !== id) job = await claim('w', ['light']);
  assert.ok(job);
  await runJob(job!);
  let j = await getJob(id);
  assert.equal(j?.status, 'queued');
  assert.ok(new Date(j!.run_at) > new Date(), 'reprogramado a futuro');
  const d = await db();
  await d.query(`UPDATE smf.jobs SET run_at = now() WHERE id = $1`, [id]);
  const again = await claim('w', ['light']);
  await runJob(again!);
  j = await getJob(id);
  assert.equal(j?.status, 'dead');
  const [{ n }] = await d.query<{ n: number }>(`SELECT COUNT(*)::int n FROM smf.alerts WHERE kind = 'runtime_failure'`);
  assert.ok(n >= 1);
});

test('scheduler encola cada cron vencido una sola vez', async () => {
  await ensureSchedules();
  const now = new Date('2026-10-21T12:30:30Z');
  const r1 = await enqueueDue(now);
  assert.ok(r1.some((x) => x.startsWith('events.pull@')), r1.join(','));
  const r2 = await enqueueDue(now);
  assert.equal(r2.length, 0);
});

test('tick corre trabajos livianos, deja latido y health responde', async () => {
  const d = await db();
  await d.query(`UPDATE smf.jobs SET status = 'cancelled' WHERE status = 'queued'`);
  await enqueue('report.weekly', {}, { key: 'rep:tick', needs: 'light' });
  const r = await tick({ caps: ['light', 'any'], maxJobs: 5, budgetMs: 60_000 });
  assert.ok(r.ran.some((x) => x.type === 'report.weekly' && x.ok), JSON.stringify(r.ran));
  const h = await health();
  assert.equal(h.checks.find((c) => c.name === 'ejecutor programado')?.ok, true);
});

test('pausa general: el tick sigue corriendo lecturas', async () => {
  await engageKillSwitch('system', 'prueba');
  await enqueue('report.weekly', {}, { key: 'rep:ks', needs: 'light' });
  const r = await tick({ caps: ['light', 'any'], maxJobs: 3 });
  assert.ok(r.ran.some((x) => x.type === 'report.weekly' && x.ok));
  await releaseKillSwitch('owner');
});

test('Wilson: un CTR con poca muestra no se declara peor', () => {
  const [, alto] = wilson(1, 200);
  const [bajo] = wilson(300, 20000);
  assert.ok(alto > bajo, 'con 200 impresiones no hay evidencia');
  const [, alto2] = wilson(20, 20000);
  assert.ok(alto2 < bajo, 'con 20.000 impresiones sí');
});

test('optimizador: sin muestra suficiente no propone nada', async () => {
  const d = await db();
  await d.query(`INSERT INTO smf.concepts (id, product_id, angle, hook, headline, primary_text, cta) VALUES ('cpt_o','gastroos','base','h','t','p','c')`);
  await d.query(`INSERT INTO smf.creatives (id, concept_id, product_id, format, status) VALUES ('crv_o','cpt_o','gastroos','reels_9x16','ready')`);
  await d.query(`INSERT INTO smf.campaigns (id, product_id, name, objective, status, destination_url) VALUES ('cmp_o','gastroos','x','OUTCOME_LEADS','active','https://gastroos.shop/conv')`);
  for (const [id, imp, clk] of [['ad_a', 500, 2], ['ad_b', 40000, 600], ['ad_c', 30000, 60]] as const) {
    await d.query(`INSERT INTO smf.ads (id, campaign_id, creative_id, concept_id, utm_content, url, meta_ad_id) VALUES ($1,'cmp_o','crv_o','cpt_o',$1,'u',$2)`, [id, `m_${id}`]);
    await d.query(`INSERT INTO smf.metrics_daily (day, meta_ad_id, ad_id, campaign_id, product_id, impressions, link_clicks, spend) VALUES (CURRENT_DATE - 1, $1, $2, 'cmp_o', 'gastroos', $3, $4, 9000)`, [`m_${id}`, id, imp, clk]);
  }
  const { findings } = await analyze();
  assert.equal(findings.find((f) => f.target === 'ad_a')?.rule, 'insufficient_sample');
  assert.equal(findings.find((f) => f.target === 'ad_c')?.rule, 'low_ctr');
  assert.equal(findings.find((f) => f.target === 'ad_b'), undefined);
});
