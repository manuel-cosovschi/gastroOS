/**
 * Un servidor que imita las partes de la Graph API (y de Supabase Storage) que
 * usa la Factory. Sirve para probar el código HTTP de punta a punta —parámetros,
 * multipart, paginación, lecturas de verificación— sin una cuenta real.
 *
 * NO es una validación con Meta: no sabe nada de permisos, revisión de
 * anuncios ni políticas. Eso sólo se prueba con credenciales reales
 * (`smf doctor --meta`).
 */

import { createServer, type IncomingMessage, type Server } from 'node:http';

export interface MockCall {
  method: string;
  path: string;
  query: Record<string, string>;
  body: Record<string, string>;
  multipart: boolean;
  auth?: string;
}

export interface MockGraph {
  url: string;
  calls: MockCall[];
  /** El estado efectivo que devuelven los anuncios al leerlos. */
  adEffectiveStatus: string;
  close(): Promise<void>;
}

async function readBody(req: IncomingMessage): Promise<{ body: Record<string, string>; multipart: boolean }> {
  const chunks: Buffer[] = [];
  for await (const c of req) chunks.push(c as Buffer);
  const raw = Buffer.concat(chunks);
  const ct = req.headers['content-type'] ?? '';
  if (ct.includes('multipart/form-data')) {
    const out: Record<string, string> = {};
    for (const m of raw.toString('latin1').matchAll(/name="([^"]+)"(?:; filename="([^"]+)")?\r\n(?:Content-Type: [^\r]+\r\n)?\r\n([\s\S]*?)\r\n--/g)) out[m[1]] = m[2] ? `<archivo ${m[2]} ${m[3].length} bytes>` : m[3];
    return { body: out, multipart: true };
  }
  if (ct.includes('application/x-www-form-urlencoded')) return { body: Object.fromEntries(new URLSearchParams(raw.toString())), multipart: false };
  return { body: raw.length ? { raw: raw.toString().slice(0, 200) } : {}, multipart: false };
}

export async function startMockGraph(opts: { account?: string; pixel?: string; ig?: string; page?: string } = {}): Promise<MockGraph> {
  const account = `act_${opts.account ?? '111'}`;
  const pixel = opts.pixel ?? '999';
  const ig = opts.ig ?? '17840000000';
  const page = opts.page ?? '555';
  let seq = 1000;
  const objects = new Map<string, Record<string, unknown>>();
  const state: MockGraph = { url: '', calls: [], adEffectiveStatus: 'ACTIVE', close: async () => undefined };
  const server: Server = createServer(async (req, res) => {
    const u = new URL(req.url ?? '/', 'http://x');
    const { body, multipart } = await readBody(req);
    const path = u.pathname.replace(/^\/v\d+\.\d+\//, '');
    state.calls.push({ method: req.method!, path, query: Object.fromEntries(u.searchParams), body, multipart, auth: req.headers.authorization });
    const send = (code: number, obj: unknown) => {
      res.writeHead(code, { 'content-type': 'application/json', 'x-business-use-case-usage': JSON.stringify({ [opts.account ?? '111']: [{ call_count: 3, total_cputime: 2, total_time: 2, type: 'ADS_MANAGEMENT', estimated_time_to_regain_access: 0 }] }) });
      res.end(JSON.stringify(obj));
    };
    const nuevo = (kind: string, extra: Record<string, unknown> = {}) => {
      const id = String(++seq);
      objects.set(id, { id, kind, status: body.status ?? 'PAUSED', ...body, ...extra });
      return id;
    };
    if (u.pathname.startsWith('/storage/v1/object/')) return send(200, { Key: u.pathname });
    if (req.headers.authorization !== 'Bearer token-de-prueba' && !path.endsWith('/events')) return send(400, { error: { message: 'Invalid OAuth access token', code: 190 } });
    const m = req.method;
    if (m === 'GET' && path === 'me') return send(200, { id: '42', name: 'Sovare Test' });
    if (m === 'GET' && path === 'me/permissions') return send(200, { data: ['ads_management', 'ads_read', 'business_management', 'pages_read_engagement', 'pages_manage_posts', 'instagram_basic', 'instagram_content_publish'].map((p) => ({ permission: p, status: 'granted' })) });
    if (m === 'GET' && path === account) return send(200, { name: 'Cuenta de prueba', account_status: 1, currency: 'ARS', timezone_name: 'America/Argentina/Buenos_Aires' });
    if (m === 'GET' && path === page) return send(200, { name: 'Sovare' });
    if (m === 'GET' && path === ig) return send(200, { username: 'sovare.test' });
    if (m === 'POST' && path === `${account}/campaigns`) return send(200, { id: nuevo('campaign') });
    if (m === 'POST' && path === `${account}/adsets`) return send(200, { id: nuevo('adset') });
    if (m === 'POST' && path === `${account}/advideos`) return send(200, { id: nuevo('video') });
    if (m === 'POST' && path === `${account}/adimages`) return send(200, { images: { 'poster.jpg': { hash: `h${++seq}` } } });
    if (m === 'POST' && path === `${account}/adcreatives`) return send(200, { id: nuevo('creative') });
    if (m === 'POST' && path === `${account}/ads`) return send(200, { id: nuevo('ad') });
    if (m === 'GET' && path === `${account}/insights`) {
      const ads = [...objects.values()].filter((o) => o.kind === 'ad');
      return send(200, {
        data: ads.map((a) => ({ ad_id: a.id, date_start: u.searchParams.get('time_range') ? JSON.parse(u.searchParams.get('time_range')!).until : '2026-10-21', impressions: '12000', reach: '9000', clicks: '240', inline_link_clicks: '180', spend: '9000.50', frequency: '1.33', actions: [{ action_type: 'offsite_conversion.fb_pixel_lead', value: '6' }, { action_type: 'lead', value: '6' }] })),
      });
    }
    if (m === 'POST' && path === `${pixel}/events`) return send(200, { events_received: 1, fbtrace_id: 'mock' });
    if (m === 'GET' && path === `${ig}/content_publishing_limit`) return send(200, { data: [{ quota_usage: 1, config: { quota_total: 100 } }] });
    if (m === 'POST' && path === `${ig}/media`) return send(200, { id: nuevo('igcontainer') });
    if (m === 'POST' && path === `${ig}/media_publish`) return send(200, { id: nuevo('igmedia') });
    if (m === 'POST' && (path === `${page}/videos` || path === `${page}/photos`)) return send(200, { id: nuevo('fbpost') });
    if (m === 'GET' && path.endsWith('/ads')) {
      const adset = path.split('/')[0];
      return send(200, { data: [...objects.values()].filter((o) => o.kind === 'ad' && o.adset_id === adset).map((a) => ({ id: a.id, name: a.name, status: a.status, effective_status: state.adEffectiveStatus, ...(state.adEffectiveStatus === 'DISAPPROVED' ? { ad_review_feedback: { global: { 'Política de prueba': 'motivo simulado' } } } : {}) })) });
    }
    const obj = objects.get(path);
    if (obj && m === 'GET') {
      if (obj.kind === 'video') return send(200, { id: obj.id, status: { video_status: 'ready' } });
      if (obj.kind === 'igcontainer') return send(200, { id: obj.id, status_code: 'FINISHED' });
      if (obj.kind === 'igmedia') return send(200, { id: obj.id, permalink: `https://www.instagram.com/reel/${obj.id}/` });
      return send(200, { ...obj, effective_status: obj.status });
    }
    if (obj && m === 'POST') {
      Object.assign(obj, body);
      return send(200, { success: true });
    }
    return send(404, { error: { message: `mock: no conozco ${m} ${path}`, code: 100 } });
  });
  await new Promise<void>((r) => server.listen(0, '127.0.0.1', r));
  const addr = server.address() as { port: number };
  state.url = `http://127.0.0.1:${addr.port}`;
  state.close = () => new Promise((r) => server.close(() => r()));
  return state;
}
