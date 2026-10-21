/**
 * La cola de trabajos, en Postgres.
 *
 * - `enqueue` con `key` es idempotente: la misma clave no se encola dos veces
 *   (por ejemplo, el mismo cron en el mismo minuto desde dos ejecutores).
 * - `claim` toma trabajos con `FOR UPDATE SKIP LOCKED`: varios ejecutores
 *   (el servicio, GitHub Actions) pueden correr a la vez sin pisarse.
 * - Un trabajo que falla se reintenta con espera creciente hasta
 *   `max_attempts`; después queda `dead` y avisa.
 * - Un trabajo que quedó tomado por un ejecutor que murió se libera solo cuando
 *   vence su `locked_until`.
 */

import { db, j } from '../db/index.ts';
import { newId } from '../core/util.ts';

export type Needs = 'any' | 'light' | 'render';

export interface Job {
  id: string;
  type: string;
  payload: Record<string, unknown>;
  run_at: string;
  status: 'queued' | 'running' | 'done' | 'failed' | 'dead' | 'cancelled';
  attempts: number;
  max_attempts: number;
  idempotency_key: string | null;
  needs: Needs;
  locked_by: string | null;
  last_error: string | null;
  result: unknown;
  created_at: string;
  started_at: string | null;
  finished_at: string | null;
}

export async function enqueue(type: string, payload: Record<string, unknown> = {}, opts: { key?: string; runAt?: Date; maxAttempts?: number; needs?: Needs } = {}): Promise<{ id: string; created: boolean }> {
  const d = await db();
  const id = newId('job');
  const rows = await d.query<{ id: string }>(
    `INSERT INTO smf.jobs (id, type, payload, run_at, max_attempts, idempotency_key, needs) VALUES ($1,$2,$3::jsonb,$4,$5,$6,$7)
     ON CONFLICT (idempotency_key) DO NOTHING RETURNING id`,
    [id, type, j(payload), (opts.runAt ?? new Date()).toISOString(), opts.maxAttempts ?? 3, opts.key ?? null, opts.needs ?? 'any']
  );
  if (rows.length) return { id, created: true };
  const [ex] = await d.query<{ id: string }>('SELECT id FROM smf.jobs WHERE idempotency_key = $1', [opts.key]);
  return { id: ex.id, created: false };
}

export async function claim(worker: string, caps: string[], leaseSeconds = 900): Promise<Job | null> {
  const d = await db();
  return d.tx(async (t) => {
    const rows = await t.query<Job>(
      `SELECT * FROM smf.jobs
       WHERE ((status = 'queued' AND run_at <= now()) OR (status = 'running' AND locked_until < now()))
         AND needs = ANY($1::text[])
       ORDER BY run_at LIMIT 1 FOR UPDATE SKIP LOCKED`,
      [caps]
    );
    if (!rows.length) return null;
    const [job] = await t.query<Job>(
      `UPDATE smf.jobs SET status = 'running', locked_by = $2, locked_until = now() + ($3 || ' seconds')::interval, attempts = attempts + 1, started_at = now()
       WHERE id = $1 RETURNING *`,
      [rows[0].id, worker, String(leaseSeconds)]
    );
    return job;
  });
}

export async function complete(id: string, result: unknown): Promise<void> {
  const d = await db();
  await d.query(`UPDATE smf.jobs SET status = 'done', result = $2::jsonb, finished_at = now(), locked_until = NULL, last_error = NULL WHERE id = $1`, [id, j(result ?? null)]);
}

/** Devuelve true si el trabajo quedó muerto (agotó los intentos). */
export async function fail(job: Job, error: string, { retryable = true } = {}): Promise<boolean> {
  const d = await db();
  const muerto = !retryable || job.attempts >= job.max_attempts;
  const espera = Math.min(3600, 30 * 4 ** (job.attempts - 1));
  await d.query(
    `UPDATE smf.jobs SET status = $2, last_error = $3, locked_until = NULL, finished_at = CASE WHEN $2 = 'dead' THEN now() ELSE NULL END,
       run_at = CASE WHEN $2 = 'queued' THEN now() + ($4 || ' seconds')::interval ELSE run_at END WHERE id = $1`,
    [job.id, muerto ? 'dead' : 'queued', error.slice(0, 2000), String(espera)]
  );
  return muerto;
}

export async function listJobs(filter: { status?: string; limit?: number } = {}): Promise<Job[]> {
  const d = await db();
  return d.query<Job>(
    `SELECT * FROM smf.jobs ${filter.status ? 'WHERE status = $2' : ''} ORDER BY created_at DESC LIMIT $1`,
    filter.status ? [filter.limit ?? 50, filter.status] : [filter.limit ?? 50]
  );
}

export async function getJob(id: string): Promise<Job | null> {
  const d = await db();
  const [r] = await d.query<Job>('SELECT * FROM smf.jobs WHERE id = $1', [id]);
  return r ?? null;
}

export async function cancelQueued(reason: string): Promise<number> {
  const d = await db();
  const r = await d.query<{ id: string }>(`UPDATE smf.jobs SET status = 'cancelled', last_error = $1 WHERE status = 'queued' RETURNING id`, [reason]);
  return r.length;
}
