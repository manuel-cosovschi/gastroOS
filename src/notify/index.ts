/**
 * Avisos.
 *
 * Todo queda como alerta en la base (el panel muestra todas), pero al dueño le
 * llega sólo lo que pidió: compras, consultas calificadas, autorizaciones
 * pendientes y problemas que requieren que haga algo. El resto no interrumpe.
 *
 * Canales: los que tengan credenciales cargadas (mail con Resend, Telegram,
 * un webhook —por ejemplo, n8n—). Si no hay ninguno, la alerta queda en el
 * panel y en la consola, y `doctor` lo marca.
 */

import { config } from '../config.ts';
import { db, j } from '../db/index.ts';
import { getMode } from '../core/settings.ts';
import { newId } from '../core/util.ts';

export type Severity = 'info' | 'warning' | 'action' | 'critical' | 'sale';

export type AlertKind =
  | 'purchase'
  | 'qualified_lead'
  | 'inquiry'
  | 'approval_needed'
  | 'integration_error'
  | 'tracking_problem'
  | 'campaign_rejected'
  | 'budget_alert'
  | 'runtime_failure'
  | 'optimization'
  | 'catalog_change'
  | 'report'
  | 'info';

/** Lo que interrumpe al dueño. Lo demás queda en el panel. */
const PUSH: Set<AlertKind> = new Set([
  'purchase',
  'qualified_lead',
  'inquiry',
  'approval_needed',
  'integration_error',
  'tracking_problem',
  'campaign_rejected',
  'budget_alert',
  'runtime_failure',
]);

export interface NotifyInput {
  kind: AlertKind;
  severity: Severity;
  title: string;
  body?: string;
  /** Misma clave = mismo aviso: no se repite. */
  dedupKey?: string;
  data?: Record<string, unknown>;
  /** Forzar el envío aunque el tipo no esté en la lista de los que interrumpen. */
  push?: boolean;
  /**
   * Texto que va SÓLO por los canales del dueño y no se guarda en la base (por
   * ejemplo, el link firmado de una autorización: la base la lee el agente).
   */
  privateSuffix?: string;
}

export interface NotifyResult {
  alertId: string | null;
  duplicate: boolean;
  delivered: { channel: string; ok: boolean; error?: string }[];
}

export async function notify(n: NotifyInput): Promise<NotifyResult> {
  const d = await db();
  const id = newId('alr');
  const rows = await d.query<{ id: string }>(
    `INSERT INTO smf.alerts (id, kind, severity, title, body, dedup_key, data) VALUES ($1,$2,$3,$4,$5,$6,$7::jsonb)
     ON CONFLICT (dedup_key) DO NOTHING RETURNING id`,
    [id, n.kind, n.severity, n.title, n.body ?? '', n.dedupKey ?? null, j(n.data ?? {})]
  );
  if (!rows.length) return { alertId: null, duplicate: true, delivered: [] };

  const delivered: NotifyResult['delivered'] = [];
  if (n.push ?? PUSH.has(n.kind)) {
    const prueba = (await getMode()) !== 'live' ? '[PRUEBA] ' : '';
    const titulo = `${prueba}${n.title}`;
    for (const ch of channels()) {
      try {
        await ch.send(titulo, `${n.body ?? ''}${n.privateSuffix ? `\n\n${n.privateSuffix}` : ''}`, n);
        delivered.push({ channel: ch.name, ok: true });
      } catch (e) {
        delivered.push({ channel: ch.name, ok: false, error: e instanceof Error ? e.message : String(e) });
      }
    }
    await d.query('UPDATE smf.alerts SET notified = $2::jsonb WHERE id = $1', [id, j(delivered)]);
  }
  console.log(`[aviso:${n.severity}] ${n.title}${delivered.length ? ` → ${delivered.map((x) => `${x.channel}:${x.ok ? 'ok' : 'error'}`).join(', ')}` : ''}`);
  return { alertId: id, duplicate: false, delivered };
}

interface Channel {
  name: string;
  send(title: string, body: string, n: NotifyInput): Promise<void>;
}

export function channels(): Channel[] {
  const c = config.notify;
  const out: Channel[] = [];
  if (c.resendKey && c.from && c.to) {
    out.push({
      name: 'email',
      async send(title, body) {
        const r = await fetch('https://api.resend.com/emails', {
          method: 'POST',
          headers: { Authorization: `Bearer ${c.resendKey}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({ from: c.from, to: [c.to], subject: title, text: body || title }),
          signal: AbortSignal.timeout(10_000),
        });
        if (!r.ok) throw new Error(`Resend ${r.status}: ${(await r.text()).slice(0, 200)}`);
      },
    });
  }
  if (c.telegramToken && c.telegramChat) {
    out.push({
      name: 'telegram',
      async send(title, body) {
        const r = await fetch(`https://api.telegram.org/bot${c.telegramToken}/sendMessage`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ chat_id: c.telegramChat, text: `${title}\n\n${body}`.slice(0, 4000), disable_web_page_preview: true }),
          signal: AbortSignal.timeout(10_000),
        });
        if (!r.ok) throw new Error(`Telegram ${r.status}`);
      },
    });
  }
  if (c.webhookUrl) {
    out.push({
      name: 'webhook',
      async send(title, body, n) {
        const r = await fetch(c.webhookUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ source: 'sovare-marketing-factory', kind: n.kind, severity: n.severity, title, body, data: n.data ?? {} }),
          signal: AbortSignal.timeout(10_000),
        });
        if (!r.ok) throw new Error(`Webhook ${r.status}`);
      },
    });
  }
  return out;
}

export async function listAlerts(opts: { status?: string; limit?: number } = {}) {
  const d = await db();
  return d.query(
    `SELECT id, kind, severity, title, body, status, created_at, notified FROM smf.alerts ${opts.status ? 'WHERE status = $2' : ''} ORDER BY created_at DESC LIMIT $1`,
    opts.status ? [opts.limit ?? 50, opts.status] : [opts.limit ?? 50]
  );
}

export async function ackAlert(id: string): Promise<void> {
  const d = await db();
  await d.query(`UPDATE smf.alerts SET status = 'acked' WHERE id = $1`, [id]);
}
