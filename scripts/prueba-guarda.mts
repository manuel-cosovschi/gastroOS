/**
 * La prueba de la guarda de datos personales: que la corrida de capturas
 * corte de verdad cuando hay alguien ajeno en la demo.
 *
 *   npm run prueba:guarda                                   # contra producción
 *   GASTROOS_BASE=http://localhost:3000 npm run prueba:guarda
 *
 * Una guarda que nunca se vio cortar es una guarda que no se sabe si anda. Esto
 * corre `scripts/capturas.mts` con `CAPTURAS_PRUEBA_AJENO=1`, que carga un
 * cliente inventado que no es del sembrado en la copia de la demo antes de
 * mirar, y comprueba tres cosas:
 *
 *   1. que la corrida termine con código 3, el de «datos ajenos»;
 *   2. que no haya dejado ni una imagen en la carpeta de destino;
 *   3. que haya reiniciado la copia, que es lo que borra al cliente cargado.
 *
 * El destino es una carpeta temporal, nunca `public/capturas`: si la guarda
 * fallara, las imágenes de esta prueba no pueden terminar en la página.
 *
 * Lo que queda en producción después de correrla es una cuenta de demo con una
 * copia limpia de la plantilla, como la de cualquier visitante, que la base
 * tira sola a los tres días.
 */

import { spawnSync } from 'node:child_process';
import { mkdtempSync, readdirSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const destino = mkdtempSync(join(tmpdir(), 'guarda-'));
let fallas = 0;
const mal = (m: string) => {
  fallas += 1;
  console.log(`  ✗ ${m}`);
};

try {
  console.log('\nGuarda de datos personales: sembrar a alguien ajeno y ver que corte\n');
  const r = spawnSync('npx', ['tsx', 'scripts/capturas.mts'], {
    env: { ...process.env, CAPTURAS_PRUEBA_AJENO: '1', CAPTURAS_DESTINO: destino },
    encoding: 'utf8',
    timeout: 300_000,
  });
  const salida = `${r.stdout}\n${r.stderr}`;
  console.log(
    salida
      .split('\n')
      .filter((l) => l.trim())
      .map((l) => `    | ${l}`)
      .join('\n')
  );

  if (r.status === 3) console.log('  ✓ la corrida cortó con código 3');
  else mal(`la corrida terminó con código ${r.status}: la guarda no cortó`);

  const quedaron = readdirSync(destino);
  if (quedaron.length === 0) console.log('  ✓ no quedó ninguna imagen');
  else mal(`quedaron imágenes: ${quedaron.join(', ')}`);

  if (/Persona Ajena De Prueba/.test(salida)) console.log('  ✓ el mensaje nombra al cliente ajeno');
  else mal('el mensaje no dice quién es el ajeno');

  if (/reinicié la copia de la demo/.test(salida)) console.log('  ✓ la copia se reinició: el cliente cargado ya no existe');
  else mal('no hay constancia de que la copia se haya reiniciado');
} finally {
  rmSync(destino, { recursive: true, force: true });
}

console.log(fallas === 0 ? '\nLa guarda corta como tiene que cortar.\n' : `\n${fallas} FALLAS\n`);
process.exit(fallas === 0 ? 0 : 1);
