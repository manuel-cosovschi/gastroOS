/**
 * Acceso a la base: Postgres en producción, PGlite (Postgres en WASM) en local y
 * en las pruebas. Es el mismo SQL en los dos, así que lo que se prueba acá es lo
 * que corre allá.
 */

import { AsyncLocalStorage } from 'node:async_hooks';
import { mkdirSync, readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { config, ROOT } from '../config.ts';

export interface Db {
  query<T = Record<string, unknown>>(sql: string, params?: unknown[]): Promise<T[]>;
  tx<T>(fn: (db: Db) => Promise<T>): Promise<T>;
  close(): Promise<void>;
  kind: 'postgres' | 'pglite';
}

/** Los objetos van a jsonb como texto: `$1::jsonb` en el SQL. */
export const j = (v: unknown): string => JSON.stringify(v ?? null);

let shared: Db | null = null;

export async function db(): Promise<Db> {
  if (!shared) {
    shared = config.databaseUrl ? await openPostgres(config.databaseUrl) : await openPglite(join(config.dataDir, 'pg'));
    await migrate(shared);
  }
  return shared;
}

/** Para las pruebas: una base nueva en memoria (o en la carpeta indicada). */
export async function openTestDb(dir?: string): Promise<Db> {
  const d = await openPglite(dir);
  await migrate(d);
  shared = d;
  return d;
}

export async function closeDb(): Promise<void> {
  if (shared) await shared.close();
  shared = null;
}

async function openPglite(dir?: string): Promise<Db> {
  const { PGlite } = await import('@electric-sql/pglite');
  if (dir) mkdirSync(dir, { recursive: true });
  const pg = dir ? new PGlite(dir) : new PGlite();
  await pg.waitReady;
  // PGlite es una sola conexión: las transacciones se serializan con una cola
  // para que un job no mezcle sus sentencias con las de otro.
  let cola: Promise<unknown> = Promise.resolve();
  const enCola = <T>(fn: () => Promise<T>): Promise<T> => {
    const p = cola.then(fn, fn);
    cola = p.catch(() => undefined);
    return p;
  };
  const make = (q: { query: typeof pg.query }): Db => ({
    kind: 'pglite',
    query: async <T,>(sql: string, params: unknown[] = []) => ((await q.query(sql, params)).rows as T[]),
    tx: (fn) => fn(make(q)),
    close: async () => undefined,
  });
  // Dentro de una transacción, cualquier consulta que llegue por la base
  // compartida (un `audit()` llamado desde un job, por ejemplo) tiene que ir por
  // esa misma transacción: PGlite no atiende otra cosa hasta que termine, y
  // esperar en la cola sería esperarse a sí mismo.
  const actual = new AsyncLocalStorage<Db>();
  const base: Db = {
    kind: 'pglite',
    query: <T,>(sql: string, params: unknown[] = []) => {
      const tx = actual.getStore();
      if (tx) return tx.query<T>(sql, params);
      return enCola(async () => (await pg.query(sql, params)).rows as T[]);
    },
    tx: <T,>(fn: (d: Db) => Promise<T>) => {
      const tx = actual.getStore();
      if (tx) return fn(tx);
      return enCola(() =>
        pg.transaction((t) => {
          const d = make(t as unknown as { query: typeof pg.query });
          return actual.run(d, () => fn(d));
        })
      );
    },
    close: () => pg.close(),
  };
  return base;
}

async function openPostgres(url: string): Promise<Db> {
  const postgres = (await import('postgres')).default;
  const sql = postgres(url, { max: 5, prepare: false, onnotice: () => undefined });
  type Q = { unsafe: (s: string, p?: unknown[]) => Promise<unknown> };
  // Igual que con PGlite: lo que se consulte durante una transacción va por
  // ella, así las escrituras de un job quedan todas o ninguna.
  const actual = new AsyncLocalStorage<Db>();
  const make = (q: Q): Db => ({
    kind: 'postgres',
    query: async <T,>(s: string, params: unknown[] = []) => [...((await q.unsafe(s, params as never[])) as T[])],
    tx: (fn) => fn(make(q)),
    close: () => sql.end(),
  });
  const root = make(sql as unknown as Q);
  return {
    ...root,
    query: <T,>(s: string, params: unknown[] = []) => (actual.getStore() ?? root).query<T>(s, params),
    tx: <T,>(fn: (d: Db) => Promise<T>) => {
      const tx = actual.getStore();
      if (tx) return fn(tx);
      return sql.begin((t) => {
        const d = make(t as unknown as Q);
        return actual.run(d, () => fn(d));
      }) as Promise<T>;
    },
  };
}

export async function migrate(d: Db): Promise<string[]> {
  const dir = join(ROOT, 'db', 'migrations');
  const files = readdirSync(dir).filter((f) => f.endsWith('.sql')).sort();
  await d.query('CREATE SCHEMA IF NOT EXISTS smf');
  await d.query('CREATE TABLE IF NOT EXISTS smf.migrations (name TEXT PRIMARY KEY, applied_at TIMESTAMPTZ NOT NULL DEFAULT now())');
  const done = new Set((await d.query<{ name: string }>('SELECT name FROM smf.migrations')).map((r) => r.name));
  const applied: string[] = [];
  for (const f of files) {
    if (done.has(f)) continue;
    const text = readFileSync(join(dir, f), 'utf8');
    await d.tx(async (t) => {
      for (const stmt of splitSql(text)) await t.query(stmt);
      await t.query('INSERT INTO smf.migrations (name) VALUES ($1)', [f]);
    });
    applied.push(f);
  }
  return applied;
}

/** Parte un archivo SQL en sentencias. Alcanza para estas migraciones (sin funciones $$). */
function splitSql(text: string): string[] {
  return text
    .split('\n')
    .filter((l) => !l.trim().startsWith('--'))
    .join('\n')
    .split(';')
    .map((s) => s.trim())
    .filter(Boolean);
}
