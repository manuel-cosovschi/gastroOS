/**
 * Arma el paquete de la Skill para Cowork / claude.ai: un ZIP con la carpeta
 * `sovare-marketing-factory/` en la raíz (lo que pide «Subir skill»).
 *
 *   npm run skill:pack   →  dist/sovare-marketing-factory.zip
 *
 * Antes de empaquetar revisa el frontmatter y que no se cuele ningún secreto.
 */

import { execFileSync } from 'node:child_process';
import { mkdirSync, readdirSync, readFileSync, rmSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

const ROOT = join(import.meta.dirname, '..');
const SKILL = join(ROOT, 'skill', 'sovare-marketing-factory');
const OUT = join(ROOT, 'dist', 'sovare-marketing-factory.zip');

const md = readFileSync(join(SKILL, 'SKILL.md'), 'utf8');
const fm = md.match(/^---\n([\s\S]*?)\n---/);
if (!fm) throw new Error('SKILL.md sin frontmatter');
const name = fm[1].match(/^name:\s*(.+)$/m)?.[1].trim();
const desc = fm[1].match(/^description:\s*(.+)$/m)?.[1].trim() ?? '';
if (name !== 'sovare-marketing-factory') throw new Error(`name inesperado: ${name}`);
if (!/^[a-z0-9-]{1,64}$/.test(name)) throw new Error('name inválido');
if (!desc || desc.length > 1024) throw new Error(`description de ${desc.length} caracteres (1 a 1024)`);

const files: string[] = [];
const walk = (d: string) => {
  for (const f of readdirSync(d)) {
    const p = join(d, f);
    if (statSync(p).isDirectory()) walk(p);
    else files.push(p);
  }
};
walk(SKILL);
const SECRETO = /(EAA[A-Za-z0-9]{20,}|sk-[A-Za-z0-9]{20,}|re_[A-Za-z0-9]{20,}|eyJhbGciOi[A-Za-z0-9._-]{30,}|xox[bp]-[A-Za-z0-9-]{20,}|\d{8,10}:AA[A-Za-z0-9_-]{30,})/;
for (const f of files) {
  if (SECRETO.test(readFileSync(f, 'utf8'))) throw new Error(`Posible secreto en ${relative(SKILL, f)}: no se empaqueta.`);
}

mkdirSync(join(ROOT, 'dist'), { recursive: true });
rmSync(OUT, { force: true });
execFileSync('zip', ['-qr', OUT, 'sovare-marketing-factory', '-x', '*.DS_Store'], { cwd: join(ROOT, 'skill') });
console.log(`✓ ${relative(ROOT, OUT)} (${files.length} archivos, ${(statSync(OUT).size / 1024).toFixed(1)} KB)`);
for (const f of files) console.log(`  ${relative(join(ROOT, 'skill'), f)}`);
