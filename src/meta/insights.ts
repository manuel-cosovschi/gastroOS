/**
 * Métricas de Meta, por anuncio y por día.
 *
 * Se piden a nivel anuncio con `time_increment=1` y se guardan en
 * `smf.metrics_daily` (clave día + anuncio: re-sincronizar no duplica). Los
 * resultados de conversión salen de `actions`: los leads del píxel
 * (`offsite_conversion.fb_pixel_lead`, `lead`) y las compras
 * (`offsite_conversion.fb_pixel_purchase`, `purchase`). Esos son los que Meta
 * atribuye; los que confirman los productos llegan por `smf.events` y se
 * cruzan en el reporte.
 */

import { db } from '../db/index.ts';
import { config } from '../config.ts';
import { addDays, todayAR } from '../core/util.ts';
import { act, graphAll } from './graph.ts';

interface InsightRow {
  ad_id: string;
  date_start: string;
  impressions?: string;
  reach?: string;
  clicks?: string;
  inline_link_clicks?: string;
  spend?: string;
  frequency?: string;
  actions?: { action_type: string; value: string }[];
  video_p75_watched_actions?: { action_type: string; value: string }[];
}

const LEAD = new Set(['offsite_conversion.fb_pixel_lead', 'lead', 'onsite_web_lead']);
const PURCHASE = new Set(['offsite_conversion.fb_pixel_purchase', 'purchase', 'onsite_web_purchase']);

function sumActions(actions: InsightRow['actions'], types: Set<string>): number {
  // Meta repite la misma conversión con varios nombres (`lead` y el del píxel):
  // se toma el mayor, no la suma.
  return Math.max(0, ...(actions ?? []).filter((a) => types.has(a.action_type)).map((a) => Number(a.value) || 0));
}

export async function syncInsights({ days = 7 }: { days?: number } = {}): Promise<{ rows: number; since: string; until: string; skipped?: string }> {
  const until = todayAR();
  const since = addDays(until, -(days - 1));
  if (!config.meta.accessToken || !config.meta.adAccountId) return { rows: 0, since, until, skipped: 'sin credenciales de Meta' };
  const rows = await graphAll<InsightRow>(`${act()}/insights`, {
    level: 'ad',
    time_increment: 1,
    time_range: { since, until },
    fields: 'ad_id,impressions,reach,clicks,inline_link_clicks,spend,frequency,actions,video_p75_watched_actions',
  });
  const d = await db();
  for (const r of rows) {
    const [local] = await d.query<{ id: string; campaign_id: string; product_id: string }>(
      'SELECT a.id, a.campaign_id, c.product_id FROM smf.ads a JOIN smf.campaigns c ON c.id = a.campaign_id WHERE a.meta_ad_id = $1',
      [r.ad_id]
    );
    await d.query(
      `INSERT INTO smf.metrics_daily (day, meta_ad_id, ad_id, campaign_id, product_id, impressions, reach, clicks, link_clicks, spend, leads, purchases, frequency, video_p75, synced_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14, now())
       ON CONFLICT (day, meta_ad_id) DO UPDATE SET impressions=EXCLUDED.impressions, reach=EXCLUDED.reach, clicks=EXCLUDED.clicks, link_clicks=EXCLUDED.link_clicks,
         spend=EXCLUDED.spend, leads=EXCLUDED.leads, purchases=EXCLUDED.purchases, frequency=EXCLUDED.frequency, video_p75=EXCLUDED.video_p75, synced_at=now(),
         ad_id=COALESCE(EXCLUDED.ad_id, smf.metrics_daily.ad_id), campaign_id=COALESCE(EXCLUDED.campaign_id, smf.metrics_daily.campaign_id), product_id=COALESCE(EXCLUDED.product_id, smf.metrics_daily.product_id)`,
      [
        r.date_start, r.ad_id, local?.id ?? null, local?.campaign_id ?? null, local?.product_id ?? null,
        Number(r.impressions ?? 0), Number(r.reach ?? 0), Number(r.clicks ?? 0), Number(r.inline_link_clicks ?? 0), Number(r.spend ?? 0),
        sumActions(r.actions, LEAD), sumActions(r.actions, PURCHASE), Number(r.frequency ?? 0), sumActions(r.video_p75_watched_actions, new Set(['video_view'])),
      ]
    );
  }
  return { rows: rows.length, since, until };
}
