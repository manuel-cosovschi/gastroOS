/**
 * OAuth 2.1 para el conector MCP de Claude (Cowork, claude.ai, Desktop, Claude Code).
 *
 * Lo mínimo que Claude exige (https://claude.com/docs/connectors/building/authentication):
 *   - 401 con `WWW-Authenticate: Bearer resource_metadata="…"` en /mcp sin token.
 *   - Metadatos del recurso protegido y del servidor de autorización.
 *   - Registro dinámico de clientes (DCR, RFC 7591).
 *   - Código de autorización con PKCE S256; token por form-urlencoded;
 *     refresh tokens rotados (cliente público).
 *
 * Quién aprueba la conexión: el dueño, escribiendo SMF_OWNER_KEY en la pantalla
 * de consentimiento. El token que recibe Claude actúa como `agent`: puede
 * operar dentro de la política y PEDIR autorizaciones, nunca darlas.
 *
 * Sólo se aceptan redirecciones de Claude: https://claude.ai/api/mcp/auth_callback
 * (y claude.com) y loopback de Claude Code en cualquier puerto.
 */

import type { IncomingMessage, ServerResponse } from 'node:http';
import { createHash } from 'node:crypto';
import { config } from '../config.ts';
import { db, j } from '../db/index.ts';
import { audit } from '../core/audit.ts';
import { newId, safeEqual, sha256, token } from '../core/util.ts';
import { html, page, readForm, send, sendJson, tooMany } from './util.ts';

const ACCESS_TTL = 3600;
const REFRESH_TTL = 30 * 24 * 3600;

export const resourceUrl = () => `${config.publicUrl}/mcp`;
export const resourceMetadataUrl = () => `${config.publicUrl}/.well-known/oauth-protected-resource`;

export function protectedResourceMetadata() {
  return { resource: resourceUrl(), authorization_servers: [config.publicUrl], scopes_supported: ['smf'], bearer_methods_supported: ['header'], resource_name: 'Sovare Marketing Factory' };
}

export function authServerMetadata() {
  const u = config.publicUrl;
  return {
    issuer: u,
    authorization_endpoint: `${u}/oauth/authorize`,
    token_endpoint: `${u}/oauth/token`,
    registration_endpoint: `${u}/oauth/register`,
    response_types_supported: ['code'],
    grant_types_supported: ['authorization_code', 'refresh_token'],
    code_challenge_methods_supported: ['S256'],
    token_endpoint_auth_methods_supported: ['none'],
    scopes_supported: ['smf'],
  };
}

export function redirectAllowed(uri: string): boolean {
  try {
    const u = new URL(uri);
    if (u.protocol === 'https:' && ['claude.ai', 'claude.com'].includes(u.hostname) && u.pathname === '/api/mcp/auth_callback') return true;
    if (u.protocol === 'http:' && ['localhost', '127.0.0.1'].includes(u.hostname)) return true;
    return (process.env.SMF_OAUTH_EXTRA_REDIRECTS ?? '').split(',').map((s) => s.trim()).filter(Boolean).includes(uri);
  } catch {
    return false;
  }
}

/** Comparación de redirección: exacta, salvo el puerto en loopback (RFC 8252 §7.3). */
function sameRedirect(registered: string, given: string): boolean {
  if (registered === given) return true;
  try {
    const a = new URL(registered);
    const b = new URL(given);
    const loop = (h: string) => h === 'localhost' || h === '127.0.0.1';
    return a.protocol === 'http:' && loop(a.hostname) && a.hostname === b.hostname && a.pathname === b.pathname && b.protocol === 'http:';
  } catch {
    return false;
  }
}

export async function register(req: IncomingMessage, res: ServerResponse, body: string): Promise<void> {
  let data: { redirect_uris?: string[]; client_name?: string };
  try {
    data = JSON.parse(body);
  } catch {
    return sendJson(res, 400, { error: 'invalid_client_metadata', error_description: 'JSON inválido' });
  }
  const uris = Array.isArray(data.redirect_uris) ? data.redirect_uris.filter((x) => typeof x === 'string') : [];
  if (!uris.length || !uris.every(redirectAllowed)) return sendJson(res, 400, { error: 'invalid_redirect_uri', error_description: 'Sólo se aceptan los callbacks de Claude.' });
  const client_id = newId('cli');
  const d = await db();
  await d.query('INSERT INTO smf.oauth_clients (client_id, name, redirect_uris) VALUES ($1,$2,$3::jsonb)', [client_id, String(data.client_name ?? '').slice(0, 100), j(uris)]);
  sendJson(res, 201, { client_id, client_name: data.client_name, redirect_uris: uris, token_endpoint_auth_method: 'none', grant_types: ['authorization_code', 'refresh_token'], response_types: ['code'] });
}

async function getClient(id: string): Promise<{ client_id: string; name: string; redirect_uris: string[] } | null> {
  const d = await db();
  const [c] = await d.query<{ client_id: string; name: string; redirect_uris: string[] }>('SELECT * FROM smf.oauth_clients WHERE client_id = $1', [id]);
  return c ?? null;
}

export async function authorizeGet(req: IncomingMessage, res: ServerResponse, q: URLSearchParams): Promise<void> {
  const err = await validarPedido(q);
  if (err) return send(res, 400, page('No se puede conectar', `<p>${html(err)}</p>`));
  const client = (await getClient(q.get('client_id')!))!;
  const host = new URL(q.get('redirect_uri')!).host;
  const hidden = ['client_id', 'redirect_uri', 'code_challenge', 'code_challenge_method', 'state', 'scope', 'resource'].map((k) => `<input type="hidden" name="${k}" value="${html(q.get(k) ?? '')}">`).join('');
  send(res, 200, page('Conectar Claude', `
    <h1>Conectar Claude con la Marketing Factory</h1>
    <p><b>${html(client.name || 'Un cliente de Claude')}</b> pide acceso para operar la Factory como <b>agente</b>: analizar productos, crear creativos, preparar y operar campañas dentro de la política, y pedir autorizaciones. <b>No puede aprobar autorizaciones de nivel 3</b> ni levantar la pausa general.</p>
    <p>Vuelve a: <code>${html(host)}</code></p>
    <form method="post" action="/oauth/authorize">${hidden}
      <label>Llave del dueño (SMF_OWNER_KEY)<input type="password" name="owner_key" autocomplete="current-password" required></label>
      <div class="row"><button name="decision" value="allow">Permitir</button><button name="decision" value="deny" class="ghost">Rechazar</button></div>
    </form>`));
}

async function validarPedido(q: URLSearchParams): Promise<string | null> {
  if (!config.publicUrl) return 'Falta SMF_PUBLIC_URL en el servidor.';
  if (!config.ownerKey) return 'Falta SMF_OWNER_KEY en el servidor.';
  if (q.get('response_type') && q.get('response_type') !== 'code') return 'Sólo se admite response_type=code.';
  const client = q.get('client_id') ? await getClient(q.get('client_id')!) : null;
  if (!client) return 'Cliente desconocido. Volvé a agregar el conector.';
  const ru = q.get('redirect_uri') ?? '';
  if (!client.redirect_uris.some((r) => sameRedirect(r, ru))) return 'La dirección de retorno no coincide con la registrada.';
  if (!q.get('code_challenge') || q.get('code_challenge_method') !== 'S256') return 'Hace falta PKCE con S256.';
  return null;
}

export async function authorizePost(req: IncomingMessage, res: ServerResponse, body: string, ip: string): Promise<void> {
  const f = readForm(body);
  const err = await validarPedido(f);
  if (err) return send(res, 400, page('No se puede conectar', `<p>${html(err)}</p>`));
  const redirect = new URL(f.get('redirect_uri')!);
  if (f.get('state')) redirect.searchParams.set('state', f.get('state')!);
  if (f.get('decision') !== 'allow') {
    redirect.searchParams.set('error', 'access_denied');
    res.writeHead(302, { Location: redirect.toString() });
    return void res.end();
  }
  if (tooMany(`oauth:${ip}`)) return send(res, 429, page('Demasiados intentos', '<p>Esperá 15 minutos.</p>'));
  if (!safeEqual(f.get('owner_key') ?? '', config.ownerKey)) {
    await audit({ actor: 'anon', action: 'oauth.authorize', decision: 'denied', details: { ip, reason: 'llave incorrecta' } });
    return send(res, 401, page('Llave incorrecta', '<p>La llave del dueño no coincide. <a href="javascript:history.back()">Volver</a></p>'));
  }
  const code = token(32);
  const d = await db();
  await d.query(`INSERT INTO smf.oauth_codes (code_hash, client_id, redirect_uri, code_challenge, scope, expires_at) VALUES ($1,$2,$3,$4,$5, now() + interval '5 minutes')`, [sha256(code), f.get('client_id'), f.get('redirect_uri'), f.get('code_challenge'), f.get('scope') || 'smf']);
  await audit({ actor: 'owner', action: 'oauth.authorize', decision: 'allowed', target: f.get('client_id')!, details: { redirect: redirect.host } });
  redirect.searchParams.set('code', code);
  res.writeHead(302, { Location: redirect.toString() });
  res.end();
}

async function issue(clientId: string, scope: string) {
  const d = await db();
  const access = token(32);
  const refresh = token(32);
  await d.query(`INSERT INTO smf.oauth_tokens (token_hash, kind, client_id, scope, expires_at) VALUES ($1,'access',$2,$3, now() + ($4 || ' seconds')::interval), ($5,'refresh',$2,$3, now() + ($6 || ' seconds')::interval)`, [sha256(access), clientId, scope, String(ACCESS_TTL), sha256(refresh), String(REFRESH_TTL)]);
  return { access_token: access, token_type: 'Bearer', expires_in: ACCESS_TTL, refresh_token: refresh, scope };
}

export async function tokenEndpoint(req: IncomingMessage, res: ServerResponse, body: string): Promise<void> {
  const f = (req.headers['content-type'] ?? '').includes('application/json') ? new URLSearchParams(JSON.parse(body || '{}')) : readForm(body);
  const d = await db();
  const fail = (code: string, desc: string) => sendJson(res, 400, { error: code, error_description: desc });
  const grant = f.get('grant_type');
  if (grant === 'authorization_code') {
    const [c] = await d.query<{ client_id: string; redirect_uri: string; code_challenge: string; scope: string; expires_at: string; used: boolean }>('SELECT * FROM smf.oauth_codes WHERE code_hash = $1', [sha256(f.get('code') ?? '')]);
    if (!c || c.used || new Date(c.expires_at) < new Date()) return fail('invalid_grant', 'código inválido o vencido');
    if (c.client_id !== f.get('client_id')) return fail('invalid_grant', 'el código es de otro cliente');
    if (!sameRedirect(c.redirect_uri, f.get('redirect_uri') ?? '')) return fail('invalid_grant', 'redirect_uri no coincide');
    const verifier = f.get('code_verifier') ?? '';
    const challenge = createHash('sha256').update(verifier).digest('base64url');
    if (!verifier || challenge !== c.code_challenge) return fail('invalid_grant', 'PKCE no coincide');
    await d.query('UPDATE smf.oauth_codes SET used = true WHERE code_hash = $1', [sha256(f.get('code')!)]);
    return sendJson(res, 200, await issue(c.client_id, c.scope), { 'Cache-Control': 'no-store' });
  }
  if (grant === 'refresh_token') {
    const h = sha256(f.get('refresh_token') ?? '');
    const [t] = await d.query<{ client_id: string; scope: string; expires_at: string; revoked: boolean }>(`SELECT * FROM smf.oauth_tokens WHERE token_hash = $1 AND kind = 'refresh'`, [h]);
    if (!t || t.revoked || new Date(t.expires_at) < new Date()) return fail('invalid_grant', 'refresh token inválido');
    if (f.get('client_id') && f.get('client_id') !== t.client_id) return fail('invalid_grant', 'refresh token de otro cliente');
    // Rotación: el refresh token viejo deja de servir en la misma respuesta.
    await d.query('UPDATE smf.oauth_tokens SET revoked = true WHERE token_hash = $1', [h]);
    return sendJson(res, 200, await issue(t.client_id, t.scope), { 'Cache-Control': 'no-store' });
  }
  return fail('unsupported_grant_type', 'grant_type no soportado');
}

/** Valida un token de acceso emitido por este servidor. */
export async function accessTokenValid(tok: string): Promise<boolean> {
  if (!tok) return false;
  const d = await db();
  const [t] = await d.query<{ expires_at: string; revoked: boolean }>(`SELECT expires_at, revoked FROM smf.oauth_tokens WHERE token_hash = $1 AND kind = 'access'`, [sha256(tok)]);
  return !!t && !t.revoked && new Date(t.expires_at) > new Date();
}

export async function revokeAll(): Promise<number> {
  const d = await db();
  const r = await d.query<{ token_hash: string }>('UPDATE smf.oauth_tokens SET revoked = true WHERE revoked = false RETURNING token_hash');
  return r.length;
}
