/**
 * Descubrimiento: qué repositorios hay y cuáles podrían ser productos.
 *
 * Nunca agrega un producto al catálogo por su cuenta. Mira los repos (los
 * clonados al lado y, si se configura SMF_GITHUB_OWNER, la lista pública de
 * GitHub), junta señales —menciona a SOVARE, tiene /conv, tiene precios, se
 * llama «…OS»— y avisa de lo que no está clasificado en catalog/ecosystem.json.
 * Que algo sea anunciable lo decide el dueño escribiendo su archivo.
 */

import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { execFileSync } from 'node:child_process';
import { config } from '../config.ts';
import { notify } from '../notify/index.ts';
import { loadCatalog } from './index.ts';

export interface RepoSignal {
  repo: string;
  path?: string;
  description?: string;
  signals: string[];
  score: number;
  classified: boolean;
  role?: string;
}

interface Ecosystem {
  entries: { repo: string; role: string; product?: string; status?: string; note?: string }[];
}

export function loadEcosystem(): Ecosystem {
  return JSON.parse(readFileSync(join(config.catalogDir, 'ecosystem.json'), 'utf8')) as Ecosystem;
}

function readIf(path: string, max = 200_000): string {
  try {
    return existsSync(path) ? readFileSync(path, 'utf8').slice(0, max) : '';
  } catch {
    return '';
  }
}

function originOf(path: string): string | null {
  try {
    const url = execFileSync('git', ['-C', path, 'remote', 'get-url', 'origin'], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim();
    const m = url.match(/github\.com[/:]([^/]+\/[^/.]+)/i);
    return m ? m[1] : null;
  } catch {
    return null;
  }
}

export function scanLocal(dirs = [config.reposDir, join(config.dataDir, 'repos')]): RepoSignal[] {
  const out: RepoSignal[] = [];
  const seen = new Set<string>();
  const walk = (dir: string, depth: number) => {
    if (!existsSync(dir) || depth > 1) return;
    for (const name of readdirSync(dir)) {
      const path = join(dir, name);
      if (name.startsWith('.') || name === 'node_modules') continue;
      if (existsSync(join(path, '.git'))) {
        const repo = originOf(path) ?? name;
        if (seen.has(repo.toLowerCase())) continue;
        seen.add(repo.toLowerCase());
        out.push(signalsFor(repo, path));
      } else if (depth === 0) {
        try {
          if (readdirSync(path).length) walk(path, depth + 1);
        } catch {
          /* no es una carpeta */
        }
      }
    }
  };
  for (const d of dirs) walk(d, 0);
  return out;
}

function signalsFor(repo: string, path: string): RepoSignal {
  const readme = readIf(join(path, 'README.md'));
  const pkg = readIf(join(path, 'package.json'));
  const signals: string[] = [];
  let score = 0;
  if (/sovare/i.test(readme + pkg)) (signals.push('menciona SOVARE'), (score += 3));
  if (existsSync(join(path, 'src', 'app', 'conv'))) (signals.push('tiene /conv'), (score += 3));
  if (/OS$|Ops$/i.test(repo.split('/').pop() ?? '')) (signals.push('nombre «…OS»'), (score += 1));
  if (/precio|pricing|planes|plans/i.test(readme)) (signals.push('habla de precios'), (score += 1));
  if (/multi-?inquilino|multi-?tenant|SaaS/i.test(readme)) (signals.push('SaaS/multi-inquilino'), (score += 1));
  const description = (pkg.match(/"description"\s*:\s*"([^"]+)"/)?.[1] ?? readme.split('\n').find((l) => l.trim() && !l.startsWith('#')) ?? '').slice(0, 160);
  return { repo, path, description, signals, score, classified: false };
}

/** Lista pública de repos de un dueño de GitHub (sin token alcanza para los públicos). */
export async function scanGitHub(owner: string): Promise<RepoSignal[]> {
  const headers: Record<string, string> = { Accept: 'application/vnd.github+json' };
  if (process.env.GITHUB_TOKEN) headers.Authorization = `Bearer ${process.env.GITHUB_TOKEN}`;
  const r = await fetch(`https://api.github.com/users/${owner}/repos?per_page=100&sort=pushed`, { headers, signal: AbortSignal.timeout(15_000) });
  if (!r.ok) throw new Error(`GitHub respondió ${r.status}`);
  const repos = (await r.json()) as { full_name: string; description: string | null; pushed_at: string }[];
  return repos.map((x) => ({ repo: x.full_name, description: x.description ?? '', signals: [], score: 0, classified: false }));
}

export async function discover({ github = process.env.SMF_GITHUB_OWNER, alert = true } = {}): Promise<{ repos: RepoSignal[]; unclassified: RepoSignal[]; products: string[] }> {
  const eco = loadEcosystem();
  const known = new Map(eco.entries.map((e) => [e.repo.toLowerCase(), e]));
  const byRepo = new Map<string, RepoSignal>();
  for (const s of scanLocal()) byRepo.set(s.repo.toLowerCase(), s);
  if (github) {
    try {
      for (const s of await scanGitHub(github)) if (!byRepo.has(s.repo.toLowerCase())) byRepo.set(s.repo.toLowerCase(), s);
    } catch (e) {
      console.warn('[discover] no se pudo listar GitHub:', e instanceof Error ? e.message : e);
    }
  }
  const repos = [...byRepo.values()].map((s) => {
    const k = known.get(s.repo.toLowerCase());
    return { ...s, classified: !!k, role: k?.role };
  });
  const unclassified = repos.filter((r) => !r.classified && r.repo.includes('/')).sort((a, b) => b.score - a.score);
  if (alert && unclassified.length) {
    await notify({
      kind: 'catalog_change',
      severity: unclassified.some((u) => u.score >= 3) ? 'warning' : 'info',
      title: `${unclassified.length} repositorio(s) sin clasificar`,
      body: unclassified.map((u) => `${u.repo} — ${u.signals.join(', ') || 'sin señales'}${u.description ? ` — ${u.description}` : ''}`).join('\n'),
      dedupKey: `discover:${unclassified.map((u) => u.repo).sort().join(',')}`,
      push: unclassified.some((u) => u.score >= 3),
    });
  }
  return { repos, unclassified, products: loadCatalog().map((p) => p.id) };
}
