/**
 * El respaldo de la base, comprobado.
 *
 *   npm run respaldo                     → respaldos/gastroos-AAAA-MM-DD.sql
 *
 * Hay que correrlo antes del primer cliente que paga, y después con la
 * frecuencia que aguante perder: Supabase guarda copias en los planes pagos,
 * pero «está en algún lado» no es un respaldo que uno haya visto.
 *
 * Y no termina en verde porque `pg_dump` terminó: se compara la lista de
 * tablas de la base con las que quedaron en el archivo, y si falta una, falla.
 * Un respaldo al que le falta la tabla de pedidos es un archivo que dice que
 * está todo bien el único día que importa.
 */

import { spawnSync } from 'node:child_process';
import { mkdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { conexionDeLaBase, entornoDePsql } from './comercial/credenciales.mjs';

const ESQUEMAS = ['public', 'sovare'];

function main() {
  const url = conexionDeLaBase();
  const env = entornoDePsql(url);
  mkdirSync('respaldos', { recursive: true });
  const fecha = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Argentina/Buenos_Aires' }).format(new Date());
  const archivo = join('respaldos', `gastroos-${fecha}.sql`);

  const dump = spawnSync('pg_dump', ['--no-owner', '--no-privileges', ...ESQUEMAS.flatMap((e) => ['-n', e]), '-f', archivo], {
    env,
    stdio: 'inherit',
  });
  if (dump.status !== 0) throw new Error(`pg_dump terminó con ${dump.status}`);

  const lista = spawnSync(
    'psql',
    ['-X', '-At', '-c', `select schemaname||'.'||tablename from pg_tables where schemaname in (${ESQUEMAS.map((e) => `'${e}'`).join(',')}) order by 1`],
    { env, encoding: 'utf8' }
  );
  if (lista.status !== 0) throw new Error(`no pude listar las tablas: ${lista.stderr}`);
  const tablas = lista.stdout.split('\n').filter(Boolean);
  const contenido = readFileSync(archivo, 'utf8');
  const faltan = tablas.filter((t) => !contenido.includes(`CREATE TABLE ${t} `) && !contenido.includes(`CREATE TABLE ${t}(`));
  const sinDatos = tablas.filter((t) => !contenido.includes(`COPY ${t} `));

  if (tablas.length === 0) throw new Error('la base no devolvió ninguna tabla: no hay nada que comparar');
  if (faltan.length || sinDatos.length) {
    throw new Error(`al respaldo le faltan tablas: ${[...faltan, ...sinDatos.map((t) => `${t} (datos)`)].join(', ')}`);
  }
  console.log(`\n✓ ${archivo} — ${tablas.length} tablas, ${(statSync(archivo).size / 1024 / 1024).toFixed(1)} MB\n`);
}

try {
  main();
} catch (e) {
  console.error(`\n✗ ${(e as Error).message}\n`);
  process.exit(1);
}
