/**
 * Meta Ads Engine.
 *
 * El ciclo de una campaña:
 *
 *   prepare  (nivel 1)  Borrador local: creativos validados, URL /conv
 *                       verificada, UTMs por anuncio, presupuesto, bloqueos.
 *   push     (nivel 2)  Sube los videos y crea campaña, conjunto, creativos y
 *                       anuncios en Meta, TODO EN PAUSA. Verifica cada objeto
 *                       leyéndolo de vuelta.
 *   launch   (nivel 2/3) Activa. El primer gasto real de un producto es nivel 3.
 *                       Después lee `effective_status`: sólo si Meta dice
 *                       ACTIVE la campaña queda «activa»; si está en revisión,
 *                       queda «en revisión».
 *   pause    (siempre)  Pausar nunca se bloquea, ni con la pausa general.
 *   budget   (nivel 2)  Dentro de los topes; si no, pide autorización.
 *   refresh             Lee estados y revisión; si Meta rechaza un anuncio,
 *                       avisa.
 *
 * En modo de prueba las escrituras se simulan (ids `dry_…`) y la campaña queda
 * marcada `dry_run`. Para salir en serio hay que prepararla de nuevo en modo
 * real: un objeto simulado nunca se «promueve» a real.
 */

import { config } from '../config.ts';
import { db, j } from '../db/index.ts';
import { audit, type Actor } from '../core/audit.ts';
import { guard, require } from '../core/policy.ts';
import { getMode, getPolicy } from '../core/settings.ts';
import { newId, slug, SmfError, sleep, todayAR } from '../core/util.ts';
import { getProduct } from '../catalog/index.ts';
import { getCreative, type Creative } from '../creative/index.ts';
import { getConcept } from '../creative/concepts.ts';
import { lastLandingCheck } from '../conversion/landing.ts';
import { notify } from '../notify/index.ts';
import { act, graph, isSimulatedId } from './graph.ts';

export type Objective = 'leads' | 'traffic';

export interface CampaignRow {
  id: string;
  product_id: string;
  name: string;
  objective: string;
  status: 'draft' | 'prepared' | 'blocked' | 'in_meta_paused' | 'pending_review' | 'active' | 'paused' | 'rejected' | 'archived';
  daily_budget_ars: string;
  destination_url: string;
  plan: CampaignPlan;
  meta_campaign_id: string | null;
  meta_adset_id: string | null;
  meta_status: Record<string, unknown>;
  dry_run: boolean;
  blockers: string[];
  created_at: string;
  updated_at: string;
}

export interface CampaignPlan {
  objective: Objective;
  meta_objective: 'OUTCOME_LEADS' | 'OUTCOME_TRAFFIC';
  optimization_goal: 'OFFSITE_CONVERSIONS' | 'LINK_CLICKS' | 'LANDING_PAGE_VIEWS';
  promoted_object?: { pixel_id: string; custom_event_type: 'LEAD' };
  targeting: Record<string, unknown>;
  utm_campaign: string;
  ads: { adId: string; creativeId: string; conceptId: string; format: string; url: string; utm_content: string }[];
  /** Nota humana de lo que se decidió y por qué. */
  notes: string[];
}

/** El link de un anuncio: /conv con la variante del ángulo y UTMs propios. */
export function adUrl(conv: string, variant: string, utmCampaign: string, utmContent: string): string {
  const u = new URL(conv);
  u.searchParams.set('v', variant);
  u.searchParams.set('utm_source', 'meta');
  u.searchParams.set('utm_medium', 'paid_social');
  u.searchParams.set('utm_campaign', utmCampaign);
  u.searchParams.set('utm_content', utmContent);
  return u.toString();
}

export async function prepareCampaign(input: {
  product: string;
  creativeIds: string[];
  dailyBudget: number;
  objective?: Objective;
  name?: string;
  actor: Actor;
  /** Segmentación: por defecto, Argentina, 25-65, Advantage+ audiencia. */
  targeting?: Record<string, unknown>;
}): Promise<CampaignRow> {
  await require({ action: 'campaign.prepare', actor: input.actor, product: input.product });
  const p = getProduct(input.product);
  if (!p.marketable || p.status !== 'active') throw new SmfError(`${p.name} no está habilitado para anunciar.`, 'not_marketable');
  if (!input.creativeIds.length) throw new SmfError('Una campaña necesita al menos un creativo.', 'no_creatives');
  if (!(input.dailyBudget > 0)) throw new SmfError('El presupuesto diario tiene que ser mayor a cero.', 'bad_budget');

  const blockers: string[] = [];
  const notes: string[] = [];
  const creatives: Creative[] = [];
  for (const id of input.creativeIds) {
    const c = await getCreative(id);
    if (c.product_id !== p.id) throw new SmfError(`El creativo ${id} es de ${c.product_id}, no de ${p.id}.`, 'bad_creative');
    if (c.status !== 'ready') blockers.push(`el creativo ${id} no está listo (${c.status})`);
    const concept = await getConcept(c.concept_id);
    if (concept.status === 'stale') blockers.push(`el creativo ${id} usa un concepto viejo (el producto cambió)`);
    creatives.push(c);
  }

  const check = await lastLandingCheck(p.id);
  const fresca = check && Date.now() - new Date(check.checked_at).getTime() < 24 * 3600_000;
  if (!check || !fresca) blockers.push('la página /conv no tiene una verificación de las últimas 24 h (correr conv.verify)');
  else if (!check.ok) blockers.push('la página /conv no pasó la última verificación');

  const pixelId = config.pixelFor(p.id).pixelId;
  const policy = await getPolicy();
  let objective: Objective = input.objective ?? 'leads';
  if (objective === 'leads') {
    if (!pixelId) {
      blockers.push(`no hay píxel configurado para ${p.id} (META_PIXEL_ID_${p.id.toUpperCase()}): no se puede optimizar por consultas`);
    } else if (check?.pixel !== 'present') {
      if (policy.require_pixel_for_conversion_campaigns) blockers.push('la página /conv no carga el píxel: Meta no vería las consultas');
      else notes.push('ATENCIÓN: /conv sin píxel verificado; la política permite seguir.');
    }
  } else {
    notes.push('Objetivo tráfico: optimiza por clics, no por consultas. Útil sólo mientras no haya píxel.');
  }

  const fecha = todayAR();
  const utmCampaign = `${p.id}-${objective}-${fecha}`;
  const id = newId('cmp');
  const ads = await Promise.all(
    creatives.map(async (c) => {
      const concept = await getConcept(c.concept_id);
      const angle = p.angles.find((a) => a.id === concept.angle);
      const adId = newId('ad');
      const utmContent = `${slug(concept.angle)}-${c.format}-${adId.slice(-6)}`;
      return { adId, creativeId: c.id, conceptId: c.concept_id, format: c.format, url: adUrl(p.urls.conv, angle?.conv_variant ?? 'base', utmCampaign, utmContent), utm_content: utmContent };
    })
  );

  const plan: CampaignPlan = {
    objective,
    meta_objective: objective === 'leads' ? 'OUTCOME_LEADS' : 'OUTCOME_TRAFFIC',
    optimization_goal: objective === 'leads' ? 'OFFSITE_CONVERSIONS' : 'LINK_CLICKS',
    ...(objective === 'leads' && pixelId ? { promoted_object: { pixel_id: pixelId, custom_event_type: 'LEAD' as const } } : {}),
    targeting: input.targeting ?? {
      geo_locations: { countries: [p.country] },
      age_min: 25,
      age_max: 65,
      // v26 exige el valor explícito en algunos casos; se manda siempre.
      targeting_automation: { advantage_audience: 1 },
    },
    utm_campaign: utmCampaign,
    ads,
    notes,
  };

  const d = await db();
  const dry = (await getMode()) !== 'live';
  const name = input.name ?? `SMF · ${p.name} · ${objective === 'leads' ? 'Consultas' : 'Tráfico'} · ${fecha}`;
  await d.tx(async (t) => {
    await t.query(
      `INSERT INTO smf.campaigns (id, product_id, name, objective, status, daily_budget_ars, destination_url, plan, dry_run, blockers)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8::jsonb,$9,$10::jsonb)`,
      [id, p.id, name, plan.meta_objective, blockers.length ? 'blocked' : 'prepared', input.dailyBudget, p.urls.conv, j(plan), dry, j(blockers)]
    );
    for (const a of ads) {
      await t.query(`INSERT INTO smf.ads (id, campaign_id, creative_id, concept_id, utm_content, url) VALUES ($1,$2,$3,$4,$5,$6)`, [a.adId, id, a.creativeId, a.conceptId, a.utm_content, a.url]);
    }
  });
  await audit({ actor: input.actor, action: 'campaign.prepare', decision: blockers.length ? 'failed' : 'done', target: id, details: { product: p.id, blockers, budget: input.dailyBudget } });
  return getCampaign(id);
}

/** Sube creativos y crea todo en Meta en pausa. */
export async function pushCampaign(id: string, actor: Actor): Promise<CampaignRow> {
  const c = await getCampaign(id);
  if (c.blockers.length) throw new SmfError(`La campaña tiene bloqueos: ${c.blockers.join('; ')}`, 'blocked');
  if (!['prepared', 'in_meta_paused'].includes(c.status)) throw new SmfError(`No se puede subir una campaña en estado ${c.status}.`, 'bad_state');
  const mode = await getMode();
  if (!c.dry_run && mode !== 'live') throw new SmfError('Esta campaña se preparó en modo real y la Factory está en modo de prueba.', 'mode_mismatch');
  if (c.dry_run && mode === 'live') throw new SmfError('Esta campaña se preparó en modo de prueba. Preparala de nuevo en modo real.', 'mode_mismatch');

  const p = getProduct(c.product_id);
  const dec = await guard({ action: 'meta.objects.create', actor, product: p.id, target: id, requestIfMissing: { summary: `Crear en Meta (en pausa) la campaña «${c.name}»` } });
  if (!dec.allowed) throw new SmfError(dec.reason, dec.approvalId ? 'needs_approval' : 'denied', { approvalId: dec.approvalId });
  const up = await guard({ action: 'meta.media.upload', actor, product: p.id, target: id });
  if (!up.allowed) throw new SmfError(up.reason, 'denied');
  if (!config.meta.pageId && !dec.dryRun) throw new SmfError('Falta META_PAGE_ID: los anuncios necesitan una página.', 'meta_not_configured');

  const d = await db();
  const plan = c.plan;
  let campaignId = c.meta_campaign_id;
  if (!campaignId) {
    const r = await graph<{ id: string }>('POST', `${act()}/campaigns`, {
      name: c.name,
      objective: plan.meta_objective,
      status: 'PAUSED',
      special_ad_categories: [],
      buying_type: 'AUCTION',
      // El presupuesto va en el conjunto: se declara explícito que no se comparte.
      is_adset_budget_sharing_enabled: false,
    }, { decision: dec, dryKind: 'campaign' });
    campaignId = r.id;
    await d.query(`UPDATE smf.campaigns SET meta_campaign_id = $2, updated_at = now() WHERE id = $1`, [id, campaignId]);
  }
  let adsetId = c.meta_adset_id;
  if (!adsetId) {
    const r = await graph<{ id: string }>('POST', `${act()}/adsets`, {
      name: `${c.name} · conjunto`,
      campaign_id: campaignId,
      status: 'PAUSED',
      // Meta cuenta en la unidad mínima de la moneda de la cuenta (centavos).
      daily_budget: Math.round(Number(c.daily_budget_ars) * 100),
      billing_event: 'IMPRESSIONS',
      optimization_goal: plan.optimization_goal,
      bid_strategy: 'LOWEST_COST_WITHOUT_CAP',
      destination_type: 'WEBSITE',
      ...(plan.promoted_object ? { promoted_object: plan.promoted_object } : {}),
      targeting: plan.targeting,
    }, { decision: dec, dryKind: 'adset' });
    adsetId = r.id;
    await d.query(`UPDATE smf.campaigns SET meta_adset_id = $2, updated_at = now() WHERE id = $1`, [id, adsetId]);
  }

  const ads = await d.query<{ id: string; creative_id: string; concept_id: string; url: string; meta_ad_id: string | null; meta_creative_id: string | null }>('SELECT * FROM smf.ads WHERE campaign_id = $1', [id]);
  for (const ad of ads) {
    if (ad.meta_ad_id) continue;
    const cr = await getCreative(ad.creative_id);
    const concept = await getConcept(ad.concept_id);
    let videoId = cr.meta_video_id;
    if (!videoId || (isSimulatedId(videoId) !== dec.dryRun)) {
      const v = await graph<{ id: string }>('POST', `${act()}/advideos`, { name: `${cr.id}.mp4` }, { decision: up, file: cr.path!, video: true, dryKind: 'video' });
      videoId = v.id;
      await d.query('UPDATE smf.creatives SET meta_video_id = $2, updated_at = now() WHERE id = $1', [cr.id, videoId]);
      if (!dec.dryRun) await waitVideoReady(videoId);
    }
    let thumbHash: string | undefined;
    if (cr.poster_path) {
      const img = await graph<{ images: Record<string, { hash: string }> }>('POST', `${act()}/adimages`, {}, { decision: up, file: cr.poster_path, dryKind: 'img' });
      thumbHash = Object.values(img.images ?? {})[0]?.hash;
    }
    const creative = await graph<{ id: string }>('POST', `${act()}/adcreatives`, {
      name: `${concept.headline.slice(0, 60)} · ${cr.format}`,
      object_story_spec: {
        page_id: config.meta.pageId || 'dry_page',
        ...(config.meta.instagramUserId ? { instagram_user_id: config.meta.instagramUserId } : {}),
        video_data: {
          video_id: videoId,
          ...(thumbHash ? { image_hash: thumbHash } : {}),
          title: concept.headline.slice(0, 255),
          message: concept.primary_text,
          call_to_action: { type: p.cta.meta_cta_type, value: { link: ad.url } },
        },
      },
      // No se toman las mejoras automáticas que cambian el texto o el video.
      degrees_of_freedom_spec: { creative_features_spec: { standard_enhancements: { enroll_status: 'OPT_OUT' } } },
    }, { decision: dec, dryKind: 'creative' });
    const metaAd = await graph<{ id: string }>('POST', `${act()}/ads`, {
      name: `${concept.angle} · ${cr.format} · ${ad.id}`,
      adset_id: adsetId,
      creative: { creative_id: creative.id },
      status: 'PAUSED',
    }, { decision: dec, dryKind: 'ad' });
    await d.query(`UPDATE smf.ads SET meta_ad_id = $2, meta_creative_id = $3, status = 'paused', updated_at = now() WHERE id = $1`, [ad.id, metaAd.id, creative.id]);
  }

  // Verificación: leer de vuelta lo creado. Sólo con ids reales.
  const verificado = dec.dryRun ? { simulated: true } : await readBack(campaignId!, adsetId!);
  await d.query(`UPDATE smf.campaigns SET status = 'in_meta_paused', meta_status = $2::jsonb, updated_at = now() WHERE id = $1`, [id, j(verificado)]);
  await audit({ actor, action: 'meta.objects.create', decision: dec.dryRun ? 'dry_run' : 'done', target: id, details: { campaignId, adsetId } });
  return getCampaign(id);
}

async function waitVideoReady(videoId: string): Promise<void> {
  for (let i = 0; i < 60; i++) {
    const v = await graph<{ status?: { video_status?: string; processing_phase?: { status?: string } } }>('GET', videoId, { fields: 'status' });
    const s = v.status?.video_status;
    if (s === 'ready') return;
    if (s === 'error') throw new SmfError(`Meta no pudo procesar el video ${videoId}.`, 'video_error');
    await sleep(5000);
  }
  throw new SmfError(`El video ${videoId} sigue procesándose después de 5 minutos.`, 'video_timeout');
}

async function readBack(campaignId: string, adsetId: string) {
  const camp = await graph('GET', campaignId, { fields: 'id,name,status,effective_status,objective' });
  const adset = await graph('GET', adsetId, { fields: 'id,status,effective_status,daily_budget,optimization_goal' });
  const ads = await graph<{ data: Record<string, unknown>[] }>('GET', `${adsetId}/ads`, { fields: 'id,name,status,effective_status,ad_review_feedback,issues_info' });
  return { campaign: camp, adset, ads: ads.data, read_at: new Date().toISOString() };
}

/** Activa una campaña ya creada en Meta. No la declara activa hasta que Meta lo confirma. */
export async function launchCampaign(id: string, actor: Actor): Promise<CampaignRow> {
  const c = await getCampaign(id);
  if (c.status !== 'in_meta_paused' && c.status !== 'paused') throw new SmfError(`Para lanzar, la campaña tiene que estar creada en Meta y en pausa (está ${c.status}).`, 'bad_state');
  const dec = await guard({
    action: 'meta.launch',
    actor,
    product: c.product_id,
    target: id,
    newDailyBudget: Number(c.daily_budget_ars),
    requestIfMissing: { summary: `Lanzar «${c.name}» con $${Number(c.daily_budget_ars).toLocaleString('es-AR')} por día`, scope: { daily: Number(c.daily_budget_ars) } },
  });
  if (!dec.allowed) throw new SmfError(dec.reason, dec.approvalId ? 'needs_approval' : 'denied', { approvalId: dec.approvalId });
  if (isSimulatedId(c.meta_campaign_id) !== dec.dryRun) throw new SmfError('La campaña y el modo actual no coinciden (simulada vs. real).', 'mode_mismatch');

  const d = await db();
  const ads = await d.query<{ meta_ad_id: string }>('SELECT meta_ad_id FROM smf.ads WHERE campaign_id = $1 AND meta_ad_id IS NOT NULL', [id]);
  for (const a of ads) await graph('POST', a.meta_ad_id, { status: 'ACTIVE' }, { decision: dec });
  await graph('POST', c.meta_adset_id!, { status: 'ACTIVE' }, { decision: dec });
  await graph('POST', c.meta_campaign_id!, { status: 'ACTIVE' }, { decision: dec });

  if (dec.dryRun) {
    await d.query(`UPDATE smf.campaigns SET status = 'active', meta_status = $2::jsonb, updated_at = now() WHERE id = $1`, [id, j({ simulated: true, note: 'Simulada: no se publicó nada en Meta.' })]);
    await d.query(`UPDATE smf.ads SET status = 'active', effective_status = 'SIMULATED' WHERE campaign_id = $1`, [id]);
  } else {
    await refreshCampaign(id);
  }
  await audit({ actor, action: 'meta.launch', decision: dec.dryRun ? 'dry_run' : 'done', target: id });
  return getCampaign(id);
}

/** Lee el estado real en Meta y lo refleja. Avisa si algo fue rechazado. */
export async function refreshCampaign(id: string): Promise<CampaignRow> {
  const c = await getCampaign(id);
  if (!c.meta_campaign_id || isSimulatedId(c.meta_campaign_id)) return c;
  const d = await db();
  const back = await readBack(c.meta_campaign_id, c.meta_adset_id!);
  const efectivos = (back.ads as { id: string; effective_status: string; ad_review_feedback?: unknown }[]) ?? [];
  for (const a of efectivos) {
    await d.query(`UPDATE smf.ads SET effective_status = $2, review = $3::jsonb, status = $4, updated_at = now() WHERE meta_ad_id = $1`, [
      a.id, a.effective_status, j(a.ad_review_feedback ?? {}), a.effective_status === 'ACTIVE' ? 'active' : a.effective_status === 'DISAPPROVED' ? 'rejected' : a.effective_status === 'PAUSED' ? 'paused' : 'pending_review',
    ]);
    if (a.effective_status === 'DISAPPROVED') {
      await notify({ kind: 'campaign_rejected', severity: 'critical', title: `Meta rechazó un anuncio de ${c.product_id}`, body: `Anuncio ${a.id} en «${c.name}».\nMotivo: ${JSON.stringify(a.ad_review_feedback ?? {})}`, dedupKey: `rejected:${a.id}` });
    }
  }
  const camp = back.campaign as { effective_status?: string };
  const algunoActivo = efectivos.some((a) => a.effective_status === 'ACTIVE');
  const status: CampaignRow['status'] =
    camp.effective_status === 'ACTIVE' && algunoActivo ? 'active'
    : camp.effective_status === 'PAUSED' ? (c.status === 'in_meta_paused' ? 'in_meta_paused' : 'paused')
    : efectivos.length && efectivos.every((a) => a.effective_status === 'DISAPPROVED') ? 'rejected'
    : camp.effective_status === 'ACTIVE' ? 'pending_review' : c.status;
  await d.query(`UPDATE smf.campaigns SET status = $2, meta_status = $3::jsonb, updated_at = now() WHERE id = $1`, [id, status, j(back)]);
  return getCampaign(id);
}

export async function pauseCampaign(id: string, actor: Actor, reason = 'pedido de pausa'): Promise<CampaignRow> {
  const c = await getCampaign(id);
  const dec = await guard({ action: 'meta.pause', actor, product: c.product_id, target: id, details: { reason } });
  const d = await db();
  if (c.meta_campaign_id) {
    // Pausar una campaña real se hace de verdad aunque la Factory esté en modo
    // de prueba: frenar gasto nunca se simula.
    await graph('POST', c.meta_campaign_id, { status: 'PAUSED' }, { decision: { ...dec, dryRun: isSimulatedId(c.meta_campaign_id) } });
  }
  await d.query(`UPDATE smf.campaigns SET status = CASE WHEN status IN ('prepared','blocked','draft') THEN status ELSE 'paused' END, updated_at = now() WHERE id = $1`, [id]);
  await audit({ actor, action: 'meta.pause', decision: 'done', target: id, details: { reason } });
  return getCampaign(id);
}

/** Pausa todo lo que esté corriendo. Es lo que hace la pausa general. */
export async function pauseAll(actor: Actor, reason: string): Promise<{ paused: string[]; errors: string[] }> {
  const d = await db();
  const rows = await d.query<{ id: string }>(`SELECT id FROM smf.campaigns WHERE status IN ('active','pending_review','in_meta_paused')`);
  const paused: string[] = [];
  const errors: string[] = [];
  for (const r of rows) {
    try {
      await pauseCampaign(r.id, actor, reason);
      paused.push(r.id);
    } catch (e) {
      errors.push(`${r.id}: ${e instanceof Error ? e.message : e}`);
    }
  }
  if (errors.length) await notify({ kind: 'integration_error', severity: 'critical', title: 'No se pudieron pausar todas las campañas', body: errors.join('\n'), dedupKey: `pauseall:${Date.now()}` });
  return { paused, errors };
}

export async function setDailyBudget(id: string, newDaily: number, actor: Actor): Promise<CampaignRow> {
  const c = await getCampaign(id);
  const old = Number(c.daily_budget_ars);
  const dec = await guard({ action: 'meta.budget.change', actor, product: c.product_id, target: id, newDailyBudget: newDaily, oldDailyBudget: old, requestIfMissing: { summary: `Cambiar el presupuesto de «${c.name}» de $${old} a $${newDaily} por día`, scope: { daily: newDaily } } });
  if (!dec.allowed) throw new SmfError(dec.reason, dec.approvalId ? 'needs_approval' : 'denied', { approvalId: dec.approvalId });
  if (c.meta_adset_id) await graph('POST', c.meta_adset_id, { daily_budget: Math.round(newDaily * 100) }, { decision: dec });
  const d = await db();
  await d.query('UPDATE smf.campaigns SET daily_budget_ars = $2, updated_at = now() WHERE id = $1', [id, newDaily]);
  return getCampaign(id);
}

export async function pauseAd(adId: string, actor: Actor, reason: string, action: 'meta.pause' | 'meta.ad.pause_underperformer' = 'meta.pause'): Promise<void> {
  const d = await db();
  const [ad] = await d.query<{ id: string; meta_ad_id: string | null; campaign_id: string }>('SELECT id, meta_ad_id, campaign_id FROM smf.ads WHERE id = $1', [adId]);
  if (!ad) throw new SmfError(`No existe el anuncio ${adId}.`, 'not_found');
  const dec = await guard({ action, actor, target: adId, details: { reason } });
  if (!dec.allowed) throw new SmfError(dec.reason, dec.approvalId ? 'needs_approval' : 'denied', { approvalId: dec.approvalId });
  if (ad.meta_ad_id) await graph('POST', ad.meta_ad_id, { status: 'PAUSED' }, { decision: { ...dec, dryRun: isSimulatedId(ad.meta_ad_id) } });
  await d.query(`UPDATE smf.ads SET status = 'paused', updated_at = now() WHERE id = $1`, [adId]);
  await audit({ actor, action, decision: 'done', target: adId, details: { reason } });
}

export async function getCampaign(id: string): Promise<CampaignRow> {
  const d = await db();
  const [c] = await d.query<CampaignRow>('SELECT * FROM smf.campaigns WHERE id = $1', [id]);
  if (!c) throw new SmfError(`No existe la campaña ${id}.`, 'not_found');
  return c;
}

export async function listCampaigns(filter: { product?: string; status?: string } = {}): Promise<CampaignRow[]> {
  const d = await db();
  const where: string[] = [];
  const params: unknown[] = [];
  if (filter.product) (params.push(filter.product), where.push(`product_id = $${params.length}`));
  if (filter.status) (params.push(filter.status), where.push(`status = $${params.length}`));
  return d.query<CampaignRow>(`SELECT * FROM smf.campaigns ${where.length ? `WHERE ${where.join(' AND ')}` : ''} ORDER BY created_at DESC LIMIT 100`, params);
}

/** Verificación de la cuenta publicitaria: lectura real, nunca simulada. */
export async function verifyAccount(): Promise<{ ok: boolean; checks: { name: string; ok: boolean; detail: string }[] }> {
  const checks: { name: string; ok: boolean; detail: string }[] = [];
  const add = (name: string, ok: boolean, detail: string) => checks.push({ name, ok, detail });
  if (!config.meta.accessToken) {
    add('token', false, 'falta META_ACCESS_TOKEN');
    return { ok: false, checks };
  }
  try {
    const me = await graph<{ id: string; name: string }>('GET', 'me', { fields: 'id,name' });
    add('token válido', true, `${me.name} (${me.id})`);
  } catch (e) {
    add('token válido', false, e instanceof Error ? e.message : String(e));
    return { ok: false, checks };
  }
  try {
    const perms = await graph<{ data: { permission: string; status: string }[] }>('GET', 'me/permissions');
    const dados = new Set(perms.data.filter((p) => p.status === 'granted').map((p) => p.permission));
    for (const need of ['ads_management', 'ads_read', 'business_management', 'pages_read_engagement', 'pages_manage_posts', 'instagram_basic', 'instagram_content_publish']) {
      add(`permiso ${need}`, dados.has(need), dados.has(need) ? 'otorgado' : 'falta');
    }
  } catch (e) {
    add('permisos', false, e instanceof Error ? e.message : String(e));
  }
  if (config.meta.adAccountId) {
    try {
      const a = await graph<{ name: string; account_status: number; currency: string; timezone_name: string; disable_reason?: number; amount_spent?: string; spend_cap?: string }>('GET', act(), { fields: 'name,account_status,currency,timezone_name,disable_reason,amount_spent,spend_cap' });
      add('cuenta publicitaria activa', a.account_status === 1, `${a.name}: estado ${a.account_status}${a.disable_reason ? `, motivo ${a.disable_reason}` : ''}`);
      add('moneda ARS', a.currency === 'ARS', `moneda ${a.currency} (los presupuestos se cargan en ${a.currency})`);
      add('zona horaria', true, a.timezone_name);
    } catch (e) {
      add('cuenta publicitaria', false, e instanceof Error ? e.message : String(e));
    }
  } else add('cuenta publicitaria', false, 'falta META_AD_ACCOUNT_ID');
  if (config.meta.pageId) {
    try {
      const pg = await graph<{ name: string }>('GET', config.meta.pageId, { fields: 'name' });
      add('página de Facebook', true, pg.name);
    } catch (e) {
      add('página de Facebook', false, e instanceof Error ? e.message : String(e));
    }
  } else add('página de Facebook', false, 'falta META_PAGE_ID');
  if (config.meta.instagramUserId) {
    try {
      const ig = await graph<{ username: string }>('GET', config.meta.instagramUserId, { fields: 'username' });
      add('cuenta de Instagram', true, `@${ig.username}`);
    } catch (e) {
      add('cuenta de Instagram', false, e instanceof Error ? e.message : String(e));
    }
  } else add('cuenta de Instagram', false, 'falta META_IG_USER_ID');
  return { ok: checks.every((c) => c.ok), checks };
}
