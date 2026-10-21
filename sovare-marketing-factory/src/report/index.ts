/**
 * Reportes.
 *
 * Cruza lo que dice Meta (gasto, impresiones, clics, consultas que atribuye el
 * píxel) con lo que confirman los productos (consultas guardadas, compras con
 * monto). Cuando no coinciden, el reporte muestra los dos números: Meta modela
 * y estima; la base del producto es la que cuenta la plata.
 */

import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { config } from '../config.ts';
import { db } from '../db/index.ts';
import { getMode, getKillSwitch } from '../core/settings.ts';
import { loadCatalog } from '../catalog/index.ts';
import { adStats } from '../optimize/index.ts';
import { todayAR } from '../core/util.ts';

export interface ProductSummary {
  product: string;
  name: string;
  spend: number;
  impressions: number;
  link_clicks: number;
  ctr: number | null;
  cpc: number | null;
  cpm: number | null;
  meta_leads: number;
  cpl: number | null;
  leads_confirmed: number;
  qualified: number;
  purchases: number;
  revenue: number;
  cac: number | null;
  roas: number | null;
  unattributed_purchases: number;
  organic_published: number;
  active_campaigns: number;
  ready_creatives: number;
}

export async function summary(days = 7): Promise<{ days: number; mode: string; paused: boolean; products: ProductSummary[]; topAds: Awaited<ReturnType<typeof adStats>>; alerts: { title: string; severity: string; created_at: string }[] }> {
  const d = await db();
  const stats = await adStats(days);
  const out: ProductSummary[] = [];
  for (const p of loadCatalog()) {
    const s = stats.filter((a) => a.product_id === p.id);
    const sum = (k: keyof (typeof s)[number]) => s.reduce((x, a) => x + (Number(a[k]) || 0), 0);
    const [ev] = await d.query<Record<string, string>>(
      `SELECT COUNT(*) FILTER (WHERE type IN ('lead','qualified_lead'))::int leads, COUNT(*) FILTER (WHERE type = 'qualified_lead' OR quality = 'qualified')::int q,
              COUNT(*) FILTER (WHERE type IN ('purchase','customer'))::int pu, COALESCE(SUM(value) FILTER (WHERE type = 'purchase'),0)::float8 rev,
              COUNT(*) FILTER (WHERE type IN ('purchase','customer') AND campaign_id IS NULL)::int sin
       FROM smf.events WHERE product_id = $1 AND occurred_at >= now() - ($2 || ' days')::interval`,
      [p.id, String(days)]
    );
    const [org] = await d.query<{ n: number }>(`SELECT COUNT(*)::int n FROM smf.organic_posts WHERE product_id = $1 AND status = 'published' AND updated_at >= now() - ($2 || ' days')::interval`, [p.id, String(days)]);
    const [act] = await d.query<{ n: number }>(`SELECT COUNT(*)::int n FROM smf.campaigns WHERE product_id = $1 AND status = 'active'`, [p.id]);
    const [cr] = await d.query<{ n: number }>(`SELECT COUNT(*)::int n FROM smf.creatives WHERE product_id = $1 AND status = 'ready'`, [p.id]);
    const spend = sum('spend'), imp = sum('impressions'), lc = sum('link_clicks'), le = sum('leads');
    const pu = Number(ev.pu), rev = Number(ev.rev);
    out.push({
      product: p.id, name: p.name, spend, impressions: imp, link_clicks: lc,
      ctr: imp ? lc / imp : null, cpc: lc ? spend / lc : null, cpm: imp ? (spend / imp) * 1000 : null,
      meta_leads: le, cpl: le ? spend / le : null, leads_confirmed: Number(ev.leads), qualified: Number(ev.q),
      purchases: pu, revenue: rev, cac: pu && spend ? spend / pu : null, roas: spend ? rev / spend : null, unattributed_purchases: Number(ev.sin),
      organic_published: org.n, active_campaigns: act.n, ready_creatives: cr.n,
    });
  }
  const topAds = stats.filter((a) => a.leads > 0).sort((a, b) => (a.cpl ?? Infinity) - (b.cpl ?? Infinity)).slice(0, 10);
  const alerts = await d.query<{ title: string; severity: string; created_at: string }>(`SELECT title, severity, created_at FROM smf.alerts WHERE created_at >= now() - ($1 || ' days')::interval AND severity IN ('critical','action','sale','warning') ORDER BY created_at DESC LIMIT 20`, [String(days)]);
  return { days, mode: await getMode(), paused: (await getKillSwitch()).paused, products: out, topAds, alerts };
}

const $ = (n: number | null, dec = 0) => (n === null ? '—' : `$${n.toLocaleString('es-AR', { maximumFractionDigits: dec })}`);
const pct = (n: number | null) => (n === null ? '—' : `${(n * 100).toFixed(2)}%`);
const num = (n: number) => n.toLocaleString('es-AR');

export async function weeklyReport(days = 7): Promise<{ markdown: string; path: string }> {
  const s = await summary(days);
  const l: string[] = [];
  l.push(`# Reporte de marketing — últimos ${days} días (al ${todayAR()})`, '');
  l.push(`Modo: **${s.mode === 'live' ? 'real' : 'prueba (nada se publicó ni gastó)'}**${s.paused ? ' · **PAUSA GENERAL ACTIVA**' : ''}`, '');
  l.push('| Producto | Gasto | Impr. | CTR | CPC | CPM | Consultas (Meta) | CPL | Consultas confirmadas | Calificadas | Compras | Ingresos | CAC | ROAS |');
  l.push('|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|');
  for (const p of s.products) {
    l.push(`| ${p.name} | ${$(p.spend)} | ${num(p.impressions)} | ${pct(p.ctr)} | ${$(p.cpc)} | ${$(p.cpm)} | ${num(p.meta_leads)} | ${$(p.cpl)} | ${num(p.leads_confirmed)} | ${num(p.qualified)} | ${num(p.purchases)} | ${$(p.revenue)} | ${$(p.cac)} | ${p.roas === null ? '—' : p.roas.toFixed(2)} |`);
  }
  l.push('');
  for (const p of s.products) {
    const notas: string[] = [];
    if (p.unattributed_purchases) notas.push(`${p.unattributed_purchases} compra(s) sin atribución de campaña`);
    if (p.meta_leads && p.leads_confirmed && Math.abs(p.meta_leads - p.leads_confirmed) / p.leads_confirmed > 0.3) notas.push(`Meta cuenta ${p.meta_leads} consultas y la base ${p.leads_confirmed}: la base es la que vale`);
    notas.push(`${p.active_campaigns} campaña(s) activa(s), ${p.ready_creatives} creativo(s) listos, ${p.organic_published} publicación(es) orgánica(s)`);
    l.push(`- **${p.name}**: ${notas.join('; ')}.`);
  }
  l.push('', '## Anuncios con menor costo por consulta', '');
  if (!s.topAds.length) l.push('Todavía no hay anuncios con consultas en el período.');
  else {
    l.push('| Anuncio | Producto | Impr. | CTR | Consultas | CPL | Muestra |', '|---|---|---:|---:|---:|---:|---|');
    for (const a of s.topAds) l.push(`| ${a.ad_id} | ${a.product_id} | ${num(a.impressions)} | ${pct(a.ctr)} | ${a.leads} | ${$(a.cpl)} | ${a.impressions >= 3000 ? 'suficiente' : 'chica: no concluyente'} |`);
  }
  l.push('', '## Alertas del período', '');
  l.push(...(s.alerts.length ? s.alerts.map((a) => `- [${a.severity}] ${a.title}`) : ['Ninguna.']));
  l.push('', '_Meta estima las conversiones que atribuye; las consultas y compras «confirmadas» son las que guardaron los productos._');
  const markdown = l.join('\n');
  const dir = join(config.outDir, 'reports');
  mkdirSync(dir, { recursive: true });
  const path = join(dir, `reporte-${todayAR()}-${days}d.md`);
  writeFileSync(path, markdown);
  return { markdown, path };
}
