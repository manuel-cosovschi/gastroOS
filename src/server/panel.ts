/**
 * Panel de operaciones.
 *
 * Es la única interfaz donde actúa el DUEÑO (además de la CLI local con su
 * llave): decide autorizaciones, levanta la pausa general, cambia la política y
 * pasa a modo real. Se entra con SMF_OWNER_KEY; la sesión dura 12 h y cada
 * formulario lleva un token anti-CSRF.
 */

import type { IncomingMessage, ServerResponse } from 'node:http';
import { createReadStream, existsSync, statSync } from 'node:fs';
import { config } from '../config.ts';
import { db } from '../db/index.ts';
import { audit } from '../core/audit.ts';
import { decideApproval, releaseKillSwitch } from '../core/policy.ts';
import { hmac, safeEqual, sha256, token } from '../core/util.ts';
import { getProduct } from '../catalog/index.ts';
import { runOp, OPS } from '../ops.ts';
import { revokeAll } from './oauth.ts';
import { clientIp, cookies, html, page, readForm, send, tooMany } from './util.ts';

const SESSION_HOURS = 12;
const secret = () => config.signingSecret || config.ownerKey;
const csrfFor = (sid: string) => hmac(secret(), `csrf:${sid}`).slice(0, 32);

export async function sessionOf(req: IncomingMessage): Promise<string | null> {
  const sid = cookies(req).smf_s;
  if (!sid || !config.ownerKey) return null;
  const d = await db();
  const [s] = await d.query<{ expires_at: string }>('SELECT expires_at FROM smf.panel_sessions WHERE id_hash = $1', [sha256(sid)]);
  return s && new Date(s.expires_at) > new Date() ? sid : null;
}

function nav(sid: string): string {
  return `<header><b>Sovare Marketing Factory</b><nav><a href="/panel">Inicio</a><a href="/panel/approvals">Autorizaciones</a><a href="/panel/creatives">Creativos</a><a href="/panel/settings">Configuración</a><a href="/panel/audit">Registro</a><a href="/panel/logout">Salir</a></nav>
  <form class="inline" method="post" action="/panel/kill"><input type="hidden" name="csrf" value="${csrfFor(sid)}"><input type="hidden" name="reason" value="pausa general desde el panel"><button class="danger" onclick="return confirm('¿Pausar TODO? Se frenan las campañas en Meta y la cola de trabajos.')">⏸ Pausa general</button></form></header>`;
}

const pill = (ok: boolean | null, txt: string) => `<span class="pill ${ok === null ? '' : ok ? 'ok' : 'bad'}">${html(txt)}</span>`;
const money = (n: unknown) => (n === null || n === undefined ? '—' : `$${Number(n).toLocaleString('es-AR', { maximumFractionDigits: 0 })}`);
const when = (s: unknown) => (s ? new Date(String(s)).toLocaleString('es-AR', { timeZone: 'America/Argentina/Buenos_Aires', dateStyle: 'short', timeStyle: 'short' }) : '—');

function loginPage(msg = ''): string {
  return page('Entrar', `<h1>Panel de la Marketing Factory</h1>${msg ? `<div class="banner bad">${html(msg)}</div>` : ''}
    ${config.ownerKey ? `<form method="post" action="/panel/login"><label>Llave del dueño (SMF_OWNER_KEY)<input type="password" name="key" autofocus required></label><div class="row"><button>Entrar</button></div></form>` : '<p>El panel está apagado: falta <code>SMF_OWNER_KEY</code> en el servidor.</p>'}`);
}

export async function handlePanel(req: IncomingMessage, res: ServerResponse, url: URL, body: string): Promise<boolean> {
  const p = url.pathname;
  const m = req.method;
  if (p === '/panel/login' && m === 'POST') {
    if (tooMany(`login:${clientIp(req)}`)) return (send(res, 429, loginPage('Demasiados intentos. Esperá 15 minutos.')), true);
    const k = readForm(body).get('key') ?? '';
    if (!config.ownerKey || !safeEqual(k, config.ownerKey)) {
      await audit({ actor: 'anon', action: 'panel.login', decision: 'denied', details: { ip: clientIp(req) } });
      return (send(res, 401, loginPage('Llave incorrecta.')), true);
    }
    const sid = token(32);
    const d = await db();
    await d.query(`INSERT INTO smf.panel_sessions (id_hash, expires_at) VALUES ($1, now() + ($2 || ' hours')::interval)`, [sha256(sid), String(SESSION_HOURS)]);
    await audit({ actor: 'owner', action: 'panel.login', decision: 'allowed', details: { ip: clientIp(req) } });
    const secure = config.publicUrl.startsWith('https') ? '; Secure' : '';
    res.writeHead(303, { Location: '/panel', 'Set-Cookie': `smf_s=${sid}; HttpOnly; SameSite=Strict; Path=/; Max-Age=${SESSION_HOURS * 3600}${secure}` });
    res.end();
    return true;
  }
  // El link firmado de una autorización no necesita sesión: el token es la prueba.
  const ap = p.match(/^\/approvals\/(apr_[0-9a-f]+)$/);
  if (ap) return approvalLink(req, res, ap[1], url, body);

  if (!p.startsWith('/panel') && !p.startsWith('/media/')) return false;
  const sid = await sessionOf(req);
  if (!sid) return (send(res, p === '/panel' || m === 'GET' ? 200 : 401, loginPage()), true);
  if (m === 'POST') {
    const f = readForm(body);
    if (!safeEqual(f.get('csrf') ?? '', csrfFor(sid))) return (send(res, 403, page('Formulario vencido', '<p>Volvé a cargar la página.</p>')), true);
  }
  const back = (to = '/panel') => (res.writeHead(303, { Location: to }), res.end(), true);

  try {
    if (p === '/panel/logout') {
      await (await db()).query('DELETE FROM smf.panel_sessions WHERE id_hash = $1', [sha256(sid)]);
      res.writeHead(303, { Location: '/panel', 'Set-Cookie': 'smf_s=; Max-Age=0; Path=/' });
      res.end();
      return true;
    }
    if (p === '/panel' && m === 'GET') return (send(res, 200, page('Inicio', await dashboard(sid), nav(sid))), true);
    if (p === '/panel/kill' && m === 'POST') {
      await runOp('pause_all', { reason: readForm(body).get('reason') || 'pausa general desde el panel' }, 'owner');
      return back();
    }
    if (p === '/panel/release' && m === 'POST') {
      await releaseKillSwitch('owner');
      return back();
    }
    if (p === '/panel/revoke-tokens' && m === 'POST') {
      const n = await revokeAll();
      await audit({ actor: 'owner', action: 'oauth.revoke_all', decision: 'done', details: { n } });
      return back('/panel/settings');
    }
    if (p === '/panel/approvals' && m === 'GET') return (send(res, 200, page('Autorizaciones', await approvalsPage(sid), nav(sid))), true);
    const dec = p.match(/^\/panel\/approvals\/(apr_[0-9a-f]+)$/);
    if (dec && m === 'POST') {
      const f = readForm(body);
      await decideApproval(dec[1], f.get('decision') === 'approve', { kind: 'owner' }, f.get('note') ?? undefined);
      return back('/panel/approvals');
    }
    if (p === '/panel/op' && m === 'POST') {
      const f = readForm(body);
      const name = f.get('op') ?? '';
      const r = await runOp(name, JSON.parse(f.get('input') || '{}'), 'owner');
      return (send(res, 200, page(name, `<h1>${html(name)}</h1><pre>${html(JSON.stringify(r, null, 2))}</pre><p><a href="${html(f.get('back') || '/panel')}">Volver</a></p>`, nav(sid))), true);
    }
    if (p === '/panel/creatives' && m === 'GET') return (send(res, 200, page('Creativos', await creativesPage(), nav(sid))), true);
    const cv = p.match(/^\/panel\/creatives\/(crv_[0-9a-z]+)$/);
    if (cv) return (send(res, 200, page('Creativo', await creativePage(cv[1]), nav(sid))), true);
    const cp = p.match(/^\/panel\/campaigns\/(cmp_[0-9a-f]+)$/);
    if (cp) return (send(res, 200, page('Campaña', await campaignPage(cp[1], sid), nav(sid))), true);
    if (p === '/panel/settings' && m === 'GET') return (send(res, 200, page('Configuración', await settingsPage(sid), nav(sid))), true);
    if (p === '/panel/settings' && m === 'POST') {
      const f = readForm(body);
      const which = f.get('which');
      const value = JSON.parse(f.get('value') || '{}');
      if (which === 'policy') await runOp('policy_update', { patch: value }, 'owner');
      else if (which === 'campaign_defaults' || which === 'optimizer') await runOp('settings_update', { key: which, value }, 'owner');
      else if (which === 'mode') await runOp('mode_set', { mode: f.get('mode') }, 'owner');
      return back('/panel/settings');
    }
    if (p === '/panel/audit') return (send(res, 200, page('Registro', await auditPage(), nav(sid))), true);
    const media = p.match(/^\/media\/(crv_[0-9a-z]+)\/(video\.mp4|poster\.jpg|captions\.srt)$/);
    if (media) {
      const [r] = await (await db()).query<{ path: string; poster_path: string }>('SELECT path, poster_path FROM smf.creatives WHERE id = $1', [media[1]]);
      const file = r && (media[2] === 'poster.jpg' ? r.poster_path : media[2] === 'video.mp4' ? r.path : r.path?.replace(/video\.mp4$/, 'captions.srt'));
      if (!file || !existsSync(file)) return (send(res, 404, 'no está'), true);
      res.writeHead(200, { 'Content-Type': media[2].endsWith('mp4') ? 'video/mp4' : media[2].endsWith('jpg') ? 'image/jpeg' : 'text/plain; charset=utf-8', 'Content-Length': statSync(file).size, 'Cache-Control': 'private, max-age=3600' });
      createReadStream(file).pipe(res);
      return true;
    }
    send(res, 404, page('No existe', '<p>Esa página no existe.</p>', nav(sid)));
    return true;
  } catch (e) {
    const err = e as { message?: string; code?: string };
    send(res, 400, page('No se pudo', `<div class="banner bad">${html(err.message ?? String(e))}</div><p><a href="javascript:history.back()">Volver</a></p>`, nav(sid)));
    return true;
  }
}

async function dashboard(sid: string): Promise<string> {
  const st = (await runOp('status', {}, 'owner')) as Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any
  const prods = (await runOp('products_list', {}, 'owner')) as any[]; // eslint-disable-line @typescript-eslint/no-explicit-any
  const perf = (await runOp('performance', { days: 7 }, 'owner')) as any; // eslint-disable-line @typescript-eslint/no-explicit-any
  const d = await db();
  const camps = await d.query<any>(`SELECT id, product_id, name, status, daily_budget_ars, dry_run, blockers, updated_at FROM smf.campaigns ORDER BY updated_at DESC LIMIT 20`); // eslint-disable-line @typescript-eslint/no-explicit-any
  const ventas = await d.query<any>(`SELECT product_id, type, value, plan, campaign_id, occurred_at FROM smf.events WHERE type IN ('purchase','customer','lead','qualified_lead') ORDER BY occurred_at DESC LIMIT 15`); // eslint-disable-line @typescript-eslint/no-explicit-any
  const alertas = await d.query<any>(`SELECT kind, severity, title, created_at FROM smf.alerts ORDER BY created_at DESC LIMIT 12`); // eslint-disable-line @typescript-eslint/no-explicit-any
  const scheds = await d.query<any>(`SELECT id, cron, enabled, description, last_slot FROM smf.schedules ORDER BY id`); // eslint-disable-line @typescript-eslint/no-explicit-any
  const ks = st.kill_switch;
  const csrf = csrfFor(sid);
  const c = st.counts;
  return `
  ${ks.paused ? `<div class="banner bad"><b>PAUSA GENERAL ACTIVA</b> desde ${when(ks.at)} (${html(ks.by)}): ${html(ks.reason ?? '')}. <form class="inline" method="post" action="/panel/release"><input type="hidden" name="csrf" value="${csrf}"><button>Levantar la pausa</button></form></div>` : ''}
  ${st.mode !== 'live' ? `<div class="banner warn"><b>Modo de prueba.</b> Nada se publica ni se gasta en Meta: todo lo externo se simula y queda registrado. Pasar a modo real se hace en Configuración.</div>` : ''}
  <div class="grid">
    <div class="card"><div class="k">Modo</div><div class="v">${st.mode === 'live' ? 'Real' : 'Prueba'}</div></div>
    <div class="card"><div class="k">Campañas activas</div><div class="v">${c.activas}</div><small>${c.en_preparacion} en preparación</small></div>
    <div class="card"><div class="k">Creativos listos</div><div class="v">${c.creativos_listos}</div></div>
    <div class="card"><div class="k">Autorizaciones</div><div class="v">${c.autorizaciones_pendientes ? `<a href="/panel/approvals">${c.autorizaciones_pendientes} pendiente(s)</a>` : '0'}</div></div>
    <div class="card"><div class="k">Ejecutor</div><div class="v">${pill(st.health.ok, st.health.ok ? 'sano' : 'revisar')}</div><small>${html(st.health.checks.find((x: any) => x.name === 'ejecutor programado')?.detail ?? '')}</small></div>
  </div>
  <h2>Productos</h2><div class="tw"><table><tr><th>Producto</th><th>Anunciable</th><th>/conv</th><th>Píxel</th><th>Planes</th><th>Bloqueos</th></tr>
  ${prods.map((x) => `<tr><td><b>${html(x.name)}</b><br><small>${html(x.urls.conv)}</small></td><td>${pill(x.marketable, x.marketable ? 'sí' : 'no')}</td><td>${x.landing ? pill(x.landing.ok, x.landing.ok ? 'ok' : 'falla') + `<br><small>${when(x.landing.checked_at)}</small>` : pill(null, 'sin verificar')}</td><td>${x.landing ? pill(x.landing.pixel === 'present', x.landing.pixel === 'present' ? 'instalado' : 'falta') : '—'}</td><td>${x.plans.map((pl: any) => `${html(pl.name)} ${money(pl.monthly)}`).join('<br>')}</td><td>${x.blockers.map((b: any) => `<span class="${b.severity === 'high' ? 'bad' : 'warn'}">• ${html(b.detail)}</span>`).join('<br>')}</td></tr>`).join('')}
  </table></div>
  <h2>Últimos 7 días</h2><div class="tw"><table><tr><th>Producto</th><th>Gasto</th><th>Impr.</th><th>CTR</th><th>CPC</th><th>CPM</th><th>Consultas Meta</th><th>CPL</th><th>Confirmadas</th><th>Compras</th><th>Ingresos</th><th>CAC</th><th>ROAS</th></tr>
  ${perf.products.map((x: any) => `<tr><td>${html(x.name)}</td><td>${money(x.spend)}</td><td>${x.impressions.toLocaleString('es-AR')}</td><td>${x.ctr === null ? '—' : (x.ctr * 100).toFixed(2) + '%'}</td><td>${money(x.cpc)}</td><td>${money(x.cpm)}</td><td>${x.meta_leads}</td><td>${money(x.cpl)}</td><td>${x.leads_confirmed}</td><td>${x.purchases}</td><td>${money(x.revenue)}</td><td>${money(x.cac)}</td><td>${x.roas === null ? '—' : x.roas.toFixed(2)}</td></tr>`).join('')}
  </table></div>
  <h2>Campañas</h2><div class="tw"><table><tr><th>Campaña</th><th>Producto</th><th>Estado</th><th>Presupuesto/día</th><th>Actualizada</th></tr>
  ${camps.map((x) => `<tr><td><a href="/panel/campaigns/${x.id}">${html(x.name)}</a>${x.dry_run ? ' <span class="pill">simulada</span>' : ''}${x.blockers?.length ? `<br><small class="bad">${html(x.blockers.join('; '))}</small>` : ''}</td><td>${html(x.product_id)}</td><td>${html(x.status)}</td><td>${money(x.daily_budget_ars)}</td><td>${when(x.updated_at)}</td></tr>`).join('') || '<tr><td colspan="5">Todavía no hay campañas.</td></tr>'}
  </table></div>
  <h2>Compras y consultas</h2><div class="tw"><table><tr><th>Cuándo</th><th>Producto</th><th>Tipo</th><th>Monto</th><th>Plan</th><th>Campaña</th></tr>
  ${ventas.map((x) => `<tr><td>${when(x.occurred_at)}</td><td>${html(x.product_id)}</td><td>${html(x.type)}</td><td>${money(x.value)}</td><td>${html(x.plan ?? '')}</td><td>${x.campaign_id ? `<a href="/panel/campaigns/${x.campaign_id}">${x.campaign_id}</a>` : '<small>sin atribución</small>'}</td></tr>`).join('') || '<tr><td colspan="6">Sin eventos todavía.</td></tr>'}
  </table></div>
  <h2>Alertas</h2><div class="tw"><table><tr><th>Cuándo</th><th>Tipo</th><th>Aviso</th></tr>
  ${alertas.map((x) => `<tr><td>${when(x.created_at)}</td><td><span class="pill ${x.severity === 'critical' ? 'bad' : x.severity === 'sale' ? 'ok' : x.severity === 'warning' ? 'warn' : ''}">${html(x.kind)}</span></td><td>${html(x.title)}</td></tr>`).join('') || '<tr><td colspan="3">Nada.</td></tr>'}
  </table></div>
  <h2>Integraciones</h2><div class="grid">${st.integrations.map((x: any) => `<div class="card"><div class="k">${html(x.name)}</div>${pill(x.ok, x.ok ? 'configurada' : 'falta')}<br><small>${html(x.detail)}</small></div>`).join('')}</div>
  <h2>Automatizaciones</h2><div class="tw"><table><tr><th>Tarea</th><th>Cuándo (hora AR)</th><th>Activa</th><th>Último turno</th></tr>
  ${scheds.map((x) => `<tr><td>${html(x.description)}</td><td><code>${html(x.cron)}</code></td><td>${pill(x.enabled, x.enabled ? 'sí' : 'no')}</td><td>${when(x.last_slot)}</td></tr>`).join('')}
  </table></div>`;
}

async function approvalsPage(sid: string): Promise<string> {
  const d = await db();
  const rows = await d.query<any>(`SELECT * FROM smf.approvals ORDER BY (status = 'pending') DESC, requested_at DESC LIMIT 60`); // eslint-disable-line @typescript-eslint/no-explicit-any
  const csrf = csrfFor(sid);
  return `<h1>Autorizaciones</h1><p>Las pide el agente o el sistema; las decidís vos. Aprobar el «primer gasto real» de un producto o «activar un canal» queda como regla; el resto se usa una vez.</p>
  <div class="tw"><table><tr><th>Pedido</th><th>Acción</th><th>Alcance</th><th>Estado</th><th></th></tr>
  ${rows.map((a) => `<tr><td>${html(a.summary)}<br><small>${html(a.requested_by)} · ${when(a.requested_at)} · vence ${when(a.expires_at)}</small></td><td><code>${html(a.action)}</code></td><td><code>${html(JSON.stringify(a.scope))}</code></td><td>${html(a.status)}</td>
  <td>${a.status === 'pending' ? `<form method="post" action="/panel/approvals/${a.id}"><input type="hidden" name="csrf" value="${csrf}"><input name="note" placeholder="nota (opcional)"><div class="row"><button name="decision" value="approve">Aprobar</button><button name="decision" value="reject" class="ghost">Rechazar</button></div></form>` : ''}</td></tr>`).join('') || '<tr><td colspan="5">No hay pedidos.</td></tr>'}
  </table></div>`;
}

async function creativesPage(): Promise<string> {
  const d = await db();
  const rows = await d.query<any>(`SELECT r.id, r.product_id, r.format, r.status, r.poster_path, c.headline FROM smf.creatives r JOIN smf.concepts c ON c.id = r.concept_id ORDER BY r.created_at DESC LIMIT 60`); // eslint-disable-line @typescript-eslint/no-explicit-any
  return `<h1>Creativos</h1><div class="thumbs">${rows.map((r) => `<a href="/panel/creatives/${r.id}" style="color:inherit;text-decoration:none"><img src="/media/${r.id}/poster.jpg" alt="" loading="lazy"><small>${html(r.product_id)} · ${html(r.format)} · ${html(r.status)}</small><br><small>${html(r.headline)}</small></a>`).join('') || 'Todavía no hay creativos.'}</div>`;
}

async function creativePage(id: string): Promise<string> {
  const d = await db();
  const [r] = await d.query<any>(`SELECT r.*, c.headline, c.primary_text, c.angle, c.claims FROM smf.creatives r JOIN smf.concepts c ON c.id = r.concept_id WHERE r.id = $1`, [id]); // eslint-disable-line @typescript-eslint/no-explicit-any
  if (!r) return '<p>No existe.</p>';
  const p = getProduct(r.product_id);
  return `<h1>${html(r.headline)}</h1><p>${html(p.name)} · ${html(r.format)} · ${r.width}×${r.height} · ${r.duration_s}s · ${html(r.status)}</p>
  <div style="display:flex;gap:20px;flex-wrap:wrap"><video src="/media/${id}/video.mp4" poster="/media/${id}/poster.jpg" controls playsinline style="max-width:min(100%,420px);max-height:80vh;border-radius:12px;background:#000"></video>
  <div style="flex:1;min-width:260px"><h2>Copy</h2><pre style="white-space:pre-wrap">${html(r.primary_text)}</pre><h2>Claims usados</h2><code>${html(JSON.stringify(r.claims))}</code>
  <h2>Validación</h2><pre style="white-space:pre-wrap">${html(JSON.stringify(r.validation, null, 1))}</pre><p><small>Proyecto editable: <code>${html(r.project_path ?? '')}</code></small></p></div></div>`;
}

async function campaignPage(id: string, sid: string): Promise<string> {
  const c = (await runOp('campaign_get', { campaign: id }, 'owner')) as any; // eslint-disable-line @typescript-eslint/no-explicit-any
  const csrf = csrfFor(sid);
  const btn = (opn: string, label: string, cls = '') => `<form class="inline" method="post" action="/panel/op"><input type="hidden" name="csrf" value="${csrf}"><input type="hidden" name="op" value="${opn}"><input type="hidden" name="back" value="/panel/campaigns/${id}"><input type="hidden" name="input" value='${html(JSON.stringify({ campaign: id }))}'><button class="${cls}">${label}</button></form>`;
  return `<h1>${html(c.name)}</h1><p>${html(c.product_id)} · <b>${html(c.status)}</b>${c.dry_run ? ' · <span class="pill">simulada (modo de prueba)</span>' : ''} · ${money(c.daily_budget_ars)} por día</p>
  ${c.blockers?.length ? `<div class="banner bad">${c.blockers.map((b: string) => html(b)).join('<br>')}</div>` : ''}
  <div class="row">${btn('campaign_push', 'Crear en Meta (en pausa)')}${btn('campaign_launch', 'Lanzar')}${btn('campaign_refresh', 'Leer estado en Meta', 'ghost')}${btn('campaign_pause', 'Pausar', 'danger')}</div>
  <h2>Anuncios</h2><div class="tw"><table><tr><th>Anuncio</th><th>Creativo</th><th>URL</th><th>Meta</th><th>Estado</th></tr>${c.ads.map((a: any) => `<tr><td>${html(a.id)}</td><td><a href="/panel/creatives/${a.creative_id}">${html(a.creative_id)}</a></td><td><small>${html(a.url)}</small></td><td>${html(a.meta_ad_id ?? '—')}</td><td>${html(a.status)} ${a.effective_status ? `(${html(a.effective_status)})` : ''}</td></tr>`).join('')}</table></div>
  <h2>Plan</h2><pre>${html(JSON.stringify(c.plan, null, 1))}</pre><h2>Estado leído de Meta</h2><pre>${html(JSON.stringify(c.meta_status, null, 1))}</pre>`;
}

async function settingsPage(sid: string): Promise<string> {
  const s = (await runOp('settings_get', {}, 'owner')) as any; // eslint-disable-line @typescript-eslint/no-explicit-any
  const csrf = csrfFor(sid);
  const editor = (which: string, title: string, value: unknown, help: string) => `<h2>${title}</h2><p><small>${help}</small></p><form method="post" action="/panel/settings"><input type="hidden" name="csrf" value="${csrf}"><input type="hidden" name="which" value="${which}"><textarea name="value">${html(JSON.stringify(value, null, 2))}</textarea><div class="row"><button>Guardar</button></div></form>`;
  return `<h1>Configuración</h1>
  <h2>Modo</h2><p>Actual: <b>${s.mode === 'live' ? 'real' : 'prueba'}</b>. En modo real, lo que autoriza la política sale a Meta de verdad.</p>
  <form method="post" action="/panel/settings"><input type="hidden" name="csrf" value="${csrf}"><input type="hidden" name="which" value="mode"><input type="hidden" name="mode" value="${s.mode === 'live' ? 'test' : 'live'}"><button class="${s.mode === 'live' ? 'ghost' : 'danger'}" onclick="return confirm('¿Seguro?')">${s.mode === 'live' ? 'Volver a modo de prueba' : 'Pasar a modo REAL'}</button></form>
  ${editor('policy', 'Política (topes, canales, piloto automático)', s.policy, 'Topes en ARS por día. channels: canales activados. products_live: productos con el primer gasto real autorizado. autopilot: lo que el sistema y el agente pueden hacer sin preguntar.')}
  ${editor('campaign_defaults', 'Valores de campaña', s.campaign_defaults, 'daily_budget_ars por producto (0 = no prepara campañas), formatos, conceptos por producto, orgánico.')}
  ${editor('optimizer', 'Optimizador', s.optimizer, 'target_cpl_ars por producto (sin esto no se pausa por costo), muestras mínimas, fatiga.')}
  <h2>Conexiones de Claude</h2><form method="post" action="/panel/revoke-tokens"><input type="hidden" name="csrf" value="${csrf}"><button class="ghost" onclick="return confirm('Claude va a tener que volver a conectarse.')">Revocar todos los accesos OAuth</button></form>
  <h2>Operaciones disponibles</h2><p><small>${OPS.map((o) => `<code>${o.name}</code>`).join(' · ')}</small></p>`;
}

async function auditPage(): Promise<string> {
  const rows = (await runOp('audit_log', { limit: 200 }, 'owner')) as any[]; // eslint-disable-line @typescript-eslint/no-explicit-any
  return `<h1>Registro de acciones</h1><div class="tw"><table><tr><th>Cuándo</th><th>Quién</th><th>Acción</th><th>Nivel</th><th>Decisión</th><th>Sobre</th><th>Detalle</th></tr>
  ${rows.map((r) => `<tr><td>${when(r.at)}</td><td>${html(r.actor)}</td><td><code>${html(r.action)}</code></td><td>${r.tier ?? ''}</td><td>${html(r.decision)}</td><td><small>${html(r.target ?? '')}</small></td><td><small>${html(JSON.stringify(r.details).slice(0, 220))}</small></td></tr>`).join('')}</table></div>`;
}

async function approvalLink(req: IncomingMessage, res: ServerResponse, id: string, url: URL, body: string): Promise<boolean> {
  const d = await db();
  const [a] = await d.query<any>('SELECT * FROM smf.approvals WHERE id = $1', [id]); // eslint-disable-line @typescript-eslint/no-explicit-any
  if (!a) return (send(res, 404, page('No existe', '<p>No existe esa autorización.</p>')), true);
  if (req.method === 'GET') {
    const t = url.searchParams.get('t') ?? '';
    if (!a.link_hash || sha256(t) !== a.link_hash) return (send(res, 403, page('Link inválido', `<p>El link no es válido o ya se usó. Estado: <b>${html(a.status)}</b>.</p>`)), true);
    return (send(res, 200, page('Autorización', `<h1>Autorización pendiente</h1><p>${html(a.summary)}</p><p><code>${html(a.action)}</code> · ${html(JSON.stringify(a.scope))}</p><p><small>Pedido por ${html(a.requested_by)} · vence ${when(a.expires_at)}</small></p>
      <form method="post"><input type="hidden" name="t" value="${html(t)}"><div class="row"><button name="decision" value="approve">Aprobar</button><button name="decision" value="reject" class="ghost">Rechazar</button></div></form>`)), true);
  }
  if (tooMany(`link:${clientIp(req)}`)) return (send(res, 429, page('Demasiados intentos', '<p>Esperá 15 minutos.</p>')), true);
  const f = readForm(body);
  try {
    const r = await decideApproval(id, f.get('decision') === 'approve', { kind: 'link', token: f.get('t') ?? '' });
    send(res, 200, page('Listo', `<h1>${r.status === 'rejected' ? 'Rechazada' : 'Aprobada'}</h1><p>${html(a.summary)}</p>`));
  } catch (e) {
    send(res, 400, page('No se pudo', `<p>${html(e instanceof Error ? e.message : String(e))}</p>`));
  }
  return true;
}
