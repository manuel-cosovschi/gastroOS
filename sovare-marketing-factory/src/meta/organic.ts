/**
 * Organic Publishing Engine: Instagram y Facebook por las APIs oficiales.
 *
 *   Instagram (Content Publishing API):
 *     POST /{ig-user}/media  (REELS con video_url | IMAGE con image_url | CAROUSEL)
 *     GET  /{container}?fields=status_code     hasta FINISHED
 *     POST /{ig-user}/media_publish  creation_id
 *     GET  /{media}?fields=permalink
 *     Antes de publicar se mira /content_publishing_limit (tope de 24 h).
 *   Facebook (Páginas):
 *     POST /{page}/videos (file_url, description) o /{page}/photos (url, caption)
 *
 * Programar es nivel 2 sin efectos (queda en el calendario); publicar es nivel
 * 2 con el canal activado y el piloto automático `publish_organic`, o con la
 * aprobación del dueño para esa publicación. Nada de automatizar interacción
 * (likes, comentarios, seguidores): sólo publicar lo propio.
 */

import { config } from '../config.ts';
import { db } from '../db/index.ts';
import { audit, type Actor } from '../core/audit.ts';
import { guard, require } from '../core/policy.ts';
import { newId, sleep, SmfError } from '../core/util.ts';
import { getConcept } from '../creative/concepts.ts';
import { getCreative } from '../creative/index.ts';
import { getProduct } from '../catalog/index.ts';
import { notify } from '../notify/index.ts';
import { graph, isSimulatedId } from './graph.ts';
import { publicUrlFor } from './storage.ts';

export type Channel = 'instagram' | 'facebook';
export type Kind = 'reel' | 'image' | 'carousel' | 'video';

export interface OrganicPost {
  id: string;
  product_id: string;
  creative_id: string | null;
  channel: Channel;
  kind: Kind;
  caption: string;
  media_urls: string[];
  scheduled_at: string;
  status: 'scheduled' | 'publishing' | 'published' | 'failed' | 'cancelled' | 'needs_approval';
  container_id: string | null;
  remote_id: string | null;
  permalink: string | null;
  attempts: number;
  last_error: string | null;
}

/** Texto orgánico desde el concepto: sin link clickeable en IG, se nombra la dirección. */
export async function captionFor(creativeId: string): Promise<string> {
  const cr = await getCreative(creativeId);
  const c = await getConcept(cr.concept_id);
  const p = getProduct(cr.product_id);
  const host = new URL(p.urls.conv).host;
  const tags = { gastroos: '#pastelería #viandas #catering #emprendimiento', alojaos: '#cabañas #complejos #turismo #reservas' }[p.id] ?? '';
  return [c.headline, '', c.primary_text.split('\n\n')[0], '', ...(c.meta?.bullets ?? []).map((b) => `✓ ${b}`), '', `Más en ${host}`, tags].join('\n').replace(/\n{3,}/g, '\n\n').trim();
}

export async function schedulePost(input: { product: string; creativeIds: string[]; channel: Channel; kind?: Kind; caption?: string; at: string; actor: Actor }): Promise<OrganicPost> {
  await require({ action: 'organic.schedule', actor: input.actor, product: input.product });
  const at = new Date(input.at);
  if (Number.isNaN(at.getTime())) throw new SmfError(`Fecha inválida: ${input.at}`, 'bad_date');
  if (!input.creativeIds.length) throw new SmfError('Hace falta al menos un creativo.', 'no_creatives');
  for (const id of input.creativeIds) {
    const c = await getCreative(id);
    if (c.status !== 'ready') throw new SmfError(`El creativo ${id} no está listo (${c.status}).`, 'not_ready');
    if (c.product_id !== input.product) throw new SmfError(`El creativo ${id} no es de ${input.product}.`, 'bad_creative');
  }
  const kind: Kind = input.kind ?? (input.creativeIds.length > 1 ? 'carousel' : input.channel === 'instagram' ? 'reel' : 'video');
  if (kind === 'carousel' && input.channel !== 'instagram') throw new SmfError('Los carruseles se publican sólo en Instagram desde la Factory.', 'unsupported');
  const caption = input.caption ?? (await captionFor(input.creativeIds[0]));
  if (caption.length > 2200) throw new SmfError('Instagram admite hasta 2.200 caracteres.', 'caption_too_long');
  const d = await db();
  const id = newId('post');
  await d.query(
    `INSERT INTO smf.organic_posts (id, product_id, creative_id, channel, kind, caption, media_urls, scheduled_at) VALUES ($1,$2,$3,$4,$5,$6,$7::jsonb,$8)`,
    [id, input.product, input.creativeIds[0], input.channel, kind, caption, JSON.stringify(input.creativeIds), at.toISOString()]
  );
  await audit({ actor: input.actor, action: 'organic.schedule', decision: 'done', target: id, details: { channel: input.channel, at: at.toISOString() } });
  return getPost(id);
}

/** Publica lo que ya venció. Lo corre el scheduler. */
export async function publishDue(actor: Actor = 'system', limit = 5): Promise<{ published: string[]; failed: string[]; waiting: string[] }> {
  const d = await db();
  const due = await d.query<OrganicPost>(`SELECT * FROM smf.organic_posts WHERE status IN ('scheduled','needs_approval') AND scheduled_at <= now() ORDER BY scheduled_at LIMIT $1`, [limit]);
  const out = { published: [] as string[], failed: [] as string[], waiting: [] as string[] };
  for (const post of due) {
    try {
      const r = await publishPost(post.id, actor);
      if (r.status === 'published') out.published.push(post.id);
      else out.waiting.push(post.id);
    } catch (e) {
      out.failed.push(post.id);
      console.error('[organic]', post.id, e instanceof Error ? e.message : e);
    }
  }
  return out;
}

export async function publishPost(id: string, actor: Actor): Promise<OrganicPost> {
  const d = await db();
  const post = await getPost(id);
  if (post.status === 'published') return post;
  const action = post.channel === 'instagram' ? 'organic.publish.instagram' : 'organic.publish.facebook';
  const dec = await guard({ action, actor, product: post.product_id, target: id, requestIfMissing: { summary: `Publicar en ${post.channel} (${post.kind}) de ${post.product_id}: «${post.caption.split('\n')[0]}»` } });
  if (!dec.allowed) {
    await d.query(`UPDATE smf.organic_posts SET status = 'needs_approval', last_error = $2, updated_at = now() WHERE id = $1`, [id, dec.reason]);
    return getPost(id);
  }
  await d.query(`UPDATE smf.organic_posts SET status = 'publishing', attempts = attempts + 1, updated_at = now() WHERE id = $1`, [id]);
  try {
    const creativeIds = post.media_urls as unknown as string[];
    const files = await Promise.all(creativeIds.map(async (cid) => getCreative(cid)));
    const urls = await Promise.all(files.map((c) => publicUrlFor(post.kind === 'image' ? c.poster_path! : c.path!, `organic/${post.product_id}/${c.id}`, dec.dryRun)));
    let remote: string;
    let permalink: string | null = null;
    if (post.channel === 'instagram') {
      if (!config.meta.instagramUserId && !dec.dryRun) throw new SmfError('Falta META_IG_USER_ID.', 'meta_not_configured');
      const ig = config.meta.instagramUserId || 'dry_ig';
      if (!dec.dryRun) {
        const lim = await graph<{ data: { quota_usage: number; config: { quota_total: number } }[] }>('GET', `${ig}/content_publishing_limit`, { fields: 'quota_usage,config' });
        const l = lim.data?.[0];
        if (l && l.quota_usage >= l.config.quota_total) throw new SmfError(`Instagram: se llegó al tope de publicaciones de 24 h (${l.quota_usage}/${l.config.quota_total}).`, 'quota');
      }
      let container: string;
      if (post.kind === 'carousel') {
        const hijos: string[] = [];
        for (const u of urls) {
          const h = await graph<{ id: string }>('POST', `${ig}/media`, { media_type: 'VIDEO', video_url: u, is_carousel_item: true }, { decision: dec, dryKind: 'igitem' });
          if (!dec.dryRun) await waitContainer(h.id);
          hijos.push(h.id);
        }
        container = (await graph<{ id: string }>('POST', `${ig}/media`, { media_type: 'CAROUSEL', children: hijos.join(','), caption: post.caption }, { decision: dec, dryKind: 'igcarousel' })).id;
      } else if (post.kind === 'image') {
        container = (await graph<{ id: string }>('POST', `${ig}/media`, { image_url: urls[0], caption: post.caption }, { decision: dec, dryKind: 'igimage' })).id;
      } else {
        container = (await graph<{ id: string }>('POST', `${ig}/media`, { media_type: 'REELS', video_url: urls[0], caption: post.caption, share_to_feed: true }, { decision: dec, dryKind: 'igreel' })).id;
      }
      await d.query('UPDATE smf.organic_posts SET container_id = $2 WHERE id = $1', [id, container]);
      if (!dec.dryRun) await waitContainer(container);
      remote = (await graph<{ id: string }>('POST', `${ig}/media_publish`, { creation_id: container }, { decision: dec, dryKind: 'igmedia' })).id;
      if (!dec.dryRun) permalink = (await graph<{ permalink?: string }>('GET', remote, { fields: 'permalink' })).permalink ?? null;
    } else {
      if (!config.meta.pageId && !dec.dryRun) throw new SmfError('Falta META_PAGE_ID.', 'meta_not_configured');
      const page = config.meta.pageId || 'dry_page';
      const tok = config.meta.pageAccessToken || undefined;
      const r = post.kind === 'image'
        ? await graph<{ id: string; post_id?: string }>('POST', `${page}/photos`, { url: urls[0], caption: post.caption }, { decision: dec, token: tok, dryKind: 'fbphoto' })
        : await graph<{ id: string }>('POST', `${page}/videos`, { file_url: urls[0], description: post.caption }, { decision: dec, token: tok, dryKind: 'fbvideo' });
      remote = (r as { post_id?: string }).post_id ?? r.id;
      if (!dec.dryRun) permalink = `https://www.facebook.com/${remote}`;
    }
    await d.query(`UPDATE smf.organic_posts SET status = 'published', remote_id = $2, permalink = $3, last_error = NULL, updated_at = now() WHERE id = $1`, [id, remote, permalink]);
    await audit({ actor, action, decision: dec.dryRun ? 'dry_run' : 'done', target: id, details: { remote, permalink, simulated: isSimulatedId(remote) } });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    const p = await getPost(id);
    const final = p.attempts >= 3;
    await d.query(`UPDATE smf.organic_posts SET status = $2, last_error = $3, updated_at = now() WHERE id = $1`, [id, final ? 'failed' : 'scheduled', msg]);
    if (final) await notify({ kind: 'integration_error', severity: 'warning', title: `No se pudo publicar en ${post.channel}`, body: `${post.product_id} · ${id}\n${msg}`, dedupKey: `organic:${id}:failed` });
    throw e;
  }
  return getPost(id);
}

async function waitContainer(id: string): Promise<void> {
  for (let i = 0; i < 60; i++) {
    const r = await graph<{ status_code?: string; status?: string }>('GET', id, { fields: 'status_code,status' });
    if (r.status_code === 'FINISHED') return;
    if (r.status_code === 'ERROR' || r.status_code === 'EXPIRED') throw new SmfError(`Instagram rechazó el contenido (${r.status_code}): ${r.status ?? ''}`, 'ig_container');
    await sleep(5000);
  }
  throw new SmfError('Instagram sigue procesando el video después de 5 minutos.', 'ig_timeout');
}

export async function cancelPost(id: string, actor: Actor): Promise<OrganicPost> {
  const d = await db();
  await d.query(`UPDATE smf.organic_posts SET status = 'cancelled', updated_at = now() WHERE id = $1 AND status IN ('scheduled','needs_approval','failed')`, [id]);
  await audit({ actor, action: 'organic.cancel', decision: 'done', target: id });
  return getPost(id);
}

export async function getPost(id: string): Promise<OrganicPost> {
  const d = await db();
  const [p] = await d.query<OrganicPost>('SELECT * FROM smf.organic_posts WHERE id = $1', [id]);
  if (!p) throw new SmfError(`No existe la publicación ${id}.`, 'not_found');
  return p;
}

export async function calendar(from?: string, to?: string): Promise<OrganicPost[]> {
  const d = await db();
  return d.query<OrganicPost>(
    `SELECT * FROM smf.organic_posts WHERE scheduled_at >= COALESCE($1::timestamptz, now() - interval '7 days') AND scheduled_at <= COALESCE($2::timestamptz, now() + interval '60 days') ORDER BY scheduled_at`,
    [from ?? null, to ?? null]
  );
}
