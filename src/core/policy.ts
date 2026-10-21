/**
 * Los tres niveles de autorización, aplicados en código.
 *
 * Toda operación con efectos pasa por `guard()` antes de ejecutarse. No es una
 * recomendación para el agente: el cliente de Meta, el publicador orgánico y
 * los cambios de ajustes llaman a `guard()` y no hacen nada si dice que no.
 *
 *   Nivel 1 — autónomo: auditoría, borradores, creativos, métricas, reportes.
 *   Nivel 2 — dentro de reglas autorizadas: lanzar lo aprobado, pausar,
 *             ajustar presupuestos dentro de los topes, publicar orgánico.
 *   Nivel 3 — autorización explícita del dueño: primer gasto real de un
 *             producto, subir topes, activar canales, pasar a modo real,
 *             acciones destructivas, cambiar la política.
 *
 * Quién decide un nivel 3: sólo el actor `owner` (panel con la llave del
 * dueño, CLI con SMF_OWNER_KEY, o el link firmado que le llega por mail o
 * Telegram). El agente (Claude por MCP o la API) puede PEDIR una autorización,
 * nunca darla.
 */

import { db, j } from '../db/index.ts';
import { audit, type Actor } from './audit.ts';
import { getKillSwitch, getMode, getPolicy, putSetting, type KillSwitch, type Mode, type Policy } from './settings.ts';
import { hmac, newId, sha256, SmfError, token } from './util.ts';
import { config } from '../config.ts';

export type Tier = 1 | 2 | 3;

interface ActionDef {
  tier: Tier;
  /** Si tiene efectos fuera de la Factory (o cambia su comportamiento). */
  effects: boolean;
  /** Qué interruptor de piloto automático lo habilita para el agente/sistema. */
  autopilot?: keyof Policy['autopilot'];
  /** Qué canal tiene que estar activado. */
  channel?: keyof Policy['channels'];
  /** Se puede ejecutar aunque la pausa general esté activa (acciones que frenan). */
  safe?: boolean;
  /** No la frena la pausa general, pero conserva su nivel (levantar la pausa). */
  ignoresPause?: boolean;
  label: string;
}

export const ACTIONS: Record<string, ActionDef> = {
  // Nivel 1
  'catalog.sync': { tier: 1, effects: false, label: 'Sincronizar el catálogo' },
  'catalog.analyze': { tier: 1, effects: false, label: 'Analizar un producto' },
  'creative.generate': { tier: 1, effects: false, label: 'Generar conceptos y copys' },
  'creative.render': { tier: 1, effects: false, label: 'Renderizar creativos' },
  'campaign.prepare': { tier: 1, effects: false, label: 'Preparar un borrador de campaña' },
  'conv.verify': { tier: 1, effects: false, label: 'Verificar una página /conv' },
  'metrics.sync': { tier: 1, effects: false, label: 'Traer métricas' },
  'meta.read': { tier: 1, effects: false, label: 'Consultar Meta' },
  'report.generate': { tier: 1, effects: false, label: 'Generar un reporte' },
  'optimize.analyze': { tier: 1, effects: false, label: 'Analizar el rendimiento' },
  'events.ingest': { tier: 1, effects: false, label: 'Registrar un evento de conversión' },
  // Nivel 2
  'meta.objects.create': { tier: 2, effects: true, autopilot: 'create_paused_objects', channel: 'meta_ads', label: 'Crear campaña/anuncios en Meta (pausados)' },
  'meta.media.upload': { tier: 2, effects: true, autopilot: 'create_paused_objects', channel: 'meta_ads', label: 'Subir creativos a Meta' },
  'meta.launch': { tier: 2, effects: true, autopilot: 'launch_approved_campaigns', channel: 'meta_ads', label: 'Activar una campaña aprobada' },
  'meta.pause': { tier: 2, effects: true, safe: true, label: 'Pausar campañas o anuncios' },
  'meta.budget.change': { tier: 2, effects: true, autopilot: 'budget_rebalance', channel: 'meta_ads', label: 'Ajustar presupuesto dentro de los topes' },
  'meta.ad.pause_underperformer': { tier: 2, effects: true, safe: true, autopilot: 'pause_underperformers', label: 'Pausar un anuncio de bajo rendimiento' },
  'experiment.start': { tier: 2, effects: true, autopilot: 'start_experiments', channel: 'meta_ads', label: 'Lanzar una variante de prueba' },
  'organic.schedule': { tier: 2, effects: false, label: 'Programar contenido orgánico' },
  'organic.publish.instagram': { tier: 2, effects: true, autopilot: 'publish_organic', channel: 'instagram', label: 'Publicar en Instagram' },
  'organic.publish.facebook': { tier: 2, effects: true, autopilot: 'publish_organic', channel: 'facebook', label: 'Publicar en Facebook' },
  'capi.send': { tier: 2, effects: true, safe: true, label: 'Mandar un evento a la API de conversiones' },
  'kill_switch.engage': { tier: 1, effects: true, safe: true, label: 'Activar la pausa general' },
  // Nivel 3
  'launch.first_live': { tier: 3, effects: true, label: 'Primer lanzamiento con gasto real de un producto' },
  'budget.limits.raise': { tier: 3, effects: true, label: 'Subir los topes de presupuesto' },
  'channel.activate': { tier: 3, effects: true, label: 'Activar un canal o una cuenta' },
  'mode.set_live': { tier: 3, effects: true, label: 'Pasar a modo real' },
  'policy.update': { tier: 3, effects: true, label: 'Cambiar la política de piloto automático' },
  'campaign.delete': { tier: 3, effects: true, label: 'Borrar o archivar una campaña' },
  'kill_switch.release': { tier: 3, effects: true, ignoresPause: true, label: 'Levantar la pausa general' },
  'offer.change': { tier: 3, effects: true, label: 'Cambiar precios u ofertas' },
};

export interface GuardInput {
  action: string;
  actor: Actor;
  target?: string;
  product?: string;
  /** Para cambios de presupuesto: el presupuesto diario nuevo de la campaña. */
  newDailyBudget?: number;
  /** Y el que tenía. */
  oldDailyBudget?: number;
  /** Para pedir la autorización automáticamente si falta. */
  requestIfMissing?: { summary: string; scope?: Record<string, unknown> };
  details?: Record<string, unknown>;
}

export interface Decision {
  allowed: boolean;
  tier: Tier;
  /** En modo de prueba los efectos externos se simulan. */
  dryRun: boolean;
  mode: Mode;
  reason: string;
  approvalId?: string;
  /** Link firmado para que el dueño decida (sólo se devuelve al que pidió). */
  needs?: string;
}

export async function guard(input: GuardInput): Promise<Decision> {
  const def = ACTIONS[input.action];
  const mode = await getMode();
  const base = { dryRun: mode !== 'live', mode };
  const fin = async (d: Decision): Promise<Decision> => {
    await audit({
      actor: input.actor,
      action: input.action,
      tier: d.tier,
      decision: d.allowed ? (d.dryRun && def?.effects ? 'dry_run' : 'allowed') : d.approvalId ? 'needs_approval' : 'denied',
      target: input.target ?? input.product,
      details: { reason: d.reason, ...(input.details ?? {}) },
    });
    return d;
  };

  if (!def) return fin({ allowed: false, tier: 3, ...base, reason: `Acción desconocida: ${input.action}` });

  const ks = await getKillSwitch();
  if (ks.paused && def.effects && !def.safe && !def.ignoresPause) {
    return fin({ allowed: false, tier: def.tier, ...base, reason: `Pausa general activa${ks.reason ? `: ${ks.reason}` : ''}. Sólo se permiten acciones que frenan.` });
  }
  if (def.tier === 1 || def.safe) return fin({ allowed: true, tier: def.tier, ...base, reason: 'permitido' });
  if (input.action === 'offer.change') {
    return fin({ allowed: false, tier: 3, ...base, reason: 'Los precios y ofertas se cambian en el repositorio de cada producto, no desde la Factory.' });
  }

  const policy = await getPolicy();

  // En modo de prueba nada sale de la Factory: el nivel 2 se simula entero
  // (así se ensaya el flujo completo) y la decisión dice qué haría falta en
  // modo real. El nivel 3 sigue exigiendo al dueño igual.
  if (mode !== 'live' && def.tier === 2) {
    const faltaria = await liveBlocker(policy, input, def);
    return fin({ allowed: true, tier: 2, ...base, reason: faltaria ? `simulado (en modo real: ${faltaria})` : 'simulado' });
  }

  if (def.tier === 3) {
    if (input.actor === 'owner') return fin({ allowed: true, tier: 3, ...base, reason: 'decidido por el dueño' });
    const ok = await consumeApproval(input);
    if (ok) return fin({ allowed: true, tier: 3, ...base, reason: `autorizado (${ok})`, approvalId: ok });
    return fin(await pedir(input, 3, base, 'Requiere autorización explícita del dueño (nivel 3).'));
  }

  // Nivel 2: canal activado, topes de presupuesto y piloto automático.
  if (def.channel && !policy.channels[def.channel]) {
    return fin(await pedir({ ...input, action: 'channel.activate', requestIfMissing: input.requestIfMissing && { summary: `Activar el canal ${def.channel}`, scope: { channel: def.channel } } }, 3, base, `El canal ${def.channel} no está activado (activarlo es nivel 3).`));
  }
  if (input.action === 'meta.launch' || input.action === 'experiment.start') {
    if (input.product && !policy.products_live.includes(input.product)) {
      return fin(await pedir({ ...input, action: 'launch.first_live', requestIfMissing: input.requestIfMissing && { summary: `Primer lanzamiento con gasto real de ${input.product}`, scope: { product: input.product } } }, 3, base, `Es el primer lanzamiento con gasto real de ${input.product} (nivel 3).`));
    }
  }
  if (input.newDailyBudget !== undefined) {
    const problema = await budgetProblem(policy, input);
    if (problema) return fin(await pedir({ ...input, action: 'budget.limits.raise', requestIfMissing: input.requestIfMissing && { summary: problema, scope: { product: input.product, daily: input.newDailyBudget } } }, 3, base, problema));
  }
  if (input.actor === 'owner') return fin({ allowed: true, tier: 2, ...base, reason: 'decidido por el dueño' });
  // Nivel 2 sin efectos afuera (programar en el calendario): la aprobación se
  // pide cuando de verdad sale, no antes.
  if (!def.effects) return fin({ allowed: true, tier: 2, ...base, reason: 'sin efectos externos; se autoriza al ejecutarse' });
  if (def.autopilot && policy.autopilot[def.autopilot]) return fin({ allowed: true, tier: 2, ...base, reason: `regla autorizada: ${def.autopilot}` });
  const single = await consumeApproval(input);
  if (single) return fin({ allowed: true, tier: 2, ...base, reason: `autorizado (${single})`, approvalId: single });
  return fin(await pedir(input, 2, base, `El piloto automático no autoriza «${def.label}». Hace falta la aprobación del dueño.`));
}

/** Lanza un error si la decisión no permite seguir. */
export async function require(input: GuardInput): Promise<Decision> {
  const d = await guard(input);
  if (!d.allowed) throw new SmfError(d.reason, d.approvalId ? 'needs_approval' : 'denied', { approvalId: d.approvalId, tier: d.tier });
  return d;
}

/** Lo primero que frenaría esta acción de nivel 2 en modo real, o null. */
async function liveBlocker(policy: Policy, input: GuardInput, def: ActionDef): Promise<string | null> {
  if (def.channel && !policy.channels[def.channel]) return `activar el canal ${def.channel}`;
  if ((input.action === 'meta.launch' || input.action === 'experiment.start') && input.product && !policy.products_live.includes(input.product)) {
    return `autorizar el primer gasto real de ${input.product}`;
  }
  if (input.newDailyBudget !== undefined) {
    const p = await budgetProblem(policy, input);
    if (p) return p;
  }
  if (input.actor !== 'owner' && def.autopilot && !policy.autopilot[def.autopilot]) return `habilitar el piloto automático «${def.autopilot}» o aprobar esta acción`;
  return null;
}

async function budgetProblem(policy: Policy, input: GuardInput): Promise<string | null> {
  const nuevo = input.newDailyBudget ?? 0;
  const b = policy.budget;
  if (nuevo > b.max_daily_per_campaign_ars) return `El presupuesto diario $${nuevo} supera el tope por campaña ($${b.max_daily_per_campaign_ars}).`;
  const d = await db();
  const [{ total }] = await d.query<{ total: string }>(
    `SELECT COALESCE(SUM(daily_budget_ars),0)::text AS total FROM smf.campaigns WHERE status = 'active' AND dry_run = false AND id <> $1`,
    [input.target ?? '']
  );
  if (Number(total) + nuevo > b.max_daily_total_ars) {
    return `Con este cambio el gasto diario total sería $${Number(total) + nuevo}, arriba del tope ($${b.max_daily_total_ars}).`;
  }
  if (input.oldDailyBudget && input.actor !== 'owner') {
    const pct = (Math.abs(nuevo - input.oldDailyBudget) / input.oldDailyBudget) * 100;
    if (pct > b.max_change_pct) return `El ajuste es de ${pct.toFixed(0)}%, más que el máximo automático (${b.max_change_pct}%).`;
  }
  return null;
}

async function pedir(input: GuardInput, tier: Tier, base: { dryRun: boolean; mode: Mode }, reason: string): Promise<Decision> {
  if (!input.requestIfMissing) return { allowed: false, tier, ...base, reason };
  const { id, link } = await requestApproval({
    action: input.action,
    scope: { ...(input.requestIfMissing.scope ?? {}), ...(input.product ? { product: input.product } : {}), ...(input.target ? { target: input.target } : {}) },
    summary: input.requestIfMissing.summary,
    requestedBy: input.actor,
  });
  return { allowed: false, tier, ...base, reason, approvalId: id, needs: link };
}

// ============================================================
// Autorizaciones
// ============================================================

export interface Approval {
  id: string;
  action: string;
  scope: Record<string, unknown>;
  summary: string;
  status: 'pending' | 'approved' | 'rejected' | 'expired' | 'used';
  requested_by: string;
  requested_at: string;
  decided_by: string | null;
  expires_at: string;
}

export async function requestApproval(a: { action: string; scope: Record<string, unknown>; summary: string; requestedBy: string; hours?: number }): Promise<{ id: string; link?: string; existing: boolean }> {
  const d = await db();
  // Si ya hay una pendiente para lo mismo, no se duplica: el dueño recibiría
  // diez avisos por un job que reintenta.
  const iguales = await d.query<{ id: string }>(
    `SELECT id FROM smf.approvals WHERE action = $1 AND scope = $2::jsonb AND status = 'pending' AND expires_at > now() LIMIT 1`,
    [a.action, j(a.scope)]
  );
  if (iguales.length) return { id: iguales[0].id, existing: true };
  const id = newId('apr');
  const t = token(24);
  await d.query(
    `INSERT INTO smf.approvals (id, action, scope, summary, requested_by, expires_at, link_hash)
     VALUES ($1,$2,$3::jsonb,$4,$5, now() + ($6 || ' hours')::interval, $7)`,
    [id, a.action, j(a.scope), a.summary, a.requestedBy, String(a.hours ?? 72), sha256(t)]
  );
  await audit({ actor: a.requestedBy, action: 'approval.request', decision: 'info', target: id, details: { action: a.action, scope: a.scope } });
  const link = config.publicUrl ? `${config.publicUrl}/approvals/${id}?t=${t}` : undefined;
  // El aviso al dueño (con el link) lo manda el motor de notificaciones.
  const { notify } = await import('../notify/index.ts');
  await notify({
    kind: 'approval_needed',
    severity: 'action',
    title: `Autorización pendiente: ${ACTIONS[a.action]?.label ?? a.action}`,
    body: `${a.summary}\n\nPedido por: ${a.requestedBy}. Vence en ${a.hours ?? 72} h.${link ? `\nDecidir: ${link}` : '\nDecidir en el panel → Autorizaciones.'}`,
    dedupKey: `approval:${id}`,
    data: { approvalId: id },
  });
  return { id, link, existing: false };
}

/** Busca una autorización aprobada que cubra esta acción y la marca usada. */
async function consumeApproval(input: GuardInput): Promise<string | null> {
  const d = await db();
  const rows = await d.query<{ id: string; scope: Record<string, unknown> }>(
    `SELECT id, scope FROM smf.approvals WHERE action = $1 AND status = 'approved' AND expires_at > now() ORDER BY decided_at`,
    [input.action]
  );
  for (const r of rows) {
    if (r.scope.product && input.product && r.scope.product !== input.product) continue;
    if (r.scope.target && input.target && r.scope.target !== input.target) continue;
    if (typeof r.scope.daily === 'number' && (input.newDailyBudget ?? 0) > r.scope.daily) continue;
    const upd = await d.query<{ id: string }>(`UPDATE smf.approvals SET status = 'used', used_at = now() WHERE id = $1 AND status = 'approved' RETURNING id`, [r.id]);
    if (upd.length) return r.id;
  }
  return null;
}

/**
 * La decisión del dueño. `via` dice por dónde entró: panel, CLI o link. El link
 * se verifica contra la huella guardada; el panel y la CLI ya autenticaron al
 * dueño antes de llegar acá.
 */
export async function decideApproval(id: string, approve: boolean, via: { kind: 'owner' } | { kind: 'link'; token: string }, note?: string): Promise<Approval> {
  const d = await db();
  const [a] = await d.query<Approval & { link_hash: string }>('SELECT * FROM smf.approvals WHERE id = $1', [id]);
  if (!a) throw new SmfError('No existe esa autorización.', 'not_found');
  if (via.kind === 'link' && sha256(via.token) !== a.link_hash) throw new SmfError('El link no es válido.', 'forbidden');
  if (a.status !== 'pending') throw new SmfError(`Ya está ${a.status}.`, 'conflict');
  if (new Date(a.expires_at) < new Date()) {
    await d.query(`UPDATE smf.approvals SET status = 'expired' WHERE id = $1`, [id]);
    throw new SmfError('Venció. Que la vuelvan a pedir.', 'expired');
  }
  const [r] = await d.query<Approval>(
    `UPDATE smf.approvals SET status = $2, decided_by = 'owner', decided_at = now(), note = $3, link_hash = NULL WHERE id = $1 AND status = 'pending' RETURNING *`,
    [id, approve ? 'approved' : 'rejected', note ?? null]
  );
  await audit({ actor: 'owner', action: 'approval.decide', tier: 3, decision: approve ? 'allowed' : 'denied', target: id, details: { action: a.action, scope: a.scope, via: via.kind } });
  // Algunas autorizaciones cambian la política en el momento de aprobarse.
  if (approve) await applyApprovedPolicyChange(r);
  return r;
}

/** Lo que se autoriza de una vez para siempre (no se consume en una acción). */
async function applyApprovedPolicyChange(a: Approval): Promise<void> {
  const s = a.scope as Record<string, unknown>;
  if (a.action === 'launch.first_live' && typeof s.product === 'string') {
    const p = await getPolicy();
    if (!p.products_live.includes(s.product)) await setPolicyInternal({ ...p, products_live: [...p.products_live, s.product] }, 'owner');
  } else if (a.action === 'channel.activate' && typeof s.channel === 'string' && s.channel in (await getPolicy()).channels) {
    const p = await getPolicy();
    await setPolicyInternal({ ...p, channels: { ...p.channels, [s.channel]: true } }, 'owner');
  } else {
    return;
  }
  await db().then((d) => d.query(`UPDATE smf.approvals SET status = 'used', used_at = now() WHERE id = $1`, [a.id]));
}

export async function listApprovals(status?: string): Promise<Approval[]> {
  const d = await db();
  await d.query(`UPDATE smf.approvals SET status = 'expired' WHERE status = 'pending' AND expires_at < now()`);
  return d.query<Approval>(
    `SELECT id, action, scope, summary, status, requested_by, requested_at, decided_by, decided_at, expires_at FROM smf.approvals
     ${status ? 'WHERE status = $1' : ''} ORDER BY requested_at DESC LIMIT 100`,
    status ? [status] : []
  );
}

// ============================================================
// Ajustes que cambian lo que la Factory puede hacer
// ============================================================

export async function engageKillSwitch(actor: Actor, reason: string): Promise<KillSwitch> {
  await require({ action: 'kill_switch.engage', actor, details: { reason } });
  const ks: KillSwitch = { paused: true, reason, at: new Date().toISOString(), by: actor };
  await putSetting('kill_switch', ks, actor);
  return ks;
}

export async function releaseKillSwitch(actor: Actor): Promise<KillSwitch> {
  await require({ action: 'kill_switch.release', actor });
  const ks: KillSwitch = { paused: false, at: new Date().toISOString(), by: actor };
  await putSetting('kill_switch', ks, actor);
  return ks;
}

export async function setMode(actor: Actor, mode: Mode): Promise<Mode> {
  // Volver a modo de prueba es siempre seguro; pasar a real es nivel 3.
  if (mode === 'live') await require({ action: 'mode.set_live', actor, requestIfMissing: { summary: 'Pasar la Factory a modo real: las llamadas a Meta dejan de simularse.' } });
  await putSetting('mode', mode, actor);
  await audit({ actor, action: 'mode.set', decision: 'done', details: { mode } });
  return mode;
}

/**
 * Cambiar la política. Bajar topes o apagar piloto automático es seguro y lo
 * puede hacer cualquiera; todo lo que amplía lo que la Factory puede hacer sola
 * es nivel 3.
 */
export async function updatePolicy(actor: Actor, patch: DeepPartial<Policy>): Promise<Policy> {
  const actual = await getPolicy();
  const nueva: Policy = {
    ...actual,
    ...patch,
    autopilot: { ...actual.autopilot, ...(patch.autopilot ?? {}) },
    budget: { ...actual.budget, ...(patch.budget ?? {}) },
    channels: { ...actual.channels, ...(patch.channels ?? {}) },
    products_live: (patch.products_live as string[] | undefined) ?? actual.products_live,
  };
  if (amplia(actual, nueva)) {
    await require({ action: 'policy.update', actor, requestIfMissing: { summary: `Cambiar la política: ${JSON.stringify(patch)}`, scope: { patch } } });
  }
  await setPolicyInternal(nueva, actor);
  return nueva;
}

async function setPolicyInternal(p: Policy, by: string): Promise<void> {
  await putSetting('policy', p, by);
  await audit({ actor: by, action: 'policy.set', decision: 'done', details: { policy: p } });
}

function amplia(a: Policy, b: Policy): boolean {
  for (const k of Object.keys(b.autopilot) as (keyof Policy['autopilot'])[]) if (b.autopilot[k] && !a.autopilot[k]) return true;
  for (const k of Object.keys(b.channels) as (keyof Policy['channels'])[]) if (b.channels[k] && !a.channels[k]) return true;
  if (b.budget.max_daily_total_ars > a.budget.max_daily_total_ars) return true;
  if (b.budget.max_daily_per_campaign_ars > a.budget.max_daily_per_campaign_ars) return true;
  if (b.budget.max_change_pct > a.budget.max_change_pct) return true;
  if (b.products_live.some((p) => !a.products_live.includes(p))) return true;
  if (!b.require_pixel_for_conversion_campaigns && a.require_pixel_for_conversion_campaigns) return true;
  return false;
}

type DeepPartial<T> = { [K in keyof T]?: T[K] extends object ? Partial<T[K]> : T[K] };

/** Firma corta para cookies del panel. */
export function sign(value: string): string {
  if (!config.signingSecret) throw new SmfError('Falta SMF_SIGNING_SECRET.', 'config');
  return `${value}.${hmac(config.signingSecret, value).slice(0, 32)}`;
}
