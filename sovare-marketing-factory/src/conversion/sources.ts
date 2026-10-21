/**
 * Lectura de leads y ventas desde las bases de los productos.
 *
 * Sin tocar el código de los productos: la Factory lee con una conexión de
 * SÓLO LECTURA (ver docs/PERMISOS.md para crear el rol) y convierte cada fila
 * en un evento con `event_id` estable, así leer dos veces no duplica nada.
 * Nunca selecciona columnas personales: sólo id, fechas, estado, plan, monto y
 * la atribución.
 *
 *   AlojaOS  public.consultas      → lead; estado «cliente» → customer;
 *                                    estado «descartada» → disqualified
 *   GastroOS sovare.clients        → lead (los que entraron por /conv)
 *            sovare.signups        → purchase (status «aprobado», con monto)
 *
 * Límite conocido: las contrataciones de GastroOS no guardan la campaña que
 * las trajo (sovare.signups no tiene columna de atribución), así que entran
 * como compras sin atribuir. docs/PENDIENTES.md tiene el cambio propuesto.
 */

import { config } from '../config.ts';
import { recordEvent, type IncomingEvent } from './events.ts';

type Row = Record<string, unknown>;

async function query(url: string, sql: string, params: unknown[]): Promise<Row[]> {
  const postgres = (await import('postgres')).default;
  const c = postgres(url, { max: 1, prepare: false, idle_timeout: 5, connection: { application_name: 'sovare-marketing-factory', default_transaction_read_only: 'on' } as never });
  try {
    return [...(await c.unsafe(sql, params as never[]))] as Row[];
  } finally {
    await c.end();
  }
}

/** «GastroOS /conv · meta / paid_social / camp / contenido» → UTM. */
export function parseGastroSource(source: string): Record<string, string> {
  const resto = source.replace(/^GastroOS \/conv · /, '');
  if (/^(directo|meta \(sin utm\)|google \(sin utm\)|referencia:)/.test(resto)) return resto.startsWith('meta') ? { utm_source: 'meta' } : {};
  const [utm_source, utm_medium, utm_campaign, utm_content] = resto.split(' / ').map((s) => s.trim());
  return Object.fromEntries(Object.entries({ utm_source, utm_medium, utm_campaign, utm_content }).filter(([, v]) => v)) as Record<string, string>;
}

export interface PullResult {
  product: string;
  read: number;
  stored: number;
  skipped?: string;
  error?: string;
}

export async function pullAlojaos(days = 30): Promise<PullResult> {
  const url = config.sources.alojaosDb;
  if (!url) return { product: 'alojaos', read: 0, stored: 0, skipped: 'sin ALOJAOS_DATABASE_URL' };
  try {
    const rows = await query(url, `SELECT id::text, creada, origen, estado FROM public.consultas WHERE creada >= now() - ($1 || ' days')::interval`, [String(days)]);
    let stored = 0;
    for (const r of rows) {
      const atrib = (r.origen ?? {}) as Record<string, string>;
      const base: Omit<IncomingEvent, 'type' | 'event_id'> = { product: 'alojaos', occurred_at: new Date(r.creada as string).toISOString(), attribution: atrib };
      const evs: IncomingEvent[] = [{ ...base, type: 'lead', event_id: `alojaos:consulta:${r.id}` }];
      if (r.estado === 'cliente') evs.push({ ...base, type: 'customer', event_id: `alojaos:consulta:${r.id}:cliente`, occurred_at: new Date().toISOString() });
      if (r.estado === 'descartada') evs.push({ ...base, type: 'disqualified', event_id: `alojaos:consulta:${r.id}:descartada`, occurred_at: new Date().toISOString() });
      for (const e of evs) if ((await recordEvent(e, 'pull')).stored) stored++;
    }
    return { product: 'alojaos', read: rows.length, stored };
  } catch (e) {
    return { product: 'alojaos', read: 0, stored: 0, error: e instanceof Error ? e.message : String(e) };
  }
}

export async function pullGastroos(days = 30): Promise<PullResult> {
  const url = config.sources.gastroosDb;
  if (!url) return { product: 'gastroos', read: 0, stored: 0, skipped: 'sin GASTROOS_DATABASE_URL' };
  try {
    const leads = await query(url, `SELECT id::text, created_at, source FROM sovare.clients WHERE source LIKE 'GastroOS /conv%' AND created_at >= now() - ($1 || ' days')::interval`, [String(days)]);
    const ventas = await query(url, `SELECT id::text, COALESCE(decided_at, created_at) AS at, plan, amount::float8 AS amount, currency FROM sovare.signups WHERE status = 'aprobado' AND COALESCE(decided_at, created_at) >= now() - ($1 || ' days')::interval`, [String(days)]);
    let stored = 0;
    for (const r of leads) {
      const e: IncomingEvent = { product: 'gastroos', type: 'lead', event_id: `gastroos:cliente:${r.id}`, occurred_at: new Date(r.created_at as string).toISOString(), attribution: parseGastroSource(String(r.source)) };
      if ((await recordEvent(e, 'pull')).stored) stored++;
    }
    for (const r of ventas) {
      const e: IncomingEvent = { product: 'gastroos', type: 'purchase', event_id: `gastroos:signup:${r.id}`, occurred_at: new Date(r.at as string).toISOString(), value: Number(r.amount), currency: String(r.currency ?? 'ARS'), plan: String(r.plan), attribution: {} };
      if ((await recordEvent(e, 'pull')).stored) stored++;
    }
    return { product: 'gastroos', read: leads.length + ventas.length, stored };
  } catch (e) {
    return { product: 'gastroos', read: 0, stored: 0, error: e instanceof Error ? e.message : String(e) };
  }
}

export async function pullAll(days = 30): Promise<PullResult[]> {
  return [await pullAlojaos(days), await pullGastroos(days)];
}
