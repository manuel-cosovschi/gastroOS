/**
 * Product Intelligence Engine.
 *
 * El catálogo (catalog/products/*.json) dice QUÉ se puede afirmar de cada
 * producto y DÓNDE está la prueba. Este módulo lo contrasta con el código real:
 *
 *   - cada evidencia (`file` + `contains`) se busca en el repo; si el texto ya no
 *     está, el claim o el ángulo que la usa deja de poder usarse en anuncios;
 *   - los precios se leen del archivo de precios del producto con el AST de
 *     TypeScript (no se ejecuta código del repo);
 *   - las funcionalidades salen de la tabla del README;
 *   - las capturas y grabaciones tienen que existir.
 *
 * Cada análisis queda como foto en `smf.product_snapshots`. Si algo cambia
 * (un precio, un claim que desaparece) se avisa y los conceptos que dependían
 * de eso pasan a `stale`: no se vuelven a usar hasta regenerarlos.
 */

import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import ts from 'typescript';
import { config } from '../config.ts';
import { db, j } from '../db/index.ts';
import { audit } from '../core/audit.ts';
import { sha256, SmfError } from '../core/util.ts';
import { notify } from '../notify/index.ts';
import { ensureRepo, resolveRepoFile } from './repos.ts';
import { Product, type Evidence, type ProductFacts } from './types.ts';

// ============================================================
// Carga
// ============================================================

export function loadCatalog(dir = config.catalogDir): Product[] {
  const pdir = join(dir, 'products');
  const out: Product[] = [];
  for (const f of readdirSync(pdir).filter((x) => x.endsWith('.json')).sort()) {
    const raw = JSON.parse(readFileSync(join(pdir, f), 'utf8'));
    const parsed = Product.safeParse(raw);
    if (!parsed.success) {
      throw new SmfError(`catalog/products/${f} no es válido: ${parsed.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join('; ')}`, 'catalog_invalid');
    }
    if (`${parsed.data.id}.json` !== f) throw new SmfError(`catalog/products/${f}: el id (${parsed.data.id}) tiene que coincidir con el nombre del archivo.`, 'catalog_invalid');
    out.push(parsed.data);
  }
  return out;
}

export function getProduct(id: string): Product {
  const p = loadCatalog().find((x) => x.id === id);
  if (!p) throw new SmfError(`No hay un producto «${id}» en el catálogo.`, 'not_found');
  return p;
}

// ============================================================
// Análisis
// ============================================================

const norm = (s: string) => s.replace(/\s+/g, ' ').trim();

export function checkEvidence(p: Product, ev: Evidence): { ok: boolean; reason?: string } {
  const path = resolveRepoFile(p, ev.file);
  if (!existsSync(path)) return { ok: false, reason: `no existe ${ev.file}` };
  const text = norm(readFileSync(path, 'utf8'));
  return text.includes(norm(ev.contains)) ? { ok: true } : { ok: false, reason: `${ev.file} ya no dice «${ev.contains.slice(0, 60)}…»` };
}

export function analyzeProduct(p: Product, { refresh = false } = {}): ProductFacts {
  const repo = ensureRepo(p, { refresh });
  const evidence: ProductFacts['evidence'] = [];
  const check = (ref: string, ev: Evidence) => {
    const r = checkEvidence(p, ev);
    evidence.push({ ref, ok: r.ok, file: ev.file, reason: r.reason });
    return r.ok;
  };

  for (const a of p.audiences) check(`audience:${a.id}`, a.evidence);
  for (const n of p.not_for) check('not_for', n.evidence);
  const verifiedAngles = p.angles.filter((a) => check(`angle:${a.id}`, a.evidence)).map((a) => a.id);
  const verifiedClaims = p.claims.filter((c) => check(`claim:${c.id}`, c.evidence)).map((c) => c.id);
  check('pricing:as_of', p.pricing.as_of_evidence);
  if (p.brand.evidence) check('brand', p.brand.evidence);

  let pricing: ProductFacts['pricing'];
  try {
    const plans = extractPlans(p);
    pricing = { plans, ok: plans.length > 0, reason: plans.length ? undefined : 'no se encontraron planes' };
  } catch (e) {
    pricing = { plans: [], ok: false, reason: e instanceof Error ? e.message : String(e) };
  }

  let features: ProductFacts['features'] = [];
  if (p.features_extract) {
    try {
      features = mdTable(readFileSync(resolveRepoFile(p, p.features_extract.file), 'utf8'), p.features_extract.section ?? '').map(([name, description]) => ({ name, description }));
    } catch {
      features = [];
    }
  }

  const assets = p.assets.map((a) => {
    const path = resolveRepoFile(p, a.file);
    if (!existsSync(path)) return { id: a.id, ok: false, reason: `no existe ${a.file}` };
    return { id: a.id, ok: true, bytes: statSync(path).size };
  });

  return {
    productId: p.id,
    commit: repo.commit,
    analyzedAt: new Date().toISOString(),
    evidence,
    pricing,
    features,
    assets,
    verifiedClaims,
    verifiedAngles,
  };
}

/** Los planes con los nombres de campo normalizados (`map` del catálogo). */
export function extractPlans(p: Product): Record<string, unknown>[] {
  const ex = p.pricing.extract;
  const src = readFileSync(resolveRepoFile(p, ex.file), 'utf8');
  let value = tsConst(src, ex.name ?? '');
  if (ex.path) for (const k of ex.path.split('.')) value = (value as Record<string, unknown> | undefined)?.[k];
  if (!Array.isArray(value)) throw new Error(`${ex.file}: ${ex.name}${ex.path ? `.${ex.path}` : ''} no es una lista`);
  return value.map((plan) => {
    if (!ex.map) return plan as Record<string, unknown>;
    const out: Record<string, unknown> = {};
    for (const [to, from] of Object.entries(ex.map)) out[to] = (plan as Record<string, unknown>)[from] ?? null;
    return out;
  });
}

/**
 * El valor literal de una constante de un archivo TypeScript, sin ejecutarlo.
 * Lo que no es literal (una variable de entorno, una llamada) queda en null.
 */
export function tsConst(source: string, name: string): unknown {
  const sf = ts.createSourceFile('x.ts', source, ts.ScriptTarget.Latest, true);
  let found: ts.Expression | undefined;
  const visit = (n: ts.Node) => {
    if (found) return;
    if (ts.isVariableDeclaration(n) && ts.isIdentifier(n.name) && n.name.text === name && n.initializer) found = n.initializer;
    else ts.forEachChild(n, visit);
  };
  visit(sf);
  if (!found) throw new Error(`no se encontró la constante ${name}`);
  return literal(found);
}

function literal(e: ts.Expression): unknown {
  if (ts.isAsExpression(e) || ts.isSatisfiesExpression(e) || ts.isParenthesizedExpression(e) || ts.isTypeAssertionExpression(e)) return literal(e.expression);
  if (ts.isStringLiteral(e) || ts.isNoSubstitutionTemplateLiteral(e)) return e.text;
  if (ts.isNumericLiteral(e)) return Number(e.getText().replace(/_/g, ''));
  if (e.kind === ts.SyntaxKind.TrueKeyword) return true;
  if (e.kind === ts.SyntaxKind.FalseKeyword) return false;
  if (e.kind === ts.SyntaxKind.NullKeyword) return null;
  if (ts.isPrefixUnaryExpression(e) && e.operator === ts.SyntaxKind.MinusToken) {
    const v = literal(e.operand);
    return typeof v === 'number' ? -v : null;
  }
  if (ts.isArrayLiteralExpression(e)) return e.elements.map((x) => (ts.isSpreadElement(x) ? null : literal(x)));
  if (ts.isObjectLiteralExpression(e)) {
    const o: Record<string, unknown> = {};
    for (const prop of e.properties) {
      if (ts.isPropertyAssignment(prop)) {
        const key = ts.isIdentifier(prop.name) || ts.isStringLiteral(prop.name) || ts.isNumericLiteral(prop.name) ? prop.name.text : null;
        if (key !== null) o[key] = literal(prop.initializer);
      }
    }
    return o;
  }
  return null;
}

/** Las filas de la primera tabla de una sección de un markdown, sin negritas. */
export function mdTable(md: string, section: string): [string, string][] {
  const lines = md.split('\n');
  let start = -1;
  let level = 0;
  for (let i = 0; i < lines.length; i++) {
    const m = lines[i].match(/^(#+)\s+(.*)$/);
    if (m && norm(m[2]) === norm(section)) {
      start = i + 1;
      level = m[1].length;
      break;
    }
  }
  if (start < 0) return [];
  const rows: [string, string][] = [];
  let enTabla = false;
  for (let i = start; i < lines.length; i++) {
    const h = lines[i].match(/^(#+)\s/);
    if (h && h[1].length <= level) break;
    const l = lines[i].trim();
    if (l.startsWith('|')) {
      enTabla = true;
      const cells = l.split('|').slice(1, -1).map((c) => c.replace(/\*\*/g, '').trim());
      if (cells.length < 2 || /^:?-+:?$/.test(cells[0]) || !cells[0]) continue;
      rows.push([cells[0], cells[1]]);
    } else if (enTabla) break;
  }
  // La primera fila es el encabezado si la segunda línea de la tabla es el separador.
  return rows.length && /qué|módulo|columna/i.test(rows[0][0]) ? rows.slice(1) : rows;
}

// ============================================================
// Sincronización con la base y detección de cambios
// ============================================================

export interface SyncResult {
  product: string;
  marketable: boolean;
  changed: boolean;
  changes: string[];
  facts: ProductFacts;
}

export async function syncCatalog({ refresh = false, actor = 'system' }: { refresh?: boolean; actor?: string } = {}): Promise<SyncResult[]> {
  const d = await db();
  const results: SyncResult[] = [];
  for (const p of loadCatalog()) {
    const facts = analyzeProduct(p, { refresh });
    const huella = sha256(JSON.stringify({ p, pricing: facts.pricing.plans, features: facts.features, c: facts.verifiedClaims, a: facts.verifiedAngles, as: facts.assets.map((x) => [x.id, x.ok]) }));
    const [prev] = await d.query<{ hash: string; data: { facts: ProductFacts; product: Product } }>(
      'SELECT hash, data FROM smf.product_snapshots WHERE product_id = $1 ORDER BY id DESC LIMIT 1',
      [p.id]
    );
    const changes = prev ? diffFacts(prev.data.facts, facts, prev.data.product, p) : ['primera foto del producto'];
    const changed = !prev || prev.hash !== huella;
    await d.query(
      `INSERT INTO smf.products (id, data, hash, marketable) VALUES ($1, $2::jsonb, $3, $4)
       ON CONFLICT (id) DO UPDATE SET data = EXCLUDED.data, hash = EXCLUDED.hash, marketable = EXCLUDED.marketable, updated_at = now()`,
      [p.id, j({ product: p, facts }), huella, p.marketable && p.status === 'active']
    );
    if (changed) {
      await d.query('INSERT INTO smf.product_snapshots (product_id, hash, data, changes) VALUES ($1,$2,$3::jsonb,$4::jsonb)', [p.id, huella, j({ product: p, facts }), j(changes)]);
      if (prev) {
        const perdidos = facts.evidence.filter((e) => !e.ok).map((e) => e.ref);
        const preciosCambiaron = changes.some((c) => c.startsWith('precio'));
        // Los conceptos que usaban algo que ya no se puede afirmar no se vuelven a usar.
        await d.query(
          `UPDATE smf.concepts SET status = 'stale' WHERE product_id = $1 AND status <> 'stale' AND (
             EXISTS (SELECT 1 FROM jsonb_array_elements_text(claims) c WHERE c = ANY($2::text[]))
             OR ($3 AND EXISTS (SELECT 1 FROM jsonb_array_elements_text(claims) c WHERE c LIKE 'plan:%')))`,
          [p.id, perdidos, preciosCambiaron]
        );
        if (changes.length) {
          await notify({
            kind: 'catalog_change',
            severity: perdidos.length ? 'warning' : 'info',
            title: `${p.name}: cambió el producto`,
            body: changes.join('\n'),
            dedupKey: `catalog:${p.id}:${huella}`,
            push: perdidos.length > 0,
          });
        }
      }
    }
    await audit({ actor, action: 'catalog.sync', decision: 'done', target: p.id, details: { changed, changes, commit: facts.commit } });
    results.push({ product: p.id, marketable: p.marketable && p.status === 'active', changed, changes, facts });
  }
  return results;
}

function diffFacts(a: ProductFacts, b: ProductFacts, pa: Product, pb: Product): string[] {
  const out: string[] = [];
  const planKey = (x: Record<string, unknown>) => String(x.id ?? x.name);
  const pa_ = new Map(a.pricing.plans.map((x) => [planKey(x), x]));
  for (const plan of b.pricing.plans) {
    const old = pa_.get(planKey(plan));
    if (!old) out.push(`precio: plan nuevo ${planKey(plan)}`);
    else if (old.monthly !== plan.monthly || old.setup !== plan.setup) out.push(`precio: ${planKey(plan)} pasó de ${old.monthly}/${old.setup} a ${plan.monthly}/${plan.setup}`);
    pa_.delete(planKey(plan));
  }
  for (const k of pa_.keys()) out.push(`precio: se quitó el plan ${k}`);
  const lost = (x: string[], y: string[], what: string) => x.filter((i) => !y.includes(i)).forEach((i) => out.push(`${what} ya no verificable: ${i}`));
  lost(a.verifiedClaims, b.verifiedClaims, 'claim');
  lost(a.verifiedAngles, b.verifiedAngles, 'ángulo');
  for (const f of b.features) if (!a.features.some((x) => x.name === f.name)) out.push(`funcionalidad nueva en el README: ${f.name}`);
  for (const f of a.features) if (!b.features.some((x) => x.name === f.name)) out.push(`funcionalidad que ya no figura: ${f.name}`);
  for (const as of b.assets) if (!as.ok && a.assets.find((x) => x.id === as.id)?.ok) out.push(`falta el recurso ${as.id}`);
  if (a.commit && b.commit && a.commit !== b.commit) out.push(`repo en ${b.commit.slice(0, 7)} (antes ${a.commit.slice(0, 7)})`);
  if (JSON.stringify(pa) !== JSON.stringify(pb)) out.push('se editó el archivo del catálogo');
  return out;
}

export async function catalogFromDb(): Promise<{ id: string; marketable: boolean; product: Product; facts: ProductFacts; updated_at: string }[]> {
  const d = await db();
  const rows = await d.query<{ id: string; marketable: boolean; data: { product: Product; facts: ProductFacts }; updated_at: string }>('SELECT id, marketable, data, updated_at FROM smf.products ORDER BY id');
  return rows.map((r) => ({ id: r.id, marketable: r.marketable, product: r.data.product, facts: r.data.facts, updated_at: r.updated_at }));
}

/** Producto + hechos verificados, sincronizando si todavía no hay foto. */
export async function productWithFacts(id: string): Promise<{ product: Product; facts: ProductFacts }> {
  const rows = (await catalogFromDb()).filter((r) => r.id === id);
  if (rows.length) return { product: getProduct(id), facts: rows[0].facts };
  const r = (await syncCatalog()).find((x) => x.product === id);
  if (!r) throw new SmfError(`No hay un producto «${id}» en el catálogo.`, 'not_found');
  return { product: getProduct(id), facts: r.facts };
}
