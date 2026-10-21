import type { IncomingMessage, ServerResponse } from 'node:http';

export const html = (s: unknown) => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

export function send(res: ServerResponse, status: number, body: string, headers: Record<string, string> = {}): void {
  res.writeHead(status, { 'Content-Type': 'text/html; charset=utf-8', 'X-Frame-Options': 'DENY', 'Referrer-Policy': 'no-referrer', 'X-Content-Type-Options': 'nosniff', ...headers });
  res.end(body);
}

export function sendJson(res: ServerResponse, status: number, body: unknown, headers: Record<string, string> = {}): void {
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'X-Content-Type-Options': 'nosniff', ...headers });
  res.end(JSON.stringify(body, null, 2));
}

export async function readBody(req: IncomingMessage, max = 2_000_000): Promise<string> {
  const chunks: Buffer[] = [];
  let n = 0;
  for await (const c of req) {
    n += (c as Buffer).length;
    if (n > max) throw new Error('cuerpo demasiado grande');
    chunks.push(c as Buffer);
  }
  return Buffer.concat(chunks).toString('utf8');
}

export const readForm = (body: string) => new URLSearchParams(body);

export function cookies(req: IncomingMessage): Record<string, string> {
  return Object.fromEntries((req.headers.cookie ?? '').split(';').map((c) => c.trim().split('=')).filter((x) => x[0]).map(([k, ...v]) => [k, decodeURIComponent(v.join('='))]));
}

export function clientIp(req: IncomingMessage): string {
  return String(req.headers['x-forwarded-for'] ?? '').split(',')[0].trim() || req.socket.remoteAddress || '?';
}

/** Freno de intentos de la llave del dueño: 8 cada 15 minutos por origen. */
const intentos = new Map<string, number[]>();
export function tooMany(key: string, max = 8, windowMs = 15 * 60_000): boolean {
  const now = Date.now();
  const l = (intentos.get(key) ?? []).filter((t) => now - t < windowMs);
  l.push(now);
  intentos.set(key, l);
  return l.length > max;
}

const CSS = `
:root{--bg:#f6f5f1;--card:#fff;--ink:#16201c;--soft:#5d6a64;--line:#e3e0d8;--acc:#1f6f5c;--warn:#b25b12;--bad:#b42318;--ok:#1d7a45}
@media (prefers-color-scheme:dark){:root{--bg:#0f1513;--card:#161e1b;--ink:#e9eee9;--soft:#9aa8a1;--line:#26312c;--acc:#5cc4a3;--warn:#e0a35a;--bad:#f2786d;--ok:#5fcf8c}}
*{box-sizing:border-box}body{margin:0;font:15px/1.5 system-ui,-apple-system,Segoe UI,Roboto,sans-serif;background:var(--bg);color:var(--ink)}
header{display:flex;gap:16px;align-items:center;justify-content:space-between;padding:14px 20px;border-bottom:1px solid var(--line);background:var(--card);position:sticky;top:0;z-index:2;flex-wrap:wrap}
header b{font-size:16px}nav{display:flex;gap:14px;flex-wrap:wrap}nav a{color:var(--soft);text-decoration:none}nav a:hover{color:var(--ink)}
main{max-width:1180px;margin:0 auto;padding:20px 16px 60px}h1{font-size:22px;margin:0 0 12px}h2{font-size:17px;margin:28px 0 10px}
.grid{display:grid;gap:12px;grid-template-columns:repeat(auto-fill,minmax(210px,1fr))}.card{background:var(--card);border:1px solid var(--line);border-radius:12px;padding:14px}
.k{color:var(--soft);font-size:12px;text-transform:uppercase;letter-spacing:.05em}.v{font-size:22px;font-weight:700}
table{width:100%;border-collapse:collapse;background:var(--card);border:1px solid var(--line);border-radius:12px;overflow:hidden;font-size:14px}th,td{padding:8px 10px;border-bottom:1px solid var(--line);text-align:left;vertical-align:top}th{color:var(--soft);font-weight:600;font-size:12px;text-transform:uppercase}
.tw{overflow-x:auto}.pill{display:inline-block;padding:1px 8px;border-radius:99px;font-size:12px;border:1px solid var(--line)}.ok{color:var(--ok)}.bad{color:var(--bad)}.warn{color:var(--warn)}
button,.btn{background:var(--acc);color:#fff;border:0;border-radius:8px;padding:9px 14px;font:inherit;font-weight:600;cursor:pointer;text-decoration:none;display:inline-block}button.ghost{background:transparent;color:var(--ink);border:1px solid var(--line)}button.danger{background:var(--bad)}
form.inline{display:inline}label{display:block;margin:12px 0 4px;color:var(--soft)}input,textarea,select{width:100%;padding:9px;border:1px solid var(--line);border-radius:8px;background:var(--bg);color:var(--ink);font:inherit}textarea{font-family:ui-monospace,Menlo,monospace;font-size:13px;min-height:220px}
.row{display:flex;gap:10px;margin-top:14px;flex-wrap:wrap}code{font-size:13px}.banner{padding:12px 14px;border-radius:10px;margin:0 0 14px;border:1px solid var(--line)}.banner.bad{background:color-mix(in srgb,var(--bad) 12%,transparent)}.banner.warn{background:color-mix(in srgb,var(--warn) 12%,transparent)}
.thumbs{display:grid;gap:12px;grid-template-columns:repeat(auto-fill,minmax(150px,1fr))}.thumbs img{width:100%;border-radius:8px;border:1px solid var(--line);display:block;background:#000}
.narrow{max-width:520px;margin:60px auto}small{color:var(--soft)}`;

export function page(title: string, body: string, nav = ''): string {
  return `<!doctype html><html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex"><title>${html(title)} · Sovare Marketing Factory</title><style>${CSS}</style></head><body>${nav}<main${nav ? '' : ' class="narrow"'}>${body}</main></body></html>`;
}
