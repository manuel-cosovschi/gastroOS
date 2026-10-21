/**
 * Creative Engine: de un concepto a archivos listos para subir.
 *
 * `renderCreative` arma el proyecto editable, renderiza, valida y deja todo en
 * `out/creatives/<id>/` (video, póster, subtítulos, proyecto y la página HTML
 * de la composición). Un creativo que no pasa la validación queda `invalid` y
 * no se puede subir a Meta.
 */

import { existsSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { config } from '../config.ts';
import { db, j } from '../db/index.ts';
import { audit, type Actor } from '../core/audit.ts';
import { require } from '../core/policy.ts';
import { newId, SmfError } from '../core/util.ts';
import { productWithFacts } from '../catalog/index.ts';
import { getConcept } from './concepts.ts';
import { FORMATS, isFormat, type FormatId } from './formats.ts';
import { buildProject, type Project } from './project.ts';
import { readProject, renderProject } from './render.ts';
import { validateVideo, type Validation } from './validate.ts';

export interface Creative {
  id: string;
  concept_id: string;
  product_id: string;
  format: FormatId;
  width: number;
  height: number;
  duration_s: string | number;
  path: string | null;
  poster_path: string | null;
  project_path: string | null;
  bytes: number | null;
  sha256: string | null;
  status: 'queued' | 'rendering' | 'ready' | 'invalid' | 'failed' | 'stale';
  validation: Validation | Record<string, never>;
  public_url: string | null;
  meta_video_id: string | null;
  created_at: string;
}

export async function renderCreative(conceptId: string, format: FormatId, opts: { actor?: Actor; duration?: number } = {}): Promise<Creative> {
  const actor: Actor = opts.actor ?? 'system';
  await require({ action: 'creative.render', actor, target: conceptId });
  if (!isFormat(format)) throw new SmfError(`Formato desconocido: ${format}. Opciones: ${Object.keys(FORMATS).join(', ')}`, 'bad_format');
  const concept = await getConcept(conceptId);
  if (concept.status === 'stale') throw new SmfError('Ese concepto quedó viejo (cambió el producto). Generá uno nuevo.', 'stale');
  const { product, facts } = await productWithFacts(concept.product_id);
  const id = newId('crv');
  const project = buildProject({ creativeId: id, product, facts, concept, format, duration: opts.duration });
  const d = await db();
  await d.query(
    `INSERT INTO smf.creatives (id, concept_id, product_id, format, width, height, duration_s, status) VALUES ($1,$2,$3,$4,$5,$6,$7,'rendering')`,
    [id, conceptId, concept.product_id, format, project.width, project.height, project.duration]
  );
  return finishRender(id, project, actor);
}

/** Vuelve a renderizar un proyecto editado a mano (mismo id de creativo). */
export async function rerenderProject(projectPath: string, actor: Actor = 'owner'): Promise<Creative> {
  const project = readProject(projectPath);
  const d = await db();
  await d.query(`UPDATE smf.creatives SET status = 'rendering', updated_at = now() WHERE id = $1`, [project.creativeId]);
  return finishRender(project.creativeId, project, actor);
}

async function finishRender(id: string, project: Project, actor: Actor): Promise<Creative> {
  const d = await db();
  const dir = join(config.outDir, 'creatives', id);
  try {
    const out = await renderProject(project, dir);
    const validation = validateVideo(out.video, project.format, { duration: project.duration });
    const hash = createHash('sha256').update(readFileSync(out.video)).digest('hex');
    await d.query(
      `UPDATE smf.creatives SET path=$2, poster_path=$3, project_path=$4, bytes=$5, sha256=$6, status=$7, validation=$8::jsonb, updated_at=now() WHERE id=$1`,
      [id, out.video, existsSync(out.poster) ? out.poster : null, out.project, statSync(out.video).size, hash, validation.ok ? 'ready' : 'invalid', j(validation)]
    );
    await audit({ actor, action: 'creative.render', decision: validation.ok ? 'done' : 'failed', target: id, details: { format: project.format, ms: out.ms, errors: validation.errors } });
  } catch (e) {
    await d.query(`UPDATE smf.creatives SET status='failed', validation=$2::jsonb, updated_at=now() WHERE id=$1`, [id, j({ ok: false, errors: [e instanceof Error ? e.message : String(e)] })]);
    await audit({ actor, action: 'creative.render', decision: 'failed', target: id, details: { error: e instanceof Error ? e.message : String(e) } });
    throw e;
  }
  return getCreative(id);
}

export async function getCreative(id: string): Promise<Creative> {
  const d = await db();
  const [c] = await d.query<Creative>('SELECT * FROM smf.creatives WHERE id = $1', [id]);
  if (!c) throw new SmfError(`No existe el creativo ${id}.`, 'not_found');
  return c;
}

export async function listCreatives(filter: { product?: string; status?: string } = {}): Promise<Creative[]> {
  const d = await db();
  const where: string[] = [];
  const params: unknown[] = [];
  if (filter.product) (params.push(filter.product), where.push(`product_id = $${params.length}`));
  if (filter.status) (params.push(filter.status), where.push(`status = $${params.length}`));
  return d.query<Creative>(`SELECT * FROM smf.creatives ${where.length ? `WHERE ${where.join(' AND ')}` : ''} ORDER BY created_at DESC LIMIT 200`, params);
}
