/**
 * Conceptos publicitarios.
 *
 * Un concepto es: un ángulo verificado (titular + bajada que el producto ya usa
 * en su /conv, con la variante `?v=` correspondiente), dos o tres claims
 * verificados que lo sostienen, opcionalmente el precio de entrada, un CTA y
 * una plantilla visual. No hay texto inventado: las piezas salen del catálogo y
 * de los hechos que el análisis comprobó en el repo.
 *
 * Claude (desde Cowork) puede escribir copys propios con `createCustomConcept`;
 * pasan por el mismo validador y se rechazan si afirman algo sin respaldo.
 */

import { db, j } from '../db/index.ts';
import { audit } from '../core/audit.ts';
import { newId, SmfError } from '../core/util.ts';
import { productWithFacts } from '../catalog/index.ts';
import type { Angle, Claim, Product, ProductFacts } from '../catalog/types.ts';
import { checkCopy, type CopyCheck } from './copy.ts';

export const TEMPLATES = ['demo', 'tour', 'kinetic'] as const;
export type Template = (typeof TEMPLATES)[number];

export interface Concept {
  id: string;
  product_id: string;
  angle: string;
  hook: string;
  headline: string;
  primary_text: string;
  cta: string;
  claims: string[];
  variant: string;
  status: string;
  created_by: string;
  created_at?: string;
  /** Lo que no va a la base como columna, pero sí en `claims` / el proyecto. */
  meta?: ConceptMeta;
}

export interface ConceptMeta {
  template: Template;
  eyebrow: string;
  body: string;
  bullets: string[];
  price?: { line: string; note: string; planId: string };
  assets: string[];
  check: CopyCheck;
}

/** El precio de entrada: el plan más barato con precio cerrado. */
export function entryPrice(product: Product, facts: ProductFacts): ConceptMeta['price'] | undefined {
  const cerrados = facts.pricing.plans.filter((p) => typeof p.monthly === 'number' && !p.from);
  if (!cerrados.length) return undefined;
  const min = cerrados.reduce((a, b) => ((a.monthly as number) <= (b.monthly as number) ? a : b));
  return {
    line: `Desde $${(min.monthly as number).toLocaleString('es-AR')} por mes`,
    note: product.pricing.price_note,
    planId: String(min.id ?? min.name),
  };
}

function pickClaims(product: Product, facts: ProductFacts, angle: Angle, n: number, offset: number): Claim[] {
  const usables = product.claims.filter((c) => facts.verifiedClaims.includes(c.id) && c.kind !== 'offer');
  // Que el bullet no repita lo que ya dice el ángulo.
  const libres = usables.filter((c) => !angle.body.toLowerCase().includes(c.text.toLowerCase().slice(0, 20)));
  const out: Claim[] = [];
  for (let i = 0; i < libres.length && out.length < n; i++) out.push(libres[(i + offset) % libres.length]);
  return out;
}

function buildCopy(product: Product, angle: Angle, bullets: Claim[], price: ConceptMeta['price'], cta: string) {
  const lines = [angle.body, '', ...bullets.map((b) => `✓ ${b.text}.`)];
  if (price) lines.push('', `${price.line}.${price.note ? ` ${price.note}` : ''}`);
  lines.push('', `${cta}: ${new URL(product.urls.conv).host}${new URL(product.urls.conv).pathname}`);
  return {
    hook: angle.eyebrow,
    headline: angle.headline,
    primary_text: lines.join('\n').trim(),
    cta,
  };
}

export interface GenerateOptions {
  count?: number;
  angles?: string[];
  templates?: Template[];
  withPrice?: boolean;
  createdBy?: string;
}

/**
 * Genera `count` conceptos nuevos combinando ángulos × claims × plantillas.
 * No repite combinaciones que ya existen y no usa ángulos o claims sin verificar.
 */
export async function generateConcepts(productId: string, opts: GenerateOptions = {}): Promise<Concept[]> {
  const { product, facts } = await productWithFacts(productId);
  if (!product.marketable) throw new SmfError(`${product.name} no está marcado como anunciable en el catálogo.`, 'not_marketable');
  const angles = product.angles.filter((a) => facts.verifiedAngles.includes(a.id) && (!opts.angles || opts.angles.includes(a.id)));
  if (!angles.length) throw new SmfError(`${product.name}: no hay ángulos verificados${opts.angles ? ` entre ${opts.angles.join(', ')}` : ''}.`, 'no_angles');

  const d = await db();
  const existentes = new Set(
    (await d.query<{ variant: string }>(`SELECT variant FROM smf.concepts WHERE product_id = $1 AND status <> 'stale'`, [productId])).map((r) => r.variant)
  );
  const templates = opts.templates ?? [...TEMPLATES];
  const price = opts.withPrice === false ? undefined : entryPrice(product, facts);
  const count = opts.count ?? 3;
  const out: Concept[] = [];

  // Recorre la grilla en un orden que reparte: primero un concepto por ángulo,
  // después cambia de plantilla, después de combinación de claims y CTA.
  for (let ronda = 0; out.length < count && ronda < 12; ronda++) {
    for (const angle of angles) {
      if (out.length >= count) break;
      const template = templates[(ronda + angles.indexOf(angle)) % templates.length];
      const conPrecio = !!price && ronda % 2 === 0;
      const cta = product.cta.options[ronda % product.cta.options.length] ?? product.cta.default;
      const variant = `${angle.id}|${template}|${ronda % 3}|${conPrecio ? 'p' : 'np'}|${cta}`;
      if (existentes.has(variant)) continue;
      const bullets = pickClaims(product, facts, angle, template === 'kinetic' ? 3 : 2, ronda);
      const copy = buildCopy(product, angle, bullets, conPrecio ? price : undefined, cta);
      const check = checkCopy(copy, product, facts);
      if (!check.ok) {
        await audit({ actor: opts.createdBy ?? 'system', action: 'creative.generate', decision: 'denied', target: productId, details: { variant, errors: check.errors } });
        continue;
      }
      const usedClaims = [...bullets.map((b) => b.id), `angle:${angle.id}`, ...(conPrecio && price ? [`plan:${price.planId}`] : [])];
      const meta: ConceptMeta = {
        template,
        eyebrow: angle.eyebrow,
        body: angle.body,
        bullets: bullets.map((b) => b.text),
        price: conPrecio ? price : undefined,
        assets: angle.assets.filter((a) => facts.assets.find((x) => x.id === a)?.ok),
        check,
      };
      out.push(await saveConcept({ product_id: productId, angle: angle.id, ...copy, claims: usedClaims, variant, created_by: opts.createdBy ?? 'system' }, meta));
      existentes.add(variant);
    }
  }
  await audit({ actor: opts.createdBy ?? 'system', action: 'creative.generate', decision: 'done', target: productId, details: { created: out.map((c) => c.id) } });
  return out;
}

/** Un concepto con copy escrito a mano (por Claude o el dueño), validado igual. */
export async function createCustomConcept(input: {
  product: string;
  angle: string;
  hook: string;
  headline: string;
  primary_text: string;
  cta: string;
  bullets?: string[];
  template?: Template;
  createdBy: string;
}): Promise<{ concept?: Concept; check: CopyCheck }> {
  const { product, facts } = await productWithFacts(input.product);
  const angle = product.angles.find((a) => a.id === input.angle);
  if (!angle || !facts.verifiedAngles.includes(angle.id)) throw new SmfError(`El ángulo «${input.angle}» no existe o no está verificado. Ángulos: ${facts.verifiedAngles.join(', ')}`, 'bad_angle');
  // Los bullets tienen que ser claims verificados, textuales.
  const verificados = product.claims.filter((c) => facts.verifiedClaims.includes(c.id));
  const bullets = (input.bullets ?? []).map((b) => verificados.find((c) => c.text === b || c.id === b));
  const check = checkCopy(input, product, facts);
  if (bullets.some((b) => !b)) check.errors.push('cada bullet tiene que ser un claim verificado del catálogo (por id o texto exacto)');
  check.ok = check.errors.length === 0;
  if (!check.ok) return { check };
  const meta: ConceptMeta = {
    template: input.template ?? 'tour',
    eyebrow: input.hook,
    body: angle.body,
    bullets: (bullets as Claim[]).map((b) => b.text),
    assets: angle.assets.filter((a) => facts.assets.find((x) => x.id === a)?.ok),
    check,
  };
  const concept = await saveConcept(
    {
      product_id: input.product,
      angle: angle.id,
      hook: input.hook,
      headline: input.headline,
      primary_text: input.primary_text,
      cta: input.cta,
      claims: [...(bullets as Claim[]).map((b) => b.id), `angle:${angle.id}`],
      variant: `custom|${newId('v')}`,
      created_by: input.createdBy,
    },
    meta
  );
  return { concept, check };
}

async function saveConcept(c: Omit<Concept, 'id' | 'status' | 'meta'>, meta: ConceptMeta): Promise<Concept> {
  const d = await db();
  const id = newId('cpt');
  await d.query(
    `INSERT INTO smf.concepts (id, product_id, angle, hook, headline, primary_text, cta, claims, variant, created_by, meta)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8::jsonb,$9,$10,$11::jsonb)`,
    [id, c.product_id, c.angle, c.hook, c.headline, c.primary_text, c.cta, j(c.claims), c.variant, c.created_by, j(meta)]
  );
  return { id, ...c, status: 'draft', meta };
}

export async function getConcept(id: string): Promise<Concept> {
  const d = await db();
  const [c] = await d.query<Concept>('SELECT * FROM smf.concepts WHERE id = $1', [id]);
  if (!c) throw new SmfError(`No existe el concepto ${id}.`, 'not_found');
  return c;
}

export async function listConcepts(productId?: string): Promise<Concept[]> {
  const d = await db();
  return d.query<Concept>(
    `SELECT * FROM smf.concepts ${productId ? 'WHERE product_id = $1' : ''} ORDER BY created_at DESC LIMIT 200`,
    productId ? [productId] : []
  );
}
