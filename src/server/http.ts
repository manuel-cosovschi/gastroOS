/**
 * El servicio HTTP.
 *
 *   GET  /healthz                         público, mínimo (para el hosting)
 *   POST /mcp                             MCP para Claude (OAuth o SMF_API_TOKEN)
 *   POST /api/ops/<operación>             la misma lista de operaciones (Bearer)
 *   GET  /api/ops                         qué operaciones hay
 *   POST /api/events                      eventos de los productos (firma HMAC)
 *   POST /api/tick                        una pasada del scheduler (Bearer), para cron externo
 *   /.well-known/…, /oauth/…              OAuth para el conector de Claude
 *   /panel, /approvals/…, /media/…        panel del dueño
 */

import { createServer, type IncomingMessage, type Server, type ServerResponse } from 'node:http';
import { config } from '../config.ts';
import { safeEqual } from '../core/util.ts';
import { OPS, runOp } from '../ops.ts';
import { recordEvent, sanitize, verifySignature } from '../conversion/events.ts';
import { health, tick } from '../runtime/worker.ts';
import { handleMcp } from './mcp.ts';
import { accessTokenValid, authorizeGet, authorizePost, authServerMetadata, protectedResourceMetadata, register, resourceMetadataUrl, tokenEndpoint } from './oauth.ts';
import { handlePanel } from './panel.ts';
import { clientIp, readBody, send, sendJson } from './util.ts';

async function bearerOk(req: IncomingMessage): Promise<boolean> {
  const h = String(req.headers.authorization ?? '');
  const tok = h.startsWith('Bearer ') ? h.slice(7).trim() : '';
  if (!tok) return false;
  if (config.apiToken && config.apiToken.length >= 24 && safeEqual(tok, config.apiToken)) return true;
  return accessTokenValid(tok);
}

function unauthorized(res: ServerResponse): void {
  res.writeHead(401, { 'Content-Type': 'application/json', 'WWW-Authenticate': `Bearer resource_metadata="${resourceMetadataUrl()}", scope="smf"` });
  res.end(JSON.stringify({ error: 'unauthorized', error_description: 'Falta un token válido.' }));
}

export function createApp(): Server {
  return createServer(async (req, res) => {
    const url = new URL(req.url ?? '/', 'http://local');
    const p = url.pathname;
    const m = req.method ?? 'GET';
    try {
      if (p === '/healthz') return sendJson(res, 200, { ok: true });
      if (m === 'GET' && (p === '/.well-known/oauth-protected-resource' || p === '/.well-known/oauth-protected-resource/mcp')) return sendJson(res, 200, protectedResourceMetadata());
      if (m === 'GET' && (p === '/.well-known/oauth-authorization-server' || p === '/.well-known/openid-configuration')) return sendJson(res, 200, authServerMetadata());
      if (p === '/oauth/register' && m === 'POST') return register(req, res, await readBody(req, 20_000));
      if (p === '/oauth/authorize' && m === 'GET') return authorizeGet(req, res, url.searchParams);
      if (p === '/oauth/authorize' && m === 'POST') return authorizePost(req, res, await readBody(req, 20_000), clientIp(req));
      if (p === '/oauth/token' && m === 'POST') return tokenEndpoint(req, res, await readBody(req, 20_000));

      if (p === '/mcp') {
        if (!(await bearerOk(req))) return unauthorized(res);
        if (m === 'GET' || m === 'DELETE') return sendJson(res, 405, { error: 'Este servidor MCP no mantiene sesiones: usar POST.' }, { Allow: 'POST' });
        const raw = await readBody(req);
        return handleMcp(req, res, raw ? JSON.parse(raw) : undefined);
      }

      if (p === '/api/events' && m === 'POST') {
        const raw = await readBody(req, 100_000);
        const ev = sanitize(verifySignature(raw, { signature: String(req.headers['x-smf-signature'] ?? ''), timestamp: String(req.headers['x-smf-timestamp'] ?? '') }));
        return sendJson(res, 200, await recordEvent(ev, 'push'));
      }

      if (p.startsWith('/api/')) {
        if (!(await bearerOk(req))) return unauthorized(res);
        if (p === '/api/ops' && m === 'GET') return sendJson(res, 200, OPS.map((o) => ({ name: o.name, title: o.title, description: o.description, readOnly: !!o.readOnly })));
        if (p === '/api/health') return sendJson(res, 200, await health());
        if (p === '/api/tick' && m === 'POST') return sendJson(res, 200, await tick({ caps: (url.searchParams.get('caps') ?? 'light,any').split(','), budgetMs: Number(url.searchParams.get('budget_ms') ?? 50_000) }));
        const mm = p.match(/^\/api\/ops\/([a-z_]+)$/);
        if (mm && m === 'POST') {
          const raw = await readBody(req);
          return sendJson(res, 200, { ok: true, result: await runOp(mm[1], raw ? JSON.parse(raw) : {}, 'agent') });
        }
        return sendJson(res, 404, { error: 'no existe' });
      }

      const body = m === 'POST' ? await readBody(req, 200_000) : '';
      if (await handlePanel(req, res, url, body)) return;
      if (p === '/') {
        res.writeHead(302, { Location: '/panel' });
        return void res.end();
      }
      send(res, 404, 'No existe.');
    } catch (e) {
      const err = e as { message?: string; code?: string; details?: unknown };
      const status = ['bad_signature', 'bad_timestamp', 'forbidden'].includes(err.code ?? '') ? 401 : ['not_found'].includes(err.code ?? '') ? 404 : ['denied', 'needs_approval'].includes(err.code ?? '') ? 403 : err.code ? 400 : 500;
      if (status === 500) console.error('[http]', e);
      if (!res.headersSent) sendJson(res, status, { ok: false, error: err.message ?? String(e), code: err.code, details: err.details });
      else res.end();
    }
  });
}
