/**
 * Conversion & Attribution Engine.
 *
 * Los eventos de negocio llegan de dos maneras:
 *   - EMPUJADOS por los productos a `POST /api/events`, firmados con HMAC
 *     (`x-smf-signature: sha256=<hex>` sobre `<timestamp>.<cuerpo>`).
 *   - TRAÍDOS por la Factory de las bases de los productos (sources.ts), con
 *     un usuario de sólo lectura.
 *
 * En los dos casos:
 *   - `event_id` deduplica: el mismo evento dos veces cuenta una.
 *   - Se descartan los datos personales: nombre, mail, teléfono, DNI no se
 *     guardan aunque vengan.
 *   - La atribución sale de los UTM que guardó la página (`conv_atrib`):
 *     `utm_campaign` → campaña, `utm_content` → anuncio.
 *   - Compras y consultas avisan al dueño. La compra además va a Meta por CAPI.
 */

import { config } from '../config.ts';
import { db, j } from '../db/index.ts';
import { audit } from '../core/audit.ts';
import { hmac, newId, safeEqual, SmfError } from '../core/util.ts';
import { loadCatalog } from '../catalog/index.ts';
import { notify } from '../notify/index.ts';
import { sendCapi } from '../meta/capi.ts';

export type EventType = 'lead' | 'qualified_lead' | 'checkout' | 'purchase' | 'contact' | 'customer' | 'disqualified';

export interface IncomingEvent {
  product: string;
  type: EventType;
  event_id: string;
  occurred_at?: string;
  value?: number;
  currency?: string;
  plan?: string;
  quality?: string;
  attribution?: Record<string, string | undefined>;
  fbp?: string;
  fbc?: string;
  client_user_agent?: string;
  url?: string;
}

const TIPOS = new Set<EventType>(['lead', 'qualified_lead', 'checkout', 'purchase', 'contact', 'customer', 'disqualified']);
const PII = /^(email|mail|e_mail|phone|telefono|tel[eé]fono|whatsapp|name|nombre|apellido|first_name|last_name|dni|cuit|address|direccion|ip)$/i;
const ATRIB_KEYS = ['utm_source', 'utm_medium', 'utm_campaign', 'utm_content', 'utm_term', 'fbclid', 'gclid', 'variante', 'landing'];

/** Verifica la firma de un evento empujado. Devuelve el cuerpo parseado. */
export function verifySignature(rawBody: string, headers: { signature?: string; timestamp?: string }, secret = config.ingestSecret): unknown {
  if (!secret) throw new SmfError('La Factory no tiene SMF_INGEST_SECRET: no acepta eventos empujados.', 'ingest_disabled');
  const ts = Number(headers.timestamp);
  if (!ts || Math.abs(Date.now() / 1000 - ts) > 300) throw new SmfError('Timestamp ausente o fuera de los 5 minutos.', 'bad_timestamp');
  const esperado = `sha256=${hmac(secret, `${ts}.${rawBody}`)}`;
  if (!headers.signature || !safeEqual(headers.signature, esperado)) throw new SmfError('Firma inválida.', 'bad_signature');
  return JSON.parse(rawBody);
}

/** Para los productos: cómo firmar (también lo usa la prueba). */
export function signBody(rawBody: string, secret: string, ts = Math.floor(Date.now() / 1000)) {
  return { 'x-smf-timestamp': String(ts), 'x-smf-signature': `sha256=${hmac(secret, `${ts}.${rawBody}`)}` };
}

export function sanitize(input: unknown): IncomingEvent {
  if (!input || typeof input !== 'object') throw new SmfError('Evento vacío.', 'bad_event');
  const e = input as Record<string, unknown>;
  const productos = new Set(loadCatalog().map((p) => p.id));
  const product = String(e.product ?? '');
  if (!productos.has(product)) throw new SmfError(`Producto desconocido: ${product}`, 'bad_event');
  const type = String(e.type ?? '') as EventType;
  if (!TIPOS.has(type)) throw new SmfError(`Tipo desconocido: ${type}`, 'bad_event');
  const event_id = String(e.event_id ?? '').slice(0, 200);
  if (event_id.length < 6) throw new SmfError('Falta event_id (o es demasiado corto).', 'bad_event');
  const atrib: Record<string, string> = {};
  const crudo = (e.attribution ?? {}) as Record<string, unknown>;
  for (const k of ATRIB_KEYS) if (typeof crudo[k] === 'string') atrib[k] = (crudo[k] as string).slice(0, 200);
  const descartados = Object.keys(e).filter((k) => PII.test(k));
  const value = e.value === undefined || e.value === null ? undefined : Number(e.value);
  if (value !== undefined && (!Number.isFinite(value) || value < 0 || value > 1e9)) throw new SmfError('Valor inválido.', 'bad_event');
  if (descartados.length) console.warn(`[events] se descartaron datos personales: ${descartados.join(', ')}`);
  return {
    product,
    type,
    event_id,
    occurred_at: typeof e.occurred_at === 'string' && !Number.isNaN(Date.parse(e.occurred_at)) ? new Date(e.occurred_at).toISOString() : new Date().toISOString(),
    value,
    currency: typeof e.currency === 'string' ? e.currency.slice(0, 3).toUpperCase() : undefined,
    plan: typeof e.plan === 'string' ? e.plan.slice(0, 40) : undefined,
    quality: typeof e.quality === 'string' ? e.quality.slice(0, 30) : undefined,
    attribution: atrib,
    fbp: typeof e.fbp === 'string' ? e.fbp.slice(0, 200) : undefined,
    fbc: typeof e.fbc === 'string' ? e.fbc.slice(0, 300) : undefined,
    client_user_agent: typeof e.client_user_agent === 'string' ? e.client_user_agent.slice(0, 400) : undefined,
    url: typeof e.url === 'string' ? e.url.slice(0, 500) : undefined,
  };
}

/** Atribución: de los UTM a la campaña y el anuncio de la Factory. */
async function attribute(e: IncomingEvent): Promise<{ campaign_id: string | null; ad_id: string | null }> {
  const a = e.attribution ?? {};
  if (!a.utm_campaign && !a.utm_content) return { campaign_id: null, ad_id: null };
  const d = await db();
  const [ad] = a.utm_content ? await d.query<{ id: string; campaign_id: string }>('SELECT id, campaign_id FROM smf.ads WHERE utm_content = $1', [a.utm_content]) : [];
  if (ad) return { campaign_id: ad.campaign_id, ad_id: ad.id };
  const [c] = a.utm_campaign ? await d.query<{ id: string }>(`SELECT id FROM smf.campaigns WHERE plan->>'utm_campaign' = $1 ORDER BY created_at DESC LIMIT 1`, [a.utm_campaign]) : [];
  return { campaign_id: c?.id ?? null, ad_id: null };
}

export async function recordEvent(e: IncomingEvent, source: 'push' | 'pull' | 'manual'): Promise<{ stored: boolean; duplicate: boolean; id?: string; campaign_id?: string | null }> {
  const d = await db();
  const { campaign_id, ad_id } = await attribute(e);
  const id = newId('evt');
  const rows = await d.query<{ id: string }>(
    `INSERT INTO smf.events (id, event_id, product_id, type, occurred_at, value, currency, plan, quality, attribution, campaign_id, ad_id, source)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10::jsonb,$11,$12,$13) ON CONFLICT (event_id) DO NOTHING RETURNING id`,
    [id, e.event_id, e.product, e.type, e.occurred_at, e.value ?? null, e.currency ?? null, e.plan ?? null, e.quality ?? null, j(e.attribution ?? {}), campaign_id, ad_id, source]
  );
  if (!rows.length) return { stored: false, duplicate: true };
  await audit({ actor: source === 'manual' ? 'owner' : 'system', action: 'events.ingest', decision: 'done', target: id, details: { product: e.product, type: e.type, campaign_id, ad_id } });

  const p = loadCatalog().find((x) => x.id === e.product)!;
  const origen = campaign_id ? `campaña ${campaign_id}${ad_id ? ` · anuncio ${ad_id}` : ''}` : e.attribution?.utm_source ? `${e.attribution.utm_source} / ${e.attribution.utm_campaign ?? '-'}` : 'sin atribución (directo u orgánico)';
  if (e.type === 'purchase' || e.type === 'customer') {
    await notify({
      kind: 'purchase',
      severity: 'sale',
      title: `💰 ${e.type === 'purchase' ? 'Compra' : 'Cliente nuevo'} en ${p.name}${e.value ? `: $${e.value.toLocaleString('es-AR')}` : ''}`,
      body: `${e.plan ? `Plan: ${e.plan}\n` : ''}Origen: ${origen}\nEvento: ${e.event_id}`,
      dedupKey: `event:${e.event_id}`,
      data: { eventId: e.event_id, campaign_id, ad_id },
    });
    if (e.type === 'purchase' && !e.fbp && !e.fbc) {
      // Sin cookies del píxel Meta no puede atribuir la compra y descarta el
      // evento: no se manda, y queda dicho por qué.
      await d.query('UPDATE smf.events SET capi = $2::jsonb WHERE id = $1', [id, j({ sent: false, reason: 'sin fbp/fbc: Meta no podría atribuirla' })]);
    } else if (e.type === 'purchase') {
      try {
        const r = await sendCapi({ product: e.product, event_name: 'Purchase', event_id: e.event_id, event_time: Math.floor(Date.parse(e.occurred_at!) / 1000), value: e.value, currency: e.currency, fbp: e.fbp, fbc: e.fbc, client_user_agent: e.client_user_agent, url: e.url ?? p.urls.conv, custom: { plan: e.plan, producto: e.product } });
        await d.query('UPDATE smf.events SET capi = $2::jsonb WHERE id = $1', [id, j(r)]);
      } catch (err) {
        await d.query('UPDATE smf.events SET capi = $2::jsonb WHERE id = $1', [id, j({ sent: false, error: err instanceof Error ? err.message : String(err) })]);
        await notify({ kind: 'tracking_problem', severity: 'warning', title: `No se pudo mandar la compra de ${p.name} a Meta`, body: err instanceof Error ? err.message : String(err), dedupKey: `capi:${e.event_id}` });
      }
    }
  } else if (e.type === 'lead' || e.type === 'qualified_lead') {
    await notify({
      kind: e.type === 'qualified_lead' ? 'qualified_lead' : 'inquiry',
      severity: 'action',
      title: `${e.type === 'qualified_lead' ? 'Consulta calificada' : 'Consulta nueva'} en ${p.name}`,
      body: `Origen: ${origen}${e.attribution?.variante ? `\nVariante: ${e.attribution.variante}` : ''}\nLos datos de contacto están en ${p.conv.lead_store ?? 'el panel del producto'}.`,
      dedupKey: `event:${e.event_id}`,
    });
  }
  return { stored: true, duplicate: false, id, campaign_id };
}

export async function listEvents(filter: { product?: string; type?: string; days?: number } = {}) {
  const d = await db();
  const params: unknown[] = [filter.days ?? 30];
  let where = `occurred_at >= now() - ($1 || ' days')::interval`;
  if (filter.product) (params.push(filter.product), (where += ` AND product_id = $${params.length}`));
  if (filter.type) (params.push(filter.type), (where += ` AND type = $${params.length}`));
  return d.query(`SELECT id, event_id, product_id, type, occurred_at, value, currency, plan, quality, attribution, campaign_id, ad_id, source, capi FROM smf.events WHERE ${where} ORDER BY occurred_at DESC LIMIT 500`, params.map(String));
}
