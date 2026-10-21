/**
 * Cliente de la Graph API de Meta (Marketing API, Instagram, Páginas, CAPI).
 *
 * Reglas:
 *   - Las LECTURAS van siempre a Meta si hay token, también en modo de prueba:
 *     verificar la cuenta o traer métricas no cambia nada.
 *   - Las ESCRITURAS reciben la decisión de `guard()`. Si es `dryRun`, no salen:
 *     se registran en `smf.api_calls` y se devuelve un id simulado (`dry_…`).
 *     Un id simulado nunca se confunde con uno real y nunca se informa como
 *     publicado.
 *   - Límites de uso: se lee `x-business-use-case-usage` / `x-app-usage` y se
 *     frena antes de llegar al tope; los errores de límite (4, 17, 32, 613,
 *     80000-80014) y los 5xx se reintentan con espera creciente.
 *   - El token nunca se escribe en logs ni en la base.
 */

import { readFileSync } from 'node:fs';
import { basename } from 'node:path';
import { config } from '../config.ts';
import { db, j } from '../db/index.ts';
import { redact } from '../core/audit.ts';
import type { Decision } from '../core/policy.ts';
import { sleep, SmfError, token as randomToken } from '../core/util.ts';

export const GRAPH_URL = () => (process.env.META_GRAPH_URL || 'https://graph.facebook.com').replace(/\/$/, '');
export const GRAPH_VIDEO_URL = () => (process.env.META_GRAPH_VIDEO_URL || process.env.META_GRAPH_URL || 'https://graph-video.facebook.com').replace(/\/$/, '');

export class MetaError extends SmfError {
  constructor(
    message: string,
    public status: number,
    public meta: { code?: number; error_subcode?: number; type?: string; error_user_msg?: string; fbtrace_id?: string } = {}
  ) {
    super(message, 'meta_error', { status, ...meta });
  }
}

const RETRYABLE = new Set([1, 2, 4, 17, 32, 341, 613]);
const isRateLimit = (code?: number) => code !== undefined && (RETRYABLE.has(code) || (code >= 80000 && code <= 80014));

export interface RequestOptions {
  /** La decisión de `guard()` para escrituras. Obligatoria si el método no es GET. */
  decision?: Decision;
  token?: string;
  /** Archivo para subir como multipart (campo `source`). */
  file?: string;
  video?: boolean;
  /** Prefijo del id simulado en modo de prueba. */
  dryKind?: string;
}

let ultimaPausa = 0;

export async function graph<T = Record<string, unknown>>(method: 'GET' | 'POST' | 'DELETE', path: string, params: Record<string, unknown> = {}, opts: RequestOptions = {}): Promise<T> {
  const write = method !== 'GET';
  if (write && !opts.decision) throw new SmfError(`Escritura a Meta sin pasar por guard(): ${method} ${path}`, 'unguarded');
  if (write && !opts.decision!.allowed) throw new SmfError(opts.decision!.reason, 'denied');

  const d = await db();
  if (write && opts.decision!.dryRun) {
    const id = `dry_${opts.dryKind ?? 'obj'}_${randomToken(6)}`;
    const response = simulated(path, id);
    await d.query('INSERT INTO smf.api_calls (service, method, path, dry_run, status, request, response) VALUES ($1,$2,$3,true,200,$4::jsonb,$5::jsonb)', [
      'meta', method, path, j(redact({ ...params, ...(opts.file ? { source: basename(opts.file) } : {}) })), j(response),
    ]);
    return response as T;
  }

  const tok = opts.token ?? config.meta.accessToken;
  if (!tok) throw new SmfError('Falta META_ACCESS_TOKEN: no hay conexión con Meta.', 'meta_not_configured');

  const base = opts.video ? GRAPH_VIDEO_URL() : GRAPH_URL();
  const url = new URL(`${base}/${config.meta.apiVersion}/${path.replace(/^\//, '')}`);
  let lastErr: unknown;
  for (let intento = 0; intento < 4; intento++) {
    if (Date.now() < ultimaPausa) await sleep(ultimaPausa - Date.now());
    let res: Response;
    try {
      const init: RequestInit = { method, signal: AbortSignal.timeout(opts.file ? 600_000 : 30_000), headers: { Authorization: `Bearer ${tok}` } };
      if (method === 'GET') {
        for (const [k, v] of Object.entries(params)) if (v !== undefined) url.searchParams.set(k, typeof v === 'string' ? v : JSON.stringify(v));
      } else if (opts.file) {
        const form = new FormData();
        for (const [k, v] of Object.entries(params)) if (v !== undefined) form.set(k, typeof v === 'string' ? v : JSON.stringify(v));
        form.set('source', new Blob([readFileSync(opts.file)]), basename(opts.file));
        init.body = form;
      } else {
        const body = new URLSearchParams();
        for (const [k, v] of Object.entries(params)) if (v !== undefined) body.set(k, typeof v === 'string' ? v : JSON.stringify(v));
        init.body = body;
      }
      res = await fetch(url, init);
    } catch (e) {
      lastErr = e;
      await sleep(1000 * 2 ** intento);
      continue;
    }
    vigilarUso(res.headers);
    const text = await res.text();
    let json: Record<string, unknown>;
    try {
      json = JSON.parse(text);
    } catch {
      json = { raw: text.slice(0, 500) };
    }
    if (write) {
      await d.query('INSERT INTO smf.api_calls (service, method, path, dry_run, status, request, response) VALUES ($1,$2,$3,false,$4,$5::jsonb,$6::jsonb)', [
        'meta', method, path, res.status, j(redact({ ...params, ...(opts.file ? { source: basename(opts.file) } : {}) })), j(redact(json)),
      ]);
    }
    if (res.ok && !json.error) return json as T;
    const err = (json.error ?? {}) as { message?: string; code?: number; error_subcode?: number; type?: string; error_user_msg?: string; fbtrace_id?: string };
    lastErr = new MetaError(err.error_user_msg || err.message || `Meta respondió ${res.status}`, res.status, err);
    if (res.status >= 500 || isRateLimit(err.code)) {
      await sleep(Math.min(60_000, 2000 * 3 ** intento));
      continue;
    }
    throw lastErr;
  }
  throw lastErr instanceof Error ? lastErr : new SmfError(String(lastErr), 'meta_error');
}

/** Todas las páginas de un listado (`paging.next`). */
export async function graphAll<T>(path: string, params: Record<string, unknown> = {}, max = 2000): Promise<T[]> {
  const out: T[] = [];
  let after: string | undefined;
  do {
    const r = await graph<{ data: T[]; paging?: { cursors?: { after?: string }; next?: string } }>('GET', path, { limit: 200, ...params, ...(after ? { after } : {}) });
    out.push(...(r.data ?? []));
    after = r.paging?.next ? r.paging.cursors?.after : undefined;
  } while (after && out.length < max);
  return out;
}

/** Si algún contador de uso pasa del 85%, se espera antes de la próxima llamada. */
function vigilarUso(h: Headers) {
  const crudos = [h.get('x-business-use-case-usage'), h.get('x-app-usage'), h.get('x-ad-account-usage')].filter(Boolean) as string[];
  for (const c of crudos) {
    try {
      const v = JSON.parse(c) as Record<string, unknown>;
      const filas = Object.values(v).flatMap((x) => (Array.isArray(x) ? x : [x])) as Record<string, number>[];
      const alto = Math.max(0, ...filas.flatMap((f) => [f.call_count, f.total_time, f.total_cputime, f.acc_id_util_pct].filter((n) => typeof n === 'number')));
      const espera = Math.max(0, ...filas.map((f) => Number(f.estimated_time_to_regain_access) || 0));
      if (espera > 0) ultimaPausa = Date.now() + Math.min(espera, 30) * 60_000;
      else if (alto >= 85) ultimaPausa = Date.now() + 60_000;
      else if (typeof v.call_count === 'number' && (v.call_count as number) >= 85) ultimaPausa = Date.now() + 60_000;
    } catch {
      /* cabecera con otro formato: no se frena */
    }
  }
}

function simulated(path: string, id: string): Record<string, unknown> {
  if (path.endsWith('/adimages')) return { images: { simulated: { hash: id } } };
  if (path.endsWith('/media_publish')) return { id };
  if (path.endsWith('/events')) return { events_received: 1, fbtrace_id: 'simulado' };
  return { id, success: true, simulated: true };
}

export const act = () => {
  if (!config.meta.adAccountId) throw new SmfError('Falta META_AD_ACCOUNT_ID.', 'meta_not_configured');
  return `act_${config.meta.adAccountId}`;
};

export const isSimulatedId = (id: string | null | undefined) => !!id && id.startsWith('dry_');
