/**
 * Optimization Engine.
 *
 * Mira los últimos días de cada anuncio y propone (o ejecuta, si la política lo
 * autoriza) acciones concretas. Reglas, en orden:
 *
 *   1. Muestra mínima. Un anuncio con menos de `min_impressions` impresiones o
 *      menos de `min_spend_ars` gastados no se juzga: se dice «sin datos
 *      suficientes» y nada más.
 *   2. CTR bajo. Se compara contra el resto de los anuncios del mismo producto
 *      con intervalos de Wilson al 95%: sólo si el MEJOR caso del anuncio es
 *      peor que el PEOR caso del resto se propone pausarlo. Una diferencia que
 *      puede ser azar no mueve nada.
 *   3. Costo por consulta. Si gastó `cpl_kill_multiple` veces el costo objetivo
 *      sin ninguna consulta, o su CPL supera `cpl_bad_multiple` × objetivo con
 *      al menos `min_leads_for_cpl` consultas, se propone pausar. Sin costo
 *      objetivo cargado por el dueño, esta regla no corre.
 *   4. Fatiga. Frecuencia alta y CTR de los últimos días claramente menor que
 *      el de los primeros: se marca el creativo como agotado y se piden
 *      variantes nuevas del mismo ángulo.
 *   5. Reparto. Entre campañas del mismo producto con consultas suficientes,
 *      se mueve presupuesto (dentro del % máximo y del tope total) hacia la de
 *      menor CPL. Es una apuesta prudente, no una conclusión: el informe lo
 *      dice así. Correlación no es causalidad: el reparto se revisa cada día.
 *   6. Alertas: campaña activa sin entregas en 24 h; gasto del día mayor al
 *      presupuesto.
 */

import { db, j } from '../db/index.ts';
import { audit, type Actor } from '../core/audit.ts';
import { getSetting } from '../core/settings.ts';
import { guard } from '../core/policy.ts';
import { notify } from '../notify/index.ts';
import { pauseAd, setDailyBudget } from '../meta/ads.ts';

export interface OptimizerSettings {
  window_days: number;
  min_impressions: number;
  min_spend_ars: number;
  /** Costo objetivo por consulta, por producto. Lo carga el dueño. */
  target_cpl_ars: Record<string, number>;
  cpl_kill_multiple: number;
  cpl_bad_multiple: number;
  min_leads_for_cpl: number;
  fatigue_frequency: number;
  fatigue_ctr_drop: number;
  rebalance_min_leads: number;
}

export const DEFAULT_OPTIMIZER: OptimizerSettings = {
  window_days: 7,
  min_impressions: 3000,
  min_spend_ars: 5000,
  target_cpl_ars: {},
  cpl_kill_multiple: 3,
  cpl_bad_multiple: 2,
  min_leads_for_cpl: 3,
  fatigue_frequency: 3.5,
  fatigue_ctr_drop: 0.35,
  rebalance_min_leads: 5,
};

export async function optimizerSettings(): Promise<OptimizerSettings> {
  const s = await getSetting<Partial<OptimizerSettings>>('optimizer', {});
  return { ...DEFAULT_OPTIMIZER, ...s, target_cpl_ars: { ...DEFAULT_OPTIMIZER.target_cpl_ars, ...(s.target_cpl_ars ?? {}) } };
}

/** Intervalo de Wilson al 95% para una proporción. */
export function wilson(successes: number, trials: number, z = 1.96): [number, number] {
  if (trials <= 0) return [0, 1];
  const p = successes / trials;
  const den = 1 + (z * z) / trials;
  const centro = (p + (z * z) / (2 * trials)) / den;
  const margen = (z * Math.sqrt((p * (1 - p)) / trials + (z * z) / (4 * trials * trials))) / den;
  return [Math.max(0, centro - margen), Math.min(1, centro + margen)];
}

export interface AdStats {
  ad_id: string;
  campaign_id: string;
  product_id: string;
  creative_id: string;
  impressions: number;
  link_clicks: number;
  spend: number;
  leads: number;
  confirmed_leads: number;
  qualified: number;
  purchases: number;
  revenue: number;
  frequency: number;
  ctr: number;
  cpc: number | null;
  cpm: number | null;
  cpl: number | null;
  cac: number | null;
  roas: number | null;
  landing_cvr: number | null;
  early_ctr: number | null;
  late_ctr: number | null;
}

export async function adStats(days: number): Promise<AdStats[]> {
  const d = await db();
  const rows = await d.query<Record<string, string | number | null>>(
    `WITH m AS (
       SELECT ad_id, campaign_id, product_id, SUM(impressions) imp, SUM(link_clicks) lc, SUM(spend) sp, SUM(leads) le, MAX(frequency) fr,
              SUM(CASE WHEN day < (CURRENT_DATE - ($1::int / 2)) THEN link_clicks END)::float8 / NULLIF(SUM(CASE WHEN day < (CURRENT_DATE - ($1::int / 2)) THEN impressions END),0) early,
              SUM(CASE WHEN day >= (CURRENT_DATE - ($1::int / 2)) THEN link_clicks END)::float8 / NULLIF(SUM(CASE WHEN day >= (CURRENT_DATE - ($1::int / 2)) THEN impressions END),0) late
       FROM smf.metrics_daily WHERE day >= CURRENT_DATE - $1::int AND ad_id IS NOT NULL GROUP BY 1,2,3),
     e AS (
       SELECT ad_id, COUNT(*) FILTER (WHERE type IN ('lead','qualified_lead')) cl, COUNT(*) FILTER (WHERE type = 'qualified_lead' OR quality = 'qualified') q,
              COUNT(*) FILTER (WHERE type IN ('purchase','customer')) pu, COALESCE(SUM(value) FILTER (WHERE type = 'purchase'),0) rev
       FROM smf.events WHERE occurred_at >= now() - ($1 || ' days')::interval AND ad_id IS NOT NULL GROUP BY 1)
     SELECT m.*, a.creative_id, COALESCE(e.cl,0) cl, COALESCE(e.q,0) q, COALESCE(e.pu,0) pu, COALESCE(e.rev,0) rev
     FROM m JOIN smf.ads a ON a.id = m.ad_id LEFT JOIN e ON e.ad_id = m.ad_id`,
    [days]
  );
  return rows.map((r) => {
    const imp = Number(r.imp), lc = Number(r.lc), sp = Number(r.sp), le = Number(r.le);
    const pu = Number(r.pu), rev = Number(r.rev);
    return {
      ad_id: String(r.ad_id), campaign_id: String(r.campaign_id), product_id: String(r.product_id), creative_id: String(r.creative_id),
      impressions: imp, link_clicks: lc, spend: sp, leads: le, confirmed_leads: Number(r.cl), qualified: Number(r.q), purchases: pu, revenue: rev,
      frequency: Number(r.fr), ctr: imp ? lc / imp : 0, cpc: lc ? sp / lc : null, cpm: imp ? (sp / imp) * 1000 : null,
      cpl: le ? sp / le : null, cac: pu ? sp / pu : null, roas: sp ? rev / sp : null, landing_cvr: lc ? le / lc : null,
      early_ctr: r.early === null ? null : Number(r.early), late_ctr: r.late === null ? null : Number(r.late),
    };
  });
}

export interface Finding {
  rule: 'insufficient_sample' | 'low_ctr' | 'high_cpl' | 'no_leads' | 'fatigue' | 'rebalance' | 'no_delivery' | 'overspend';
  product: string;
  target: string;
  observation: string;
  evidence: Record<string, unknown>;
  proposal?: { action: 'pause_ad' | 'new_variants' | 'shift_budget' | 'check'; detail: string; from?: string; to?: string; pct?: number };
  outcome?: string;
}

export async function analyze(): Promise<{ settings: OptimizerSettings; stats: AdStats[]; findings: Finding[] }> {
  const s = await optimizerSettings();
  const stats = await adStats(s.window_days);
  const findings: Finding[] = [];
  const fmt = (n: number | null, dec = 0) => (n === null ? '—' : n.toLocaleString('es-AR', { maximumFractionDigits: dec }));

  for (const a of stats) {
    if (a.impressions < s.min_impressions || a.spend < s.min_spend_ars) {
      findings.push({ rule: 'insufficient_sample', product: a.product_id, target: a.ad_id, observation: `Sin datos suficientes para juzgarlo (${fmt(a.impressions)} impresiones, $${fmt(a.spend)} gastados).`, evidence: { impressions: a.impressions, spend: a.spend } });
      continue;
    }
    // CTR contra el resto del producto (con muestra suficiente).
    const resto = stats.filter((b) => b.product_id === a.product_id && b.ad_id !== a.ad_id && b.impressions >= s.min_impressions);
    const restoImp = resto.reduce((x, b) => x + b.impressions, 0);
    const restoClk = resto.reduce((x, b) => x + b.link_clicks, 0);
    if (restoImp >= s.min_impressions) {
      const [, alto] = wilson(a.link_clicks, a.impressions);
      const [bajoResto] = wilson(restoClk, restoImp);
      if (alto < bajoResto) {
        findings.push({
          rule: 'low_ctr', product: a.product_id, target: a.ad_id,
          observation: `CTR ${(a.ctr * 100).toFixed(2)}% contra ${((restoClk / restoImp) * 100).toFixed(2)}% del resto; la diferencia es mayor que el azar (Wilson 95%).`,
          evidence: { ctr: a.ctr, ctr_upper: alto, rest_ctr: restoClk / restoImp, rest_lower: bajoResto },
          proposal: { action: 'pause_ad', detail: 'Pausar el anuncio y dejar que el presupuesto vaya a los otros.' },
        });
        continue;
      }
    }
    const objetivo = s.target_cpl_ars[a.product_id];
    if (objetivo) {
      if (a.leads === 0 && a.spend >= objetivo * s.cpl_kill_multiple) {
        findings.push({ rule: 'no_leads', product: a.product_id, target: a.ad_id, observation: `Gastó $${fmt(a.spend)} (${s.cpl_kill_multiple}× el costo objetivo de $${fmt(objetivo)}) sin ninguna consulta.`, evidence: { spend: a.spend, target_cpl: objetivo }, proposal: { action: 'pause_ad', detail: 'Pausar.' } });
        continue;
      }
      if (a.cpl !== null && a.leads >= s.min_leads_for_cpl && a.cpl > objetivo * s.cpl_bad_multiple) {
        findings.push({ rule: 'high_cpl', product: a.product_id, target: a.ad_id, observation: `CPL $${fmt(a.cpl)} con ${a.leads} consultas: más de ${s.cpl_bad_multiple}× el objetivo ($${fmt(objetivo)}).`, evidence: { cpl: a.cpl, leads: a.leads, target_cpl: objetivo }, proposal: { action: 'pause_ad', detail: 'Pausar.' } });
        continue;
      }
    }
    if (a.frequency >= s.fatigue_frequency && a.early_ctr && a.late_ctr !== null && a.late_ctr < a.early_ctr * (1 - s.fatigue_ctr_drop)) {
      findings.push({
        rule: 'fatigue', product: a.product_id, target: a.creative_id,
        observation: `Frecuencia ${a.frequency.toFixed(1)} y el CTR bajó de ${(a.early_ctr * 100).toFixed(2)}% a ${(a.late_ctr * 100).toFixed(2)}%: el público ya lo vio.`,
        evidence: { frequency: a.frequency, early_ctr: a.early_ctr, late_ctr: a.late_ctr },
        proposal: { action: 'new_variants', detail: 'Generar variantes nuevas del mismo ángulo con otra plantilla.' },
      });
    }
  }

  // Reparto entre campañas del mismo producto.
  const porCampaña = new Map<string, { product: string; spend: number; leads: number }>();
  for (const a of stats) {
    const c = porCampaña.get(a.campaign_id) ?? { product: a.product_id, spend: 0, leads: 0 };
    c.spend += a.spend;
    c.leads += a.leads;
    porCampaña.set(a.campaign_id, c);
  }
  const d = await db();
  const activas = new Set((await d.query<{ id: string }>(`SELECT id FROM smf.campaigns WHERE status = 'active'`)).map((r) => r.id));
  for (const product of new Set([...porCampaña.values()].map((c) => c.product))) {
    const cands = [...porCampaña.entries()].filter(([id, c]) => c.product === product && activas.has(id) && c.leads >= s.rebalance_min_leads).map(([id, c]) => ({ id, cpl: c.spend / c.leads, ...c }));
    if (cands.length < 2) continue;
    cands.sort((x, y) => x.cpl - y.cpl);
    const mejor = cands[0], peor = cands[cands.length - 1];
    if (peor.cpl > mejor.cpl * 1.5) {
      findings.push({
        rule: 'rebalance', product, target: mejor.id,
        observation: `En los últimos ${s.window_days} días, ${mejor.id} consiguió consultas a $${fmt(mejor.cpl)} y ${peor.id} a $${fmt(peor.cpl)}. Es una diferencia observada, no una causa probada: se mueve poco y se revisa mañana.`,
        evidence: { best: mejor, worst: peor },
        proposal: { action: 'shift_budget', detail: 'Mover presupuesto a la de menor CPL, dentro del % máximo.', from: peor.id, to: mejor.id },
      });
    }
  }

  // Alertas de entrega y gasto.
  const hoy = await d.query<{ id: string; product_id: string; daily_budget_ars: string; imp: string | null; spend: string | null }>(
    `SELECT c.id, c.product_id, c.daily_budget_ars, SUM(m.impressions)::text imp, SUM(m.spend)::text spend
     FROM smf.campaigns c LEFT JOIN smf.metrics_daily m ON m.campaign_id = c.id AND m.day >= CURRENT_DATE - 1
     WHERE c.status = 'active' AND c.dry_run = false AND c.updated_at < now() - interval '24 hours' GROUP BY 1,2,3`
  );
  for (const c of hoy) {
    if (!Number(c.imp)) findings.push({ rule: 'no_delivery', product: c.product_id, target: c.id, observation: 'Activa hace más de 24 h y sin impresiones.', evidence: {}, proposal: { action: 'check', detail: 'Revisar revisión de anuncios, saldo y segmentación.' } });
    if (Number(c.spend) > Number(c.daily_budget_ars) * 2 * 1.25) findings.push({ rule: 'overspend', product: c.product_id, target: c.id, observation: `Gastó $${fmt(Number(c.spend))} en 2 días con $${fmt(Number(c.daily_budget_ars))} por día.`, evidence: { spend: Number(c.spend) } });
  }
  return { settings: s, stats, findings };
}

/** Analiza y ejecuta lo que la política permite; el resto queda propuesto. */
export async function runOptimizer(actor: Actor = 'system'): Promise<{ findings: Finding[] }> {
  const { settings, findings } = await analyze();
  const d = await db();
  for (const f of findings) {
    try {
      if (f.proposal?.action === 'pause_ad') {
        const dec = await guard({ action: 'meta.ad.pause_underperformer', actor, target: f.target, details: { rule: f.rule } });
        if (dec.allowed) {
          await pauseAd(f.target, actor, f.observation, 'meta.ad.pause_underperformer');
          f.outcome = dec.dryRun ? 'pausado (simulado)' : 'pausado';
        } else f.outcome = `propuesto: ${dec.reason}`;
      } else if (f.proposal?.action === 'new_variants') {
        await d.query(`UPDATE smf.creatives SET fatigue = $2::jsonb WHERE id = $1`, [f.target, j({ at: new Date().toISOString(), ...f.evidence })]);
        const { enqueue } = await import('../runtime/jobs.ts');
        await enqueue('creative.replenish', { product: f.product, reason: 'fatiga', creative: f.target }, { key: `replenish:${f.product}:${new Date().toISOString().slice(0, 10)}`, needs: 'render' });
        f.outcome = 'se encolaron variantes nuevas';
      } else if (f.proposal?.action === 'shift_budget' && f.proposal.from && f.proposal.to) {
        const [desde] = await d.query<{ daily_budget_ars: string }>('SELECT daily_budget_ars FROM smf.campaigns WHERE id = $1', [f.proposal.from]);
        const [hacia] = await d.query<{ daily_budget_ars: string }>('SELECT daily_budget_ars FROM smf.campaigns WHERE id = $1', [f.proposal.to]);
        const { getPolicy } = await import('../core/settings.ts');
        const pct = Math.min((await getPolicy()).budget.max_change_pct, 20) / 100;
        const mover = Math.round(Number(desde.daily_budget_ars) * pct);
        try {
          await setDailyBudget(f.proposal.from, Number(desde.daily_budget_ars) - mover, actor);
          await setDailyBudget(f.proposal.to, Number(hacia.daily_budget_ars) + mover, actor);
          f.outcome = `se movieron $${mover} por día`;
        } catch (e) {
          f.outcome = `propuesto: ${e instanceof Error ? e.message : e}`;
        }
      } else if (f.rule === 'no_delivery' || f.rule === 'overspend') {
        await notify({ kind: 'budget_alert', severity: 'critical', title: `${f.product}: ${f.rule === 'overspend' ? 'gasto mayor al presupuesto' : 'campaña sin entregas'}`, body: f.observation, dedupKey: `opt:${f.rule}:${f.target}:${new Date().toISOString().slice(0, 10)}` });
        f.outcome = 'avisado';
      }
    } catch (e) {
      f.outcome = `error: ${e instanceof Error ? e.message : e}`;
    }
  }
  const relevantes = findings.filter((f) => f.rule !== 'insufficient_sample');
  if (relevantes.length) {
    await notify({ kind: 'optimization', severity: 'info', title: `Optimización: ${relevantes.length} hallazgo(s)`, body: relevantes.map((f) => `• [${f.product}] ${f.observation} → ${f.outcome ?? 'sin acción'}`).join('\n'), dedupKey: `opt:${new Date().toISOString().slice(0, 13)}` });
  }
  await audit({ actor, action: 'optimize.analyze', decision: 'done', details: { findings: findings.map((f) => ({ rule: f.rule, target: f.target, outcome: f.outcome })), window: settings.window_days } });
  return { findings };
}
