/**
 * Aplica las migraciones de `supabase/migrations` contra el proyecto configurado.
 *
 *   npx tsx scripts/migrate.ts
 *
 * Usa la Management API de Supabase, así que no hace falta tener instalado el
 * CLI ni acceso directo a Postgres. Las migraciones se corren en orden
 * alfabético y el script se detiene en la primera que falle.
 *
 * Alternativa manual: pegar cada archivo en el SQL Editor del dashboard.
 */

import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { config } from 'dotenv';

config({ path: '.env.local' });
config();

const ACCESS_TOKEN = process.env.SUPABASE_ACCESS_TOKEN;
const PROJECT_REF = process.env.SUPABASE_PROJECT_REF;

if (!ACCESS_TOKEN || !PROJECT_REF) {
  console.error(
    '\n✗ Faltan variables de entorno.\n' +
      '  SUPABASE_ACCESS_TOKEN: token personal de https://supabase.com/dashboard/account/tokens\n' +
      '  SUPABASE_PROJECT_REF: el identificador del proyecto (lo ves en la URL del dashboard)\n\n' +
      '  Si preferís no usar un token, pegá los archivos de supabase/migrations\n' +
      '  en el SQL Editor del dashboard, en orden.\n'
  );
  process.exit(1);
}

const MIGRATIONS_DIR = join(process.cwd(), 'supabase', 'migrations');

async function run() {
  const files = readdirSync(MIGRATIONS_DIR)
    .filter((file) => file.endsWith('.sql'))
    .sort();

  if (files.length === 0) {
    console.error('✗ No hay migraciones en supabase/migrations');
    process.exit(1);
  }

  for (const file of files) {
    process.stdout.write(`→ ${file} … `);

    const query = readFileSync(join(MIGRATIONS_DIR, file), 'utf8');
    const response = await fetch(
      `https://api.supabase.com/v1/projects/${PROJECT_REF}/database/query`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${ACCESS_TOKEN}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ query }),
      }
    );

    if (!response.ok) {
      console.log('✗');
      console.error(`\n  ${await response.text()}\n`);
      process.exit(1);
    }

    console.log('✓');
  }

  console.log('\n✓ Migraciones aplicadas. Ahora podés correr `npm run demo:seed`.\n');
}

run().catch((error) => {
  console.error('\n✗ Error inesperado:', error);
  process.exit(1);
});
