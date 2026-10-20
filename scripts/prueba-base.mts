/**
 * La batería de la base: `supabase/pruebas/auditoria.sql`, como dueño.
 *
 *   npm run prueba:base
 *
 * Necesita `psql` y la conexión en el archivo de credenciales (ver
 * `scripts/comercial/credenciales.mts`). No escribe nada: el SQL corre adentro
 * de una transacción que termina en ROLLBACK.
 */

import { spawnSync } from 'node:child_process';
import { conexionDeLaBase, entornoDePsql } from './comercial/credenciales.mjs';

let url: string;
try {
  url = conexionDeLaBase();
} catch (e) {
  console.error(`\n✗ ${(e as Error).message}\n`);
  process.exit(2);
}

// La conexión va por las variables que lee `psql`, no en los argumentos: los
// argumentos de un proceso los ve cualquiera con `ps`.
const r = spawnSync('psql', ['-X', '-v', 'ON_ERROR_STOP=1', '-f', 'supabase/pruebas/auditoria.sql'], {
  env: entornoDePsql(url),
  stdio: 'inherit',
});
console.log(r.status === 0 ? '\n✓ La base pasa la auditoría.\n' : '\n✗ La auditoría de la base falló: el motivo está arriba.\n');
process.exit(r.status ?? 1);
