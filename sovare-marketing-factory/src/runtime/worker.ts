/**
 * Scheduler & Autonomous Runtime.
 *
 * Dos formas de correr, con la misma cola:
 *
 *   `smf serve` — servicio persistente (Docker, VPS, Railway, Fly…): la API, el
 *                 MCP para Cowork, el panel y un `tick` cada 30 s.
 *   `smf tick`  — una pasada y termina. Para cron externo: GitHub Actions
 *                 (.github/workflows/scheduler.yml), Vercel Cron, n8n.
 *
 * Un tick: deja un latido, encola los crons que vencieron (sólo el último
 * turno perdido de cada uno, para no acumular), y toma trabajos hasta agotar
 * el tiempo. Ningún trabajo con efectos corre si la pausa general está activa
 * (lo frena `guard()` adentro de cada acción); los de sólo lectura sí.
 */

import { config } from '../config.ts';
import { db, j } from '../db/index.ts';
import { audit } from '../core/audit.ts';
import { getKillSwitch, getMode } from '../core/settings.ts';
import { notify } from '../notify/index.ts';
import { slotsBetween } from './cron.ts';
import { claim, complete, enqueue, fail, type Job, type Needs } from './jobs.ts';

type Handler = (payload: Record<string, unknown>, job: Job) => Promise<unknown>;

interface JobDef {
  needs: Needs;
  run: Handler;
  description: string;
}

export const HANDLERS: Record<string, JobDef> = {
  'catalog.sync': { needs: 'light', description: 'Sincroniza el catálogo y detecta cambios en los productos', run: async () => (await import('../catalog/index.ts')).syncCatalog({ refresh: true }).then((r) => r.map((x) => ({ product: x.product, changed: x.changed, changes: x.changes }))) },
  'catalog.discover': { needs: 'light', description: 'Busca repositorios nuevos sin clasificar', run: async () => (await import('../catalog/discover.ts')).discover().then((r) => ({ unclassified: r.unclassified.map((u) => u.repo) })) },
  'conv.verify': { needs: 'render', description: 'Verifica las páginas /conv y el píxel', run: async (p) => {
    const { verifyLanding } = await import('../conversion/landing.ts');
    const { loadCatalog } = await import('../catalog/index.ts');
    const ids = p.product ? [String(p.product)] : loadCatalog().filter((x) => x.marketable).map((x) => x.id);
    const out = [];
    for (const id of ids) out.push(await verifyLanding(id).then((r) => ({ product: id, ok: r.ok, pixel: r.pixel })));
    return out;
  } },
  'metrics.sync': { needs: 'light', description: 'Trae métricas de Meta', run: async (p) => (await import('../meta/insights.ts')).syncInsights({ days: Number(p.days ?? 7) }) },
  'events.pull': { needs: 'light', description: 'Lee leads y ventas de las bases de los productos', run: async (p) => (await import('../conversion/sources.ts')).pullAll(Number(p.days ?? 30)) },
  'campaigns.refresh': { needs: 'light', description: 'Lee el estado real de las campañas en Meta', run: async () => {
    const { listCampaigns, refreshCampaign } = await import('../meta/ads.ts');
    const out = [];
    for (const c of await listCampaigns()) if (['active', 'pending_review', 'in_meta_paused', 'paused'].includes(c.status) && !c.dry_run) out.push((await refreshCampaign(c.id)).status);
    return { refreshed: out.length };
  } },
  'optimize.run': { needs: 'light', description: 'Analiza rendimiento y aplica las reglas autorizadas', run: async () => (await import('../optimize/index.ts')).runOptimizer('system').then((r) => r.findings.map((f) => ({ rule: f.rule, target: f.target, outcome: f.outcome }))) },
  'organic.publish_due': { needs: 'light', description: 'Publica el contenido orgánico programado que venció', run: async () => (await import('../meta/organic.ts')).publishDue('system') },
  'report.weekly': { needs: 'light', description: 'Genera el reporte semanal', run: async () => (await import('../report/index.ts')).weeklyReport(7).then((r) => ({ path: r.path })) },
  'creative.render': { needs: 'render', description: 'Renderiza y valida un creativo', run: async (p) => (await import('../creative/index.ts')).renderCreative(String(p.concept), p.format as never, { duration: Number(p.duration ?? 15) }).then((c) => ({ id: c.id, status: c.status })) },
  'creative.replenish': { needs: 'render', description: 'Genera y renderiza variantes nuevas cuando un creativo se agota', run: async (p) => {
    const { generateConcepts } = await import('../creative/concepts.ts');
    const { renderCreative } = await import('../creative/index.ts');
    const { campaignDefaults } = await import('./pipeline.ts');
    const def = await campaignDefaults();
    const nuevos = await generateConcepts(String(p.product), { count: 2, createdBy: 'system' });
    const out = [];
    for (const c of nuevos) for (const f of def.formats) out.push(await renderCreative(c.id, f, { duration: def.duration_s }).then((x) => `${x.id}:${x.status}`));
    return { concepts: nuevos.map((c) => c.id), creatives: out };
  } },
  'marketing.run': { needs: 'render', description: 'Ejecuta el marketing completo de los productos', run: async (p) => (await import('./pipeline.ts')).runMarketing({ products: p.products as string[] | undefined, actor: (p.actor as 'agent') ?? 'system', renderInline: true, launch: p.launch !== false }) },
  'health.check': { needs: 'light', description: 'Revisa latidos, trabajos muertos e integraciones', run: async () => health({ alert: true }) },
  'kill_switch.enforce': { needs: 'light', description: 'Pausa en Meta todo lo que siga activo', run: async (p) => (await import('../meta/ads.ts')).pauseAll('system', String(p.reason ?? 'pausa general')) },
};

/** Los crons por defecto. Se pueden editar en smf.schedules (o con `smf schedule`). */
export const DEFAULT_SCHEDULES: { id: string; cron: string; job_type: string; description: string; payload?: Record<string, unknown> }[] = [
  { id: 'catalog-sync', cron: '10 6 * * *', job_type: 'catalog.sync', description: 'Todos los días 6:10: catálogo y cambios de producto' },
  { id: 'discover', cron: '20 6 * * 1', job_type: 'catalog.discover', description: 'Lunes 6:20: repositorios nuevos' },
  { id: 'conv-verify', cron: '30 6,14 * * *', job_type: 'conv.verify', description: '6:30 y 14:30: páginas /conv y píxel' },
  { id: 'events-pull', cron: '*/15 * * * *', job_type: 'events.pull', description: 'Cada 15 min: leads y ventas de los productos' },
  { id: 'metrics-sync', cron: '5 */2 * * *', job_type: 'metrics.sync', description: 'Cada 2 h: métricas de Meta' },
  { id: 'campaigns-refresh', cron: '15 * * * *', job_type: 'campaigns.refresh', description: 'Cada hora: estado y revisión de anuncios' },
  { id: 'optimize', cron: '0 9,18 * * *', job_type: 'optimize.run', description: '9:00 y 18:00: optimización' },
  { id: 'organic-publish', cron: '*/10 * * * *', job_type: 'organic.publish_due', description: 'Cada 10 min: publicaciones vencidas' },
  { id: 'weekly-report', cron: '0 8 * * 1', job_type: 'report.weekly', description: 'Lunes 8:00: reporte semanal' },
  { id: 'health', cron: '*/30 * * * *', job_type: 'health.check', description: 'Cada 30 min: salud del sistema' },
];

export async function ensureSchedules(): Promise<void> {
  const d = await db();
  for (const s of DEFAULT_SCHEDULES) {
    await d.query(`INSERT INTO smf.schedules (id, cron, job_type, payload, description) VALUES ($1,$2,$3,$4::jsonb,$5) ON CONFLICT (id) DO NOTHING`, [s.id, s.cron, s.job_type, j(s.payload ?? {}), s.description]);
  }
}

/** Encola el último turno vencido de cada cron. */
export async function enqueueDue(now = new Date()): Promise<string[]> {
  const d = await db();
  const rows = await d.query<{ id: string; cron: string; job_type: string; payload: Record<string, unknown>; last_slot: string | null }>(`SELECT * FROM smf.schedules WHERE enabled`);
  const out: string[] = [];
  for (const s of rows) {
    const desde = s.last_slot ? new Date(s.last_slot) : new Date(now.getTime() - 15 * 60_000);
    let slots: Date[];
    try {
      slots = slotsBetween(s.cron, desde, now);
    } catch (e) {
      await notify({ kind: 'runtime_failure', severity: 'warning', title: `Cron inválido en ${s.id}`, body: String(e), dedupKey: `cron:${s.id}:${s.cron}` });
      continue;
    }
    if (!slots.length) continue;
    const slot = slots[slots.length - 1];
    const def = HANDLERS[s.job_type];
    const r = await enqueue(s.job_type, s.payload ?? {}, { key: `${s.id}:${slot.toISOString()}`, runAt: slot, needs: def?.needs ?? 'any' });
    await d.query('UPDATE smf.schedules SET last_slot = $2 WHERE id = $1', [s.id, slot.toISOString()]);
    if (r.created) out.push(`${s.job_type}@${slot.toISOString()}`);
  }
  return out;
}

export async function heartbeat(kind: string, info: Record<string, unknown> = {}): Promise<void> {
  const d = await db();
  await d.query(
    `INSERT INTO smf.heartbeats (worker, kind, at, info) VALUES ($1,$2,now(),$3::jsonb) ON CONFLICT (worker) DO UPDATE SET kind = EXCLUDED.kind, at = now(), info = EXCLUDED.info`,
    [config.workerId, kind, j(info)]
  );
}

export async function runJob(job: Job): Promise<{ ok: boolean; result?: unknown; error?: string }> {
  const def = HANDLERS[job.type];
  if (!def) {
    await fail(job, `tipo de trabajo desconocido: ${job.type}`, { retryable: false });
    return { ok: false, error: 'tipo desconocido' };
  }
  try {
    const result = await def.run(job.payload ?? {}, job);
    await complete(job.id, result);
    return { ok: true, result };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    const code = (e as { code?: string }).code;
    // Lo que la política frenó no se reintenta: reintentar no lo autoriza.
    const retryable = !['denied', 'needs_approval', 'not_marketable', 'bad_format', 'stale', 'blocked'].includes(code ?? '');
    const muerto = await fail(job, msg, { retryable });
    if (muerto && retryable) await notify({ kind: 'runtime_failure', severity: 'critical', title: `Falló «${def.description}» ${job.attempts} veces`, body: `${job.type} (${job.id})\n${msg}`, dedupKey: `jobdead:${job.id}` });
    return { ok: false, error: msg };
  }
}

export async function tick(opts: { maxJobs?: number; budgetMs?: number; caps?: string[] } = {}): Promise<{ enqueued: string[]; ran: { id: string; type: string; ok: boolean; error?: string }[] }> {
  const t0 = Date.now();
  const caps = opts.caps ?? config.workerCaps;
  await ensureSchedules();
  await heartbeat('tick', { caps, mode: await getMode() });
  const enqueued = await enqueueDue();
  const ran: { id: string; type: string; ok: boolean; error?: string }[] = [];
  const max = opts.maxJobs ?? 20;
  const budget = opts.budgetMs ?? 240_000;
  while (ran.length < max && Date.now() - t0 < budget) {
    const job = await claim(config.workerId, caps);
    if (!job) break;
    const r = await runJob(job);
    ran.push({ id: job.id, type: job.type, ok: r.ok, error: r.error });
  }
  await heartbeat('tick', { caps, ran: ran.length, ms: Date.now() - t0 });
  return { enqueued, ran };
}

export async function health({ alert = false } = {}): Promise<{ ok: boolean; checks: { name: string; ok: boolean; detail: string }[] }> {
  const checks: { name: string; ok: boolean; detail: string }[] = [];
  const d = await db();
  try {
    await d.query('SELECT 1');
    checks.push({ name: 'base de datos', ok: true, detail: d.kind });
  } catch (e) {
    checks.push({ name: 'base de datos', ok: false, detail: String(e) });
    return { ok: false, checks };
  }
  const hb = await d.query<{ worker: string; at: string }>(`SELECT worker, at FROM smf.heartbeats ORDER BY at DESC LIMIT 5`);
  const ultimo = hb[0] ? (Date.now() - new Date(hb[0].at).getTime()) / 60000 : Infinity;
  checks.push({ name: 'ejecutor programado', ok: ultimo < 45, detail: hb[0] ? `último latido hace ${Math.round(ultimo)} min (${hb[0].worker})` : 'nunca corrió' });
  const [{ n: muertos }] = await d.query<{ n: number }>(`SELECT COUNT(*)::int n FROM smf.jobs WHERE status = 'dead' AND finished_at > now() - interval '24 hours'`);
  checks.push({ name: 'trabajos fallidos (24 h)', ok: muertos === 0, detail: String(muertos) });
  const [{ n: atrasados }] = await d.query<{ n: number }>(`SELECT COUNT(*)::int n FROM smf.jobs WHERE status = 'queued' AND run_at < now() - interval '2 hours'`);
  checks.push({ name: 'cola al día', ok: atrasados === 0, detail: atrasados ? `${atrasados} trabajo(s) esperando hace más de 2 h (¿falta un ejecutor con render?)` : 'sí' });
  const ks = await getKillSwitch();
  checks.push({ name: 'pausa general', ok: true, detail: ks.paused ? `ACTIVA: ${ks.reason ?? ''}` : 'no' });
  const ok = checks.every((c) => c.ok);
  if (alert && !ok) {
    await notify({ kind: 'runtime_failure', severity: 'critical', title: 'La Factory necesita atención', body: checks.filter((c) => !c.ok).map((c) => `✗ ${c.name}: ${c.detail}`).join('\n'), dedupKey: `health:${new Date().toISOString().slice(0, 13)}` });
  }
  return { ok, checks };
}

/** El bucle del servicio persistente. */
export function startLoop(intervalMs = 30_000): () => void {
  let corriendo = false;
  let parado = false;
  const vuelta = async () => {
    if (corriendo || parado) return;
    corriendo = true;
    try {
      const r = await tick({ budgetMs: Math.max(intervalMs * 8, 120_000) });
      if (r.ran.length) console.log(`[tick] ${r.ran.map((x) => `${x.type}:${x.ok ? 'ok' : 'error'}`).join(', ')}`);
    } catch (e) {
      console.error('[tick] error', e);
      await audit({ actor: 'system', action: 'runtime.tick', decision: 'failed', details: { error: e instanceof Error ? e.message : String(e) } });
    } finally {
      corriendo = false;
    }
  };
  const t = setInterval(vuelta, intervalMs);
  void vuelta();
  return () => {
    parado = true;
    clearInterval(t);
  };
}
