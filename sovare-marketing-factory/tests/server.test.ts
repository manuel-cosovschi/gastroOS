import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { createHash, randomBytes } from 'node:crypto';
import type { Server } from 'node:http';

const OWNER = 'llave-del-duenio-de-prueba-123456';
const API = 'token-de-api-de-prueba-1234567890';
let base = '';
let server: Server;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let m: Record<string, any>;

before(async () => {
  Object.assign(process.env, { SMF_OWNER_KEY: OWNER, SMF_API_TOKEN: API, SMF_SIGNING_SECRET: 'firma-de-prueba-123456789012345', SMF_INGEST_SECRET: 'ingesta-de-prueba', SMF_PUBLIC_URL: 'https://factory.example' });
  m = { ...(await import('../src/db/index.ts')), ...(await import('../src/server/http.ts')), ...(await import('../src/conversion/events.ts')), ...(await import('../src/core/policy.ts')) };
  await m.openTestDb();
  server = m.createApp();
  await new Promise<void>((r) => server.listen(0, '127.0.0.1', r));
  base = `http://127.0.0.1:${(server.address() as { port: number }).port}`;
});
after(async () => {
  server?.close();
  await m.closeDb();
});

const post = (p: string, body: unknown, headers: Record<string, string> = {}) =>
  fetch(base + p, { method: 'POST', redirect: 'manual', headers: { 'content-type': 'application/json', ...headers }, body: typeof body === 'string' ? body : JSON.stringify(body) });
const form = (p: string, data: Record<string, string>, headers: Record<string, string> = {}) =>
  fetch(base + p, { method: 'POST', redirect: 'manual', headers: { 'content-type': 'application/x-www-form-urlencoded', ...headers }, body: new URLSearchParams(data).toString() });

let access = '';
let refresh = '';

test('health público y MCP protegido con el puntero de OAuth', async () => {
  assert.equal((await fetch(`${base}/healthz`)).status, 200);
  const r = await post('/mcp', { jsonrpc: '2.0', id: 1, method: 'tools/list' });
  assert.equal(r.status, 401);
  assert.match(r.headers.get('www-authenticate') ?? '', /resource_metadata="https:\/\/factory\.example\/\.well-known\/oauth-protected-resource"/);
  const pr = await (await fetch(`${base}/.well-known/oauth-protected-resource`)).json();
  assert.equal(pr.resource, 'https://factory.example/mcp');
  const as = await (await fetch(`${base}/.well-known/oauth-authorization-server`)).json();
  assert.deepEqual(as.code_challenge_methods_supported, ['S256']);
  assert.ok(as.registration_endpoint);
});

test('OAuth como lo hace Claude: DCR, consentimiento con la llave, PKCE y rotación', async () => {
  const malo = await post('/oauth/register', { client_name: 'x', redirect_uris: ['https://evil.example/cb'] });
  assert.equal(malo.status, 400);
  const reg = await (await post('/oauth/register', { client_name: 'Claude', redirect_uris: ['https://claude.ai/api/mcp/auth_callback'] })).json();
  assert.ok(reg.client_id);
  const verifier = randomBytes(32).toString('base64url');
  const challenge = createHash('sha256').update(verifier).digest('base64url');
  const q = { response_type: 'code', client_id: reg.client_id, redirect_uri: 'https://claude.ai/api/mcp/auth_callback', code_challenge: challenge, code_challenge_method: 'S256', state: 'st4te', scope: 'smf', resource: 'https://factory.example/mcp' };
  const pagina = await fetch(`${base}/oauth/authorize?${new URLSearchParams(q)}`);
  assert.equal(pagina.status, 200);
  assert.match(await pagina.text(), /No puede aprobar autorizaciones de nivel 3/);
  assert.equal((await form('/oauth/authorize', { ...q, decision: 'allow', owner_key: 'mal' })).status, 401);
  const ok = await form('/oauth/authorize', { ...q, decision: 'allow', owner_key: OWNER });
  assert.equal(ok.status, 302);
  const loc = new URL(ok.headers.get('location')!);
  assert.equal(loc.origin + loc.pathname, 'https://claude.ai/api/mcp/auth_callback');
  assert.equal(loc.searchParams.get('state'), 'st4te');
  const code = loc.searchParams.get('code')!;
  const malVerif = await form('/oauth/token', { grant_type: 'authorization_code', code, redirect_uri: q.redirect_uri, client_id: reg.client_id, code_verifier: 'otro' });
  assert.equal((await malVerif.json()).error, 'invalid_grant');
  // El código no se quemó por el intento fallido de verificación: sigue sirviendo una vez.
  const tk = await (await form('/oauth/token', { grant_type: 'authorization_code', code, redirect_uri: q.redirect_uri, client_id: reg.client_id, code_verifier: verifier })).json();
  assert.ok(tk.access_token && tk.refresh_token, JSON.stringify(tk));
  const otraVez = await (await form('/oauth/token', { grant_type: 'authorization_code', code, redirect_uri: q.redirect_uri, client_id: reg.client_id, code_verifier: verifier })).json();
  assert.equal(otraVez.error, 'invalid_grant', 'un código se usa una sola vez');
  const rot = await (await form('/oauth/token', { grant_type: 'refresh_token', refresh_token: tk.refresh_token, client_id: reg.client_id })).json();
  assert.ok(rot.access_token);
  const vieja = await (await form('/oauth/token', { grant_type: 'refresh_token', refresh_token: tk.refresh_token, client_id: reg.client_id })).json();
  assert.equal(vieja.error, 'invalid_grant', 'el refresh viejo dejó de servir');
  access = rot.access_token;
  refresh = rot.refresh_token;
  assert.ok(refresh);
});

async function mcp(method: string, params: unknown, tok = access) {
  const r = await post('/mcp', { jsonrpc: '2.0', id: Math.floor(Math.random() * 1e6), method, params }, { authorization: `Bearer ${tok}`, accept: 'application/json, text/event-stream', 'mcp-protocol-version': '2025-06-18' });
  assert.equal(r.status, 200, await r.clone().text());
  return r.json();
}

test('MCP: initialize, lista de herramientas y llamadas reales', async () => {
  const init = await mcp('initialize', { protocolVersion: '2025-06-18', capabilities: {}, clientInfo: { name: 'prueba', version: '1' } });
  assert.equal(init.result.serverInfo.name, 'sovare-marketing-factory');
  const tools = await mcp('tools/list', {});
  const names = tools.result.tools.map((t: { name: string }) => t.name);
  for (const n of ['smf_status', 'smf_marketing_run', 'smf_campaign_launch', 'smf_pause_all', 'smf_approval_request', 'smf_performance']) assert.ok(names.includes(n), n);
  assert.ok(!names.some((n: string) => /approve|decide|release/.test(n)), 'no hay herramienta para aprobar ni levantar la pausa');
  const st = await mcp('tools/call', { name: 'smf_status', arguments: {} });
  const body = JSON.parse(st.result.content[0].text);
  assert.equal(body.mode, 'test');
  const prods = await mcp('tools/call', { name: 'smf_products_list', arguments: {} });
  assert.match(prods.result.content[0].text, /gastroos/);
});

test('MCP: el agente pide una autorización y no recibe el link firmado', async () => {
  const r = await mcp('tools/call', { name: 'smf_approval_request', arguments: { action: 'channel.activate', summary: 'Activar Instagram para publicar orgánico', scope: { channel: 'instagram' } } });
  const out = JSON.parse(r.result.content[0].text);
  assert.ok(out.id);
  const todo = JSON.stringify(await mcp('tools/call', { name: 'smf_alerts_list', arguments: {} })) + JSON.stringify(r);
  assert.ok(!/approvals\/apr_[0-9a-f]+\?t=/.test(todo), 'el link firmado no le llega al agente');
});

test('API con el token de máquina', async () => {
  const r = await post('/api/ops/status', {}, { authorization: `Bearer ${API}` });
  assert.equal(r.status, 200);
  const bad = await post('/api/ops/status', {}, { authorization: 'Bearer nop' });
  assert.equal(bad.status, 401);
  const inval = await post('/api/ops/campaign_budget', { campaign: 'x' }, { authorization: `Bearer ${API}` });
  assert.equal(inval.status, 400);
});

test('eventos firmados de un producto', async () => {
  const body = JSON.stringify({ product: 'alojaos', type: 'lead', event_id: 'alojaos:consulta:prueba-1', attribution: { utm_source: 'meta' } });
  const h = m.signBody(body, 'ingesta-de-prueba');
  const r = await post('/api/events', body, h);
  assert.equal(r.status, 200);
  assert.equal((await r.json()).stored, true);
  const sinFirma = await post('/api/events', body);
  assert.equal(sinFirma.status, 401);
});

test('panel: login, CSRF y decisión de una autorización por el dueño', async () => {
  assert.equal((await form('/panel/login', { key: 'mal' })).status, 401);
  const r = await form('/panel/login', { key: OWNER });
  assert.equal(r.status, 303);
  const cookie = r.headers.get('set-cookie')!.split(';')[0];
  const home = await fetch(`${base}/panel`, { headers: { cookie } });
  const h = await home.text();
  assert.match(h, /Productos/);
  assert.match(h, /Modo de prueba/);
  const aps = await (await fetch(`${base}/panel/approvals`, { headers: { cookie } })).text();
  const csrf = aps.match(/name="csrf" value="([0-9a-f]+)"/)![1];
  const id = aps.match(/action="\/panel\/approvals\/(apr_[0-9a-f]+)"/)![1];
  assert.equal((await form(`/panel/approvals/${id}`, { decision: 'approve' }, { cookie })).status, 403, 'sin CSRF no');
  assert.equal((await form(`/panel/approvals/${id}`, { decision: 'approve', csrf }, { cookie })).status, 303);
  const pol = await m.listApprovals();
  assert.ok(pol.find((a: { id: string; status: string }) => a.id === id)?.status !== 'pending');
});
