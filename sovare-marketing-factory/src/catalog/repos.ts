/**
 * Dónde están los repositorios de los productos.
 *
 * Primero busca el clon local (`SMF_REPOS_DIR/<local>`); si no está, clona en
 * `SMF_DATA_DIR/repos` con `--depth 1` desde la URL pública del catálogo. En el
 * servicio persistente eso es lo que mantiene al día el análisis: cada corrida
 * de `catalog.analyze` hace `git fetch` de la rama de producción.
 *
 * Sólo lectura. La Factory nunca escribe en los repositorios de los productos.
 */

import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { config } from '../config.ts';
import type { Product } from './types.ts';

export function repoPath(p: Product): string {
  const local = join(config.reposDir, p.repo.local);
  if (existsSync(join(local, '.git'))) return local;
  return join(config.dataDir, 'repos', p.repo.local);
}

/** Resuelve `gastroOS/README.md` a una ruta absoluta usando el repo del producto. */
export function resolveRepoFile(p: Product, file: string): string {
  const [first, ...rest] = file.split('/');
  if (first === p.repo.local) return join(repoPath(p), ...rest);
  // Un archivo de otro repo (por ejemplo, un caso de cliente): se busca al lado.
  return join(config.reposDir, file);
}

export function ensureRepo(p: Product, { refresh = false } = {}): { path: string; commit: string | null; fetched: boolean; error?: string } {
  const path = repoPath(p);
  try {
    if (!existsSync(join(path, '.git'))) {
      mkdirSync(join(config.dataDir, 'repos'), { recursive: true });
      execFileSync('git', ['clone', '--depth', '1', '--branch', p.repo.branch, p.repo.git, path], { stdio: 'pipe', timeout: 300_000, env: { ...process.env, GIT_LFS_SKIP_SMUDGE: '1' } });
      return { path, commit: head(path), fetched: true };
    }
    if (refresh && path.startsWith(config.dataDir)) {
      // Sólo se actualiza el clon propio: un checkout local del desarrollador
      // puede tener trabajo sin subir y no se toca.
      execFileSync('git', ['-C', path, 'fetch', '--depth', '1', 'origin', p.repo.branch], { stdio: 'pipe', timeout: 300_000 });
      execFileSync('git', ['-C', path, 'reset', '--hard', 'FETCH_HEAD'], { stdio: 'pipe' });
      return { path, commit: head(path), fetched: true };
    }
    return { path, commit: head(path), fetched: false };
  } catch (e) {
    return { path, commit: existsSync(join(path, '.git')) ? head(path) : null, fetched: false, error: e instanceof Error ? e.message.split('\n')[0] : String(e) };
  }
}

function head(path: string): string | null {
  try {
    return execFileSync('git', ['-C', path, 'rev-parse', 'HEAD'], { encoding: 'utf8' }).trim();
  } catch {
    return null;
  }
}
