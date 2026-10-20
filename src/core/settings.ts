/**
 * Los ajustes que gobiernan qué puede hacer la Factory sola.
 *
 * Los valores por defecto son los más cerrados posibles: modo de prueba, ningún
 * canal activado, presupuesto cero y piloto automático apagado. Nada gasta ni
 * publica hasta que el dueño lo habilita explícitamente.
 */

import { db, j } from '../db/index.ts';

export type Mode = 'test' | 'live';

export interface KillSwitch {
  paused: boolean;
  reason?: string;
  at?: string;
  by?: string;
}

export interface Policy {
  /** Qué operaciones de nivel 2 puede ejecutar el sistema o el agente sin preguntar. */
  autopilot: {
    pause_underperformers: boolean;
    budget_rebalance: boolean;
    launch_approved_campaigns: boolean;
    publish_organic: boolean;
    start_experiments: boolean;
    create_paused_objects: boolean;
  };
  budget: {
    /** Tope de presupuesto diario sumando todas las campañas activas. */
    max_daily_total_ars: number;
    max_daily_per_campaign_ars: number;
    /** Cambio máximo de presupuesto por ajuste automático, en %. */
    max_change_pct: number;
  };
  /** Canales activados por el dueño (activar uno es nivel 3). */
  channels: { meta_ads: boolean; instagram: boolean; facebook: boolean };
  /** Productos cuyo primer lanzamiento con gasto real fue autorizado. */
  products_live: string[];
  /** Si true, no se lanzan campañas a un /conv sin píxel verificado. */
  require_pixel_for_conversion_campaigns: boolean;
}

export const DEFAULT_POLICY: Policy = {
  autopilot: {
    pause_underperformers: true,
    budget_rebalance: false,
    launch_approved_campaigns: false,
    publish_organic: false,
    start_experiments: false,
    create_paused_objects: true,
  },
  budget: { max_daily_total_ars: 0, max_daily_per_campaign_ars: 0, max_change_pct: 20 },
  channels: { meta_ads: false, instagram: false, facebook: false },
  products_live: [],
  require_pixel_for_conversion_campaigns: true,
};

export async function getSetting<T>(key: string, fallback: T): Promise<T> {
  const d = await db();
  const rows = await d.query<{ value: T }>('SELECT value FROM smf.settings WHERE key = $1', [key]);
  return rows.length ? rows[0].value : fallback;
}

/** Escritura cruda. Fuera de policy.ts no se usa: los cambios pasan por `guard`. */
export async function putSetting(key: string, value: unknown, by: string): Promise<void> {
  const d = await db();
  await d.query(
    `INSERT INTO smf.settings (key, value, updated_by) VALUES ($1, $2::jsonb, $3)
     ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_by = EXCLUDED.updated_by, updated_at = now()`,
    [key, j(value), by]
  );
}

export async function getMode(): Promise<Mode> {
  return (await getSetting<Mode>('mode', 'test')) === 'live' ? 'live' : 'test';
}

export async function getKillSwitch(): Promise<KillSwitch> {
  return getSetting<KillSwitch>('kill_switch', { paused: false });
}

export async function getPolicy(): Promise<Policy> {
  const p = await getSetting<Partial<Policy>>('policy', {});
  return {
    ...DEFAULT_POLICY,
    ...p,
    autopilot: { ...DEFAULT_POLICY.autopilot, ...(p.autopilot ?? {}) },
    budget: { ...DEFAULT_POLICY.budget, ...(p.budget ?? {}) },
    channels: { ...DEFAULT_POLICY.channels, ...(p.channels ?? {}) },
    products_live: p.products_live ?? [],
  };
}
