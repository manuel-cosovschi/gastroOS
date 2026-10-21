/**
 * «Ejecutá el marketing de todos los productos de Sovare.»
 *
 * Por cada producto anunciable, en orden, y sin saltear controles:
 *
 *   1. Sincroniza el catálogo y verifica los hechos contra el repo.
 *   2. Verifica la página /conv (y el píxel).
 *   3. Completa conceptos hasta `concepts_per_product` (sólo con claims
 *      verificados).
 *   4. Renderiza los formatos que falten (9:16 y 4:5 por defecto) y los valida.
 *   5. Si hay presupuesto configurado y no hay campaña en curso, prepara una,
 *      la crea en Meta en pausa y pide el lanzamiento (que pasa por la
 *      política: el primer gasto real de un producto lo autoriza el dueño).
 *   6. Programa orgánico si el canal está activado.
 *
 * Devuelve qué hizo, qué quedó bloqueado y qué espera autorización. Nada de
 * esto se declara «publicado» si Meta no lo confirmó.
 */

import { db } from '../db/index.ts';
import { getSetting, getPolicy } from '../core/settings.ts';
import type { Actor } from '../core/audit.ts';
import { audit } from '../core/audit.ts';
import { SmfError } from '../core/util.ts';
import { loadCatalog, syncCatalog } from '../catalog/index.ts';
import { verifyLanding } from '../conversion/landing.ts';
import { generateConcepts } from '../creative/concepts.ts';
import { renderCreative } from '../creative/index.ts';
import type { FormatId } from '../creative/formats.ts';
import { launchCampaign, prepareCampaign, pushCampaign } from '../meta/ads.ts';
import { schedulePost } from '../meta/organic.ts';
import { enqueue } from './jobs.ts';

export interface CampaignDefaults {
  daily_budget_ars: Record<string, number>;
  formats: FormatId[];
  concepts_per_product: number;
  duration_s: number;
  organic: { enabled: boolean; per_week: number; hour: number; channels: ('instagram' | 'facebook')[] };
}

export const DEFAULT_CAMPAIGN: CampaignDefaults = {
  daily_budget_ars: {},
  formats: ['reels_9x16', 'feed_4x5'],
  concepts_per_product: 3,
  duration_s: 15,
  organic: { enabled: false, per_week: 3, hour: 19, channels: ['instagram'] },
};

export async function campaignDefaults(): Promise<CampaignDefaults> {
  const s = await getSetting<Partial<CampaignDefaults>>('campaign_defaults', {});
  return { ...DEFAULT_CAMPAIGN, ...s, organic: { ...DEFAULT_CAMPAIGN.organic, ...(s.organic ?? {}) }, daily_budget_ars: { ...(s.daily_budget_ars ?? {}) } };
}

export interface StepResult {
  step: string;
  status: 'done' | 'skipped' | 'blocked' | 'needs_approval' | 'failed' | 'queued';
  detail: string;
  data?: unknown;
}

export interface ProductRun {
  product: string;
  steps: StepResult[];
}

export async function runMarketing(opts: { products?: string[]; actor: Actor; renderInline?: boolean; launch?: boolean } = { actor: 'system' }): Promise<{ products: ProductRun[]; startedAt: string; finishedAt: string }> {
  const startedAt = new Date().toISOString();
  const defaults = await campaignDefaults();
  const sync = await syncCatalog({ refresh: true, actor: opts.actor });
  const pedidos = opts.products?.length ? opts.products : undefined;
  const productos = loadCatalog().filter((p) => p.marketable && p.status === 'active' && (!pedidos || pedidos.includes(p.id)));
  if (pedidos && !productos.length) throw new SmfError(`Ninguno de ${pedidos.join(', ')} es un producto anunciable del catálogo.`, 'not_found');
  const d = await db();
  const out: ProductRun[] = [];

  for (const p of productos) {
    const steps: StepResult[] = [];
    const add = (s: StepResult) => steps.push(s);
    const r = sync.find((x) => x.product === p.id)!;
    const malas = r.facts.evidence.filter((e) => !e.ok);
    add({ step: 'catálogo', status: malas.length ? 'blocked' : 'done', detail: malas.length ? `${malas.length} evidencia(s) ya no verificables: ${malas.map((m) => m.ref).join(', ')}` : `hechos verificados (${r.facts.verifiedClaims.length} claims, ${r.facts.verifiedAngles.length} ángulos, ${r.facts.pricing.plans.length} planes)` });

    try {
      const conv = await verifyLanding(p.id, { actor: opts.actor });
      add({ step: '/conv', status: conv.ok ? 'done' : 'blocked', detail: `${conv.ok ? 'responde y muestra cada variante' : 'falló: ' + conv.checks.filter((c) => !c.ok && c.blocking).map((c) => c.name).join(', ')}; píxel: ${conv.pixel === 'present' ? 'presente' : 'NO instalado'}` });
    } catch (e) {
      add({ step: '/conv', status: 'failed', detail: e instanceof Error ? e.message : String(e) });
    }

    const [{ n: vivos }] = await d.query<{ n: number }>(`SELECT COUNT(*)::int n FROM smf.concepts WHERE product_id = $1 AND status <> 'stale'`, [p.id]);
    if (vivos < defaults.concepts_per_product) {
      try {
        const nuevos = await generateConcepts(p.id, { count: defaults.concepts_per_product - vivos, createdBy: opts.actor });
        add({ step: 'conceptos', status: 'done', detail: `${nuevos.length} concepto(s) nuevo(s)`, data: nuevos.map((c) => ({ id: c.id, angle: c.angle, headline: c.headline })) });
      } catch (e) {
        add({ step: 'conceptos', status: 'failed', detail: e instanceof Error ? e.message : String(e) });
      }
    } else add({ step: 'conceptos', status: 'skipped', detail: `ya hay ${vivos}` });

    const faltan = await d.query<{ concept_id: string; format: string }>(
      `SELECT c.id AS concept_id, f.format FROM smf.concepts c CROSS JOIN unnest($2::text[]) AS f(format)
       WHERE c.product_id = $1 AND c.status <> 'stale'
         AND NOT EXISTS (SELECT 1 FROM smf.creatives r WHERE r.concept_id = c.id AND r.format = f.format AND r.status IN ('ready','rendering'))`,
      [p.id, defaults.formats]
    );
    if (!faltan.length) add({ step: 'creativos', status: 'skipped', detail: 'todos los formatos están renderizados' });
    else if (opts.renderInline) {
      const hechos: string[] = [];
      const fallas: string[] = [];
      for (const f of faltan) {
        try {
          const c = await renderCreative(f.concept_id, f.format as FormatId, { actor: opts.actor, duration: defaults.duration_s });
          (c.status === 'ready' ? hechos : fallas).push(`${c.id} (${f.format})`);
        } catch (e) {
          fallas.push(`${f.concept_id}/${f.format}: ${e instanceof Error ? e.message : e}`);
        }
      }
      add({ step: 'creativos', status: fallas.length ? 'failed' : 'done', detail: `${hechos.length} renderizado(s) y validado(s)${fallas.length ? `; ${fallas.length} con problemas: ${fallas.join('; ')}` : ''}`, data: { ok: hechos, failed: fallas } });
    } else {
      for (const f of faltan) await enqueue('creative.render', { concept: f.concept_id, format: f.format, duration: defaults.duration_s }, { key: `render:${f.concept_id}:${f.format}`, needs: 'render' });
      add({ step: 'creativos', status: 'queued', detail: `${faltan.length} render(s) encolado(s) para el ejecutor con Chromium` });
    }

    const presupuesto = defaults.daily_budget_ars[p.id] ?? 0;
    const [enCurso] = await d.query<{ id: string; status: string }>(`SELECT id, status FROM smf.campaigns WHERE product_id = $1 AND status IN ('prepared','in_meta_paused','pending_review','active') ORDER BY created_at DESC LIMIT 1`, [p.id]);
    if (enCurso) add({ step: 'campaña', status: 'skipped', detail: `ya hay una en curso: ${enCurso.id} (${enCurso.status})` });
    else if (!presupuesto) add({ step: 'campaña', status: 'skipped', detail: `sin presupuesto diario configurado para ${p.id} (campaign_defaults.daily_budget_ars)` });
    else {
      const listos = await d.query<{ id: string }>(`SELECT r.id FROM smf.creatives r JOIN smf.concepts c ON c.id = r.concept_id WHERE r.product_id = $1 AND r.status = 'ready' AND c.status <> 'stale' AND r.fatigue = '{}'::jsonb ORDER BY r.created_at DESC LIMIT 6`, [p.id]);
      if (!listos.length) add({ step: 'campaña', status: 'blocked', detail: 'no hay creativos listos todavía' });
      else {
        try {
          const c = await prepareCampaign({ product: p.id, creativeIds: listos.map((x) => x.id), dailyBudget: presupuesto, actor: opts.actor });
          if (c.status === 'blocked') add({ step: 'campaña', status: 'blocked', detail: c.blockers.join('; '), data: { campaign: c.id } });
          else {
            const pushed = await pushCampaign(c.id, opts.actor);
            add({ step: 'campaña', status: 'done', detail: `${pushed.id} creada en Meta en pausa${pushed.dry_run ? ' (SIMULADA: modo de prueba)' : ''}`, data: { campaign: c.id } });
            if (opts.launch !== false) {
              try {
                const l = await launchCampaign(c.id, opts.actor);
                add({ step: 'lanzamiento', status: 'done', detail: l.dry_run ? 'simulado (modo de prueba): no se gastó nada' : `estado según Meta: ${l.status}` });
              } catch (e) {
                const err = e as SmfError;
                add({ step: 'lanzamiento', status: err.code === 'needs_approval' ? 'needs_approval' : 'blocked', detail: err.message, data: err.details });
              }
            }
          }
        } catch (e) {
          const err = e as SmfError;
          add({ step: 'campaña', status: err.code === 'needs_approval' ? 'needs_approval' : 'failed', detail: err.message, data: err.details });
        }
      }
    }

    const policy = await getPolicy();
    if (!defaults.organic.enabled) add({ step: 'orgánico', status: 'skipped', detail: 'orgánico apagado en campaign_defaults.organic' });
    else {
      const canales = defaults.organic.channels.filter((c) => policy.channels[c]);
      if (!canales.length) add({ step: 'orgánico', status: 'blocked', detail: 'ningún canal orgánico activado (activar es nivel 3)' });
      else {
        const sinPublicar = await d.query<{ id: string }>(`SELECT r.id FROM smf.creatives r WHERE r.product_id = $1 AND r.status = 'ready' AND r.format = 'reels_9x16' AND NOT EXISTS (SELECT 1 FROM smf.organic_posts o WHERE o.creative_id = r.id) ORDER BY r.created_at LIMIT $2`, [p.id, defaults.organic.per_week]);
        const programados: string[] = [];
        for (const [i, c] of sinPublicar.entries()) {
          const at = new Date();
          at.setUTCDate(at.getUTCDate() + 1 + i * 2);
          at.setUTCHours(defaults.organic.hour + 3, 0, 0, 0);
          for (const ch of canales) programados.push((await schedulePost({ product: p.id, creativeIds: [c.id], channel: ch, at: at.toISOString(), actor: opts.actor })).id);
        }
        add({ step: 'orgánico', status: programados.length ? 'done' : 'skipped', detail: programados.length ? `${programados.length} publicación(es) programada(s)` : 'nada nuevo para programar' });
      }
    }
    out.push({ product: p.id, steps });
  }
  const finishedAt = new Date().toISOString();
  await audit({ actor: opts.actor, action: 'marketing.run', decision: 'done', details: { products: out.map((p) => ({ product: p.product, steps: p.steps.map((s) => `${s.step}:${s.status}`) })) } });
  return { products: out, startedAt, finishedAt };
}
