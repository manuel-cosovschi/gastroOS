/**
 * Las operaciones de la Factory, en un solo lugar.
 *
 * La API REST (`POST /api/ops/<nombre>`), el servidor MCP que usa Claude desde
 * Cowork y la CLI exponen exactamente esta lista. Cada operación declara su
 * entrada con zod y ejecuta código real; los controles de nivel están adentro
 * de cada función (guard), así que da igual por dónde entre el pedido.
 *
 * El actor lo pone el transporte, nunca el que llama: la API y el MCP son
 * `agent`; el panel y la CLI con la llave del dueño son `owner`.
 */

import { z } from 'zod';
import { config, integrations } from './config.ts';
import { db } from './db/index.ts';
import type { Actor } from './core/audit.ts';
import { engageKillSwitch, listApprovals, requestApproval, setMode, updatePolicy, ACTIONS } from './core/policy.ts';
import { getKillSwitch, getMode, getPolicy, getSetting, putSetting } from './core/settings.ts';
import { SmfError } from './core/util.ts';
import { catalogFromDb, loadCatalog, syncCatalog } from './catalog/index.ts';
import { discover } from './catalog/discover.ts';
import { verifyLanding, lastLandingCheck } from './conversion/landing.ts';
import { createCustomConcept, generateConcepts, listConcepts, TEMPLATES } from './creative/concepts.ts';
import { listCreatives } from './creative/index.ts';
import { FORMATS } from './creative/formats.ts';
import { getCampaign, launchCampaign, listCampaigns, pauseAll, pauseCampaign, prepareCampaign, pushCampaign, refreshCampaign, setDailyBudget, verifyAccount } from './meta/ads.ts';
import { syncInsights } from './meta/insights.ts';
import { calendar, cancelPost, schedulePost } from './meta/organic.ts';
import { listEvents } from './conversion/events.ts';
import { analyze, runOptimizer, optimizerSettings } from './optimize/index.ts';
import { summary, weeklyReport } from './report/index.ts';
import { cancelQueued, enqueue, getJob, listJobs } from './runtime/jobs.ts';
import { health } from './runtime/worker.ts';
import { campaignDefaults } from './runtime/pipeline.ts';
import { listAlerts } from './notify/index.ts';

export interface Op<S extends z.ZodRawShape = z.ZodRawShape> {
  name: string;
  title: string;
  description: string;
  input: S;
  /** Si cambia algo afuera (para que el MCP lo marque como no sólo-lectura). */
  readOnly?: boolean;
  run: (input: z.objectOutputType<S, z.ZodTypeAny>, actor: Actor) => Promise<unknown>;
}

const op = <S extends z.ZodRawShape>(o: Op<S>) => o as unknown as Op;

const product = z.string().describe('Id del producto en el catálogo (p. ej. gastroos, alojaos)');
const formatEnum = z.enum(Object.keys(FORMATS) as [string, ...string[]]);

export const OPS: Op[] = [
  op({
    name: 'status',
    title: 'Estado general',
    description: 'Modo (prueba/real), pausa general, integraciones configuradas, salud del ejecutor, autorizaciones pendientes y resumen de campañas, creativos y alertas. Empezar siempre por acá.',
    input: {},
    readOnly: true,
    run: async () => {
      const d = await db();
      const [c] = await d.query<Record<string, number>>(`SELECT
        (SELECT COUNT(*)::int FROM smf.campaigns WHERE status = 'active') activas,
        (SELECT COUNT(*)::int FROM smf.campaigns WHERE status IN ('prepared','in_meta_paused','pending_review','blocked')) en_preparacion,
        (SELECT COUNT(*)::int FROM smf.creatives WHERE status = 'ready') creativos_listos,
        (SELECT COUNT(*)::int FROM smf.approvals WHERE status = 'pending' AND expires_at > now()) autorizaciones_pendientes,
        (SELECT COUNT(*)::int FROM smf.alerts WHERE status = 'open' AND severity IN ('critical','action')) alertas_abiertas,
        (SELECT COUNT(*)::int FROM smf.jobs WHERE status IN ('queued','running')) trabajos_en_cola`);
      return { mode: await getMode(), kill_switch: await getKillSwitch(), policy: await getPolicy(), integrations: integrations(), health: await health(), counts: c, public_url: config.publicUrl || null };
    },
  }),
  op({
    name: 'products_list',
    title: 'Productos',
    description: 'Productos del catálogo con su estado, si son anunciables, bloqueos conocidos, última verificación de /conv y hechos verificados (claims, ángulos, planes).',
    input: {},
    readOnly: true,
    run: async () => {
      let rows = await catalogFromDb();
      if (!rows.length) {
        await syncCatalog();
        rows = await catalogFromDb();
      }
      return Promise.all(rows.map(async (r) => ({
        id: r.id, name: r.product.name, marketable: r.marketable, status: r.product.status, urls: r.product.urls, sales_path: r.product.sales_path,
        audiences: r.product.audiences.map((a) => a.label), angles: r.facts.verifiedAngles, verified_claims: r.product.claims.filter((c) => r.facts.verifiedClaims.includes(c.id)).map((c) => ({ id: c.id, text: c.text })),
        plans: r.facts.pricing.plans, features: r.facts.features.map((f) => f.name), blockers: r.product.blockers, rules: r.product.rules,
        landing: await lastLandingCheck(r.id).then((l) => l && { ok: l.ok, pixel: l.pixel, checked_at: l.checked_at }), analyzed_at: r.facts.analyzedAt, commit: r.facts.commit,
      })));
    },
  }),
  op({
    name: 'product_analyze',
    title: 'Analizar productos',
    description: 'Vuelve a leer los repositorios (git fetch de la rama de producción), verifica cada evidencia del catálogo, extrae precios y funcionalidades, y detecta cambios. Los conceptos que dependían de algo que cambió quedan «stale».',
    input: { refresh: z.boolean().optional().describe('Actualizar los clones antes de analizar (por defecto sí)') },
    readOnly: true,
    run: async (i, actor) => (await syncCatalog({ refresh: i.refresh !== false, actor })).map((r) => ({ product: r.product, changed: r.changed, changes: r.changes, failed_evidence: r.facts.evidence.filter((e) => !e.ok), plans: r.facts.pricing.plans, features: r.facts.features.length })),
  }),
  op({
    name: 'products_discover',
    title: 'Descubrir productos',
    description: 'Revisa los repositorios disponibles y avisa los que no están clasificados en catalog/ecosystem.json. Nunca agrega productos al catálogo: eso lo decide el dueño.',
    input: { github_owner: z.string().optional() },
    readOnly: true,
    run: async (i) => {
      const r = await discover({ github: i.github_owner ?? process.env.SMF_GITHUB_OWNER });
      return { products: r.products, unclassified: r.unclassified, classified: r.repos.filter((x) => x.classified).map((x) => ({ repo: x.repo, role: x.role })) };
    },
  }),
  op({
    name: 'landing_verify',
    title: 'Verificar /conv',
    description: 'Verifica la página /conv de un producto (o de todos): responde, muestra el texto de cada variante ?v=, conserva UTMs, guarda la atribución y carga el píxel. Bloquea el envío de eventos reales durante la prueba.',
    input: { product: product.optional() },
    readOnly: true,
    run: async (i, actor) => {
      const ids = i.product ? [i.product] : loadCatalog().filter((p) => p.marketable).map((p) => p.id);
      const out = [];
      for (const id of ids) out.push(await verifyLanding(id, { actor }));
      return out;
    },
  }),
  op({
    name: 'concepts_generate',
    title: 'Generar conceptos',
    description: 'Genera conceptos publicitarios para un producto combinando ángulos verificados, claims verificados, precio de entrada y plantillas visuales. No inventa texto.',
    input: { product, count: z.number().int().min(1).max(12).optional(), angles: z.array(z.string()).optional(), templates: z.array(z.enum(TEMPLATES)).optional(), with_price: z.boolean().optional() },
    readOnly: true,
    run: async (i, actor) => generateConcepts(i.product, { count: i.count, angles: i.angles, templates: i.templates, withPrice: i.with_price, createdBy: actor }),
  }),
  op({
    name: 'concept_create_custom',
    title: 'Concepto con copy propio',
    description: 'Crea un concepto con copy escrito por vos (Claude). Se valida: números, precios y afirmaciones tienen que estar en los hechos verificados del producto; nada de testimonios, superlativos ni promesas. Si no pasa, devuelve los errores para corregirlo.',
    input: { product, angle: z.string(), hook: z.string(), headline: z.string(), primary_text: z.string(), cta: z.string(), bullets: z.array(z.string()).optional().describe('Ids o textos exactos de claims verificados'), template: z.enum(TEMPLATES).optional() },
    readOnly: true,
    run: async (i, actor) => createCustomConcept({ ...i, createdBy: actor }),
  }),
  op({ name: 'concepts_list', title: 'Conceptos', description: 'Lista los conceptos (borradores, vigentes y viejos).', input: { product: product.optional() }, readOnly: true, run: async (i) => listConcepts(i.product) }),
  op({
    name: 'creatives_render',
    title: 'Renderizar videos',
    description: 'Encola el render de un concepto en los formatos pedidos (9:16 Reels/Stories, 4:5 Feed, 1:1, 16:9). Cada render tarda 1-2 minutos y se valida con ffprobe. Devuelve ids de trabajo para consultar con job_status.',
    input: { concept: z.string(), formats: z.array(formatEnum).min(1), duration: z.number().min(10).max(30).optional() },
    readOnly: true,
    run: async (i) => Promise.all(i.formats.map((f: string) => enqueue('creative.render', { concept: i.concept, format: f, duration: i.duration ?? 15 }, { key: `render:${i.concept}:${f}:${i.duration ?? 15}`, needs: 'render' }).then((r) => ({ format: f, job: r.id, queued: r.created })))),
  }),
  op({ name: 'creatives_list', title: 'Creativos', description: 'Creativos renderizados con su estado, validación, archivos y si se subieron a Meta.', input: { product: product.optional(), status: z.string().optional() }, readOnly: true, run: async (i) => listCreatives(i) }),
  op({
    name: 'campaign_prepare',
    title: 'Preparar campaña',
    description: 'Arma un borrador de campaña (nivel 1): creativos listos, URL /conv verificada con la variante de cada ángulo y UTMs por anuncio, presupuesto diario en ARS. Devuelve los bloqueos si los hay (p. ej. falta el píxel).',
    input: { product, creatives: z.array(z.string()).min(1), daily_budget: z.number().positive(), objective: z.enum(['leads', 'traffic']).optional(), name: z.string().optional() },
    run: async (i, actor) => prepareCampaign({ product: i.product, creativeIds: i.creatives, dailyBudget: i.daily_budget, objective: i.objective, name: i.name, actor }),
  }),
  op({ name: 'campaign_push', title: 'Crear en Meta (en pausa)', description: 'Sube los videos y crea campaña, conjunto, creativos y anuncios en Meta, todo EN PAUSA, y lo verifica leyéndolo de vuelta. En modo de prueba se simula.', input: { campaign: z.string() }, run: async (i, actor) => pushCampaign(i.campaign, actor) }),
  op({ name: 'campaign_launch', title: 'Lanzar campaña', description: 'Activa una campaña creada en Meta. Pasa por la política: el primer gasto real de cada producto y todo lo que supere los topes requiere autorización del dueño (se pide sola). Sólo se informa activa si Meta lo confirma.', input: { campaign: z.string() }, run: async (i, actor) => launchCampaign(i.campaign, actor) }),
  op({ name: 'campaign_pause', title: 'Pausar campaña', description: 'Pausa una campaña. Siempre permitido.', input: { campaign: z.string(), reason: z.string().optional() }, run: async (i, actor) => pauseCampaign(i.campaign, actor, i.reason) }),
  op({ name: 'campaign_budget', title: 'Cambiar presupuesto', description: 'Cambia el presupuesto diario dentro de los topes autorizados; si los supera, pide autorización.', input: { campaign: z.string(), daily_budget: z.number().positive() }, run: async (i, actor) => setDailyBudget(i.campaign, i.daily_budget, actor) }),
  op({ name: 'campaign_refresh', title: 'Estado real en Meta', description: 'Lee el estado efectivo y la revisión de los anuncios en Meta.', input: { campaign: z.string() }, readOnly: true, run: async (i) => refreshCampaign(i.campaign) }),
  op({ name: 'campaigns_list', title: 'Campañas', description: 'Campañas con estado, presupuesto, ids de Meta, si son simuladas y sus bloqueos.', input: { product: product.optional(), status: z.string().optional() }, readOnly: true, run: async (i) => listCampaigns(i) }),
  op({ name: 'campaign_get', title: 'Detalle de campaña', description: 'Una campaña con su plan, anuncios y estado en Meta.', input: { campaign: z.string() }, readOnly: true, run: async (i) => {
    const c = await getCampaign(i.campaign);
    const ads = await (await db()).query('SELECT id, creative_id, utm_content, url, meta_ad_id, status, effective_status, review FROM smf.ads WHERE campaign_id = $1', [i.campaign]);
    return { ...c, ads };
  } }),
  op({
    name: 'pause_all',
    title: 'PAUSA GENERAL',
    description: 'Freno de emergencia: activa la pausa general (nada con efectos se ejecuta), cancela los trabajos en cola y pausa en Meta todas las campañas. Levantarla requiere al dueño.',
    input: { reason: z.string() },
    run: async (i, actor) => {
      const ks = await engageKillSwitch(actor, i.reason);
      const cancelados = await cancelQueued(`pausa general: ${i.reason}`);
      const r = await pauseAll(actor, i.reason);
      return { kill_switch: ks, cancelled_jobs: cancelados, ...r };
    },
  }),
  op({ name: 'meta_verify_account', title: 'Verificar cuenta de Meta', description: 'Lectura real de la cuenta: token, permisos, cuenta publicitaria, moneda, página e Instagram. Nunca se simula.', input: {}, readOnly: true, run: async () => verifyAccount() }),
  op({ name: 'metrics_sync', title: 'Traer métricas', description: 'Trae métricas de Meta por anuncio y día.', input: { days: z.number().int().min(1).max(90).optional() }, readOnly: true, run: async (i) => syncInsights({ days: i.days }) }),
  op({ name: 'performance', title: 'Rendimiento', description: 'Resumen por producto (gasto, CTR, CPC, CPM, consultas de Meta y confirmadas, compras, ingresos, CAC, ROAS) y los anuncios con menor costo por consulta, marcando si la muestra alcanza.', input: { days: z.number().int().min(1).max(90).optional() }, readOnly: true, run: async (i) => summary(i.days ?? 7) }),
  op({ name: 'events_list', title: 'Compras y consultas', description: 'Eventos de negocio confirmados por los productos (consultas, calificadas, compras, clientes) con su campaña/anuncio de origen. Sin datos personales.', input: { product: product.optional(), type: z.enum(['lead', 'qualified_lead', 'checkout', 'purchase', 'contact', 'customer', 'disqualified']).optional(), days: z.number().int().min(1).max(365).optional() }, readOnly: true, run: async (i) => listEvents(i) }),
  op({ name: 'optimize_analyze', title: 'Analizar rendimiento', description: 'Corre las reglas de optimización sin ejecutar nada: qué pausaría, qué variantes pediría, qué presupuesto movería, con la evidencia.', input: {}, readOnly: true, run: async () => analyze().then((r) => ({ settings: r.settings, findings: r.findings })) }),
  op({ name: 'optimize_run', title: 'Optimizar', description: 'Aplica las reglas: ejecuta lo que el piloto automático autoriza y deja propuesto (con pedido de autorización) lo demás.', input: {}, run: async (_i, actor) => runOptimizer(actor) }),
  op({ name: 'report_weekly', title: 'Reporte', description: 'Genera el reporte (por defecto, semanal) en markdown y lo devuelve.', input: { days: z.number().int().min(1).max(90).optional() }, readOnly: true, run: async (i) => weeklyReport(i.days ?? 7) }),
  op({ name: 'organic_schedule', title: 'Programar orgánico', description: 'Programa una publicación en Instagram (reel, imagen o carrusel) o Facebook con creativos listos. Publicar pasa por la política cuando llega la hora.', input: { product, creatives: z.array(z.string()).min(1), channel: z.enum(['instagram', 'facebook']), at: z.string().describe('Fecha y hora ISO 8601'), kind: z.enum(['reel', 'image', 'carousel', 'video']).optional(), caption: z.string().optional() }, run: async (i, actor) => schedulePost({ product: i.product, creativeIds: i.creatives, channel: i.channel, at: i.at, kind: i.kind, caption: i.caption, actor }) }),
  op({ name: 'organic_calendar', title: 'Calendario editorial', description: 'Publicaciones programadas, publicadas y fallidas.', input: { from: z.string().optional(), to: z.string().optional() }, readOnly: true, run: async (i) => calendar(i.from, i.to) }),
  op({ name: 'organic_cancel', title: 'Cancelar publicación', description: 'Cancela una publicación programada.', input: { post: z.string() }, run: async (i, actor) => cancelPost(i.post, actor) }),
  op({
    name: 'marketing_run',
    title: 'Ejecutar el marketing',
    description: 'Ejecuta el ciclo completo para todos los productos anunciables (o los indicados): analiza, verifica /conv, genera conceptos, renderiza, prepara y crea campañas en Meta en pausa, pide el lanzamiento (con autorización cuando corresponde) y programa orgánico. Corre en el ejecutor; devuelve el id del trabajo.',
    input: { products: z.array(product).optional(), launch: z.boolean().optional().describe('Pedir el lanzamiento al final (por defecto sí)') },
    run: async (i, actor) => {
      const r = await enqueue('marketing.run', { products: i.products, launch: i.launch !== false, actor }, { needs: 'render', maxAttempts: 1 });
      return { job: r.id, note: 'Consultar el avance con job_status. Todo lo que gaste o publique pasa por la política.' };
    },
  }),
  op({ name: 'job_status', title: 'Estado de un trabajo', description: 'Estado y resultado de un trabajo de la cola.', input: { job: z.string() }, readOnly: true, run: async (i) => getJob(i.job) }),
  op({ name: 'jobs_list', title: 'Trabajos', description: 'Últimos trabajos de la cola.', input: { status: z.string().optional(), limit: z.number().int().max(200).optional() }, readOnly: true, run: async (i) => listJobs(i) }),
  op({ name: 'approvals_list', title: 'Autorizaciones', description: 'Autorizaciones pendientes y decididas. Sólo el dueño las decide (panel o link).', input: { status: z.enum(['pending', 'approved', 'rejected', 'expired', 'used']).optional() }, readOnly: true, run: async (i) => listApprovals(i.status) }),
  op({
    name: 'approval_request',
    title: 'Pedir autorización',
    description: 'Pide al dueño una autorización de nivel 3 (activar un canal, primer gasto real de un producto, subir topes, pasar a modo real). Le llega por los canales de aviso con un link firmado.',
    input: { action: z.enum(Object.keys(ACTIONS).filter((k) => ACTIONS[k].tier === 3) as [string, ...string[]]), summary: z.string().min(10), scope: z.record(z.unknown()).optional() },
    run: async (i, actor) => requestApproval({ action: i.action, scope: i.scope ?? {}, summary: i.summary, requestedBy: actor }),
  }),
  op({ name: 'mode_set', title: 'Cambiar modo', description: 'Volver a «test» siempre se puede; pasar a «live» requiere autorización del dueño.', input: { mode: z.enum(['test', 'live']) }, run: async (i, actor) => setMode(actor, i.mode) }),
  op({ name: 'policy_update', title: 'Cambiar la política', description: 'Restringir (apagar piloto automático, bajar topes) se aplica en el momento; ampliar requiere autorización del dueño y queda pedida.', input: { patch: z.record(z.unknown()) }, run: async (i, actor) => updatePolicy(actor, i.patch as never) }),
  op({
    name: 'settings_get',
    title: 'Configuración',
    description: 'Política, valores por defecto de campañas (presupuesto por producto, formatos, orgánico) y parámetros del optimizador (CPL objetivo por producto, muestras mínimas).',
    input: {},
    readOnly: true,
    run: async () => ({ policy: await getPolicy(), campaign_defaults: await campaignDefaults(), optimizer: await optimizerSettings(), mode: await getMode() }),
  }),
  op({
    name: 'settings_update',
    title: 'Ajustar configuración',
    description: 'Ajusta campaign_defaults (presupuesto diario por producto para los borradores, formatos, conceptos por producto, orgánico) u optimizer (CPL objetivo por producto, umbrales). No cambia los topes de gasto: esos son la política.',
    input: { key: z.enum(['campaign_defaults', 'optimizer']), value: z.record(z.unknown()) },
    run: async (i, actor) => {
      const actual = await getSetting<Record<string, unknown>>(i.key, {});
      const nuevo = { ...actual, ...i.value };
      await putSetting(i.key, nuevo, actor);
      return nuevo;
    },
  }),
  op({ name: 'alerts_list', title: 'Alertas', description: 'Alertas recientes (compras, consultas, errores, tracking, rechazos, presupuesto, autorizaciones).', input: { status: z.string().optional(), limit: z.number().int().max(200).optional() }, readOnly: true, run: async (i) => listAlerts(i) }),
  op({ name: 'audit_log', title: 'Registro de acciones', description: 'Registro de acciones importantes: quién, qué, nivel y decisión.', input: { limit: z.number().int().max(500).optional() }, readOnly: true, run: async (i) => (await db()).query('SELECT at, actor, action, tier, decision, target, details FROM smf.audit_log ORDER BY id DESC LIMIT $1', [i.limit ?? 50]) }),
  op({ name: 'schedules_list', title: 'Automatizaciones', description: 'Tareas programadas con su cron (hora argentina) y si están activas.', input: {}, readOnly: true, run: async () => (await db()).query('SELECT id, cron, job_type, enabled, description, last_slot FROM smf.schedules ORDER BY id') }),
  op({
    name: 'schedule_update',
    title: 'Ajustar automatización',
    description: 'Activa/desactiva una tarea programada o cambia su cron (5 campos, hora argentina).',
    input: { id: z.string(), enabled: z.boolean().optional(), cron: z.string().optional() },
    run: async (i) => {
      if (i.cron) (await import('./runtime/cron.ts')).parseCron(i.cron);
      const d = await db();
      const r = await d.query('UPDATE smf.schedules SET enabled = COALESCE($2, enabled), cron = COALESCE($3, cron), updated_at = now() WHERE id = $1 RETURNING *', [i.id, i.enabled ?? null, i.cron ?? null]);
      if (!r.length) throw new SmfError(`No existe la tarea ${i.id}.`, 'not_found');
      return r[0];
    },
  }),
];

export const OPS_BY_NAME = new Map(OPS.map((o) => [o.name, o]));

export async function runOp(name: string, input: unknown, actor: Actor): Promise<unknown> {
  const o = OPS_BY_NAME.get(name);
  if (!o) throw new SmfError(`No existe la operación «${name}».`, 'not_found');
  const parsed = z.object(o.input).strict().safeParse(input ?? {});
  if (!parsed.success) throw new SmfError(`Entrada inválida para ${name}: ${parsed.error.issues.map((x) => `${x.path.join('.') || '(raíz)'}: ${x.message}`).join('; ')}`, 'bad_input');
  return o.run(parsed.data as never, actor);
}
