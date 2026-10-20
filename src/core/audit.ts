import { db, j } from '../db/index.ts';

export type Actor = 'owner' | 'agent' | 'system';

export interface AuditEntry {
  actor: Actor | string;
  action: string;
  decision: 'allowed' | 'denied' | 'needs_approval' | 'done' | 'failed' | 'dry_run' | 'info';
  tier?: number;
  target?: string;
  details?: Record<string, unknown>;
}

/** Registro de acciones importantes. Nunca debe tirar: un fallo de auditoría no frena la operación, pero se ve en consola. */
export async function audit(e: AuditEntry): Promise<void> {
  try {
    const d = await db();
    await d.query(
      'INSERT INTO smf.audit_log (actor, action, tier, decision, target, details) VALUES ($1,$2,$3,$4,$5,$6::jsonb)',
      [e.actor, e.action, e.tier ?? null, e.decision, e.target ?? null, j(redact(e.details ?? {}))]
    );
  } catch (err) {
    console.error('[audit] no se pudo registrar', e.action, err);
  }
}

const SECRET_KEYS = /token|secret|password|key|authorization|access_token/i;

/** Saca cualquier cosa que parezca un secreto antes de guardarla o mostrarla. */
export function redact<T>(v: T): T {
  if (Array.isArray(v)) return v.map(redact) as T;
  if (v && typeof v === 'object') {
    const out: Record<string, unknown> = {};
    for (const [k, val] of Object.entries(v as Record<string, unknown>)) {
      out[k] = SECRET_KEYS.test(k) && typeof val === 'string' ? '[redactado]' : redact(val);
    }
    return out as T;
  }
  if (typeof v === 'string') return v.replace(/access_token=[^&\s]+/g, 'access_token=[redactado]') as T;
  return v;
}
