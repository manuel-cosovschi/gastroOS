/**
 * La huella de la interfaz: ¿las capturas son del producto de hoy?
 *
 * `npm run capturas` la escribe en el módulo generado y
 * `npm run prueba:comercial` la vuelve a calcular. Si no coinciden, alguien
 * tocó una pantalla después de la última corrida y la página de venta muestra
 * algo que ya no existe.
 *
 * ------------------------------------------------------------------
 * Por qué el contenido y no el commit
 * ------------------------------------------------------------------
 * Las capturas se sacan antes de commitear, así que el commit que las trae es
 * siempre uno posterior al de la corrida: comparar commits daría rojo justo
 * después de hacer todo bien, y una prueba que falla cuando el mundo está bien
 * enseña a ignorarla. Un hash del contenido no se mueve al commitear, anda en un
 * clon sin historia y contesta la pregunta de verdad: «¿la pantalla es la
 * misma?».
 *
 * ------------------------------------------------------------------
 * Qué entra
 * ------------------------------------------------------------------
 * El producto: `src/app` y `src/components`, salvo lo comercial —la carpeta
 * `comercial` y la página de inicio, que es la página de venta—. Cambiar el
 * texto de venta no envejece una captura del producto; si contara, esto
 * fallaría en cada retoque de la página hasta que alguien lo apague.
 */

import { createHash } from 'node:crypto';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

const CARPETAS = ['src/app', 'src/components'];
const AFUERA = ['src/components/comercial', 'src/components/marketing', 'src/app/page.tsx', 'src/app/opengraph-image.png'];

function archivos(dir: string): string[] {
  let salida: string[] = [];
  for (const entrada of readdirSync(dir).sort()) {
    const ruta = join(dir, entrada);
    const rel = relative(process.cwd(), ruta).split('\\').join('/');
    if (AFUERA.some((a) => rel === a || rel.startsWith(`${a}/`))) continue;
    if (statSync(ruta).isDirectory()) salida = salida.concat(archivos(ruta));
    else if (/\.(tsx?|css)$/.test(entrada)) salida.push(rel);
  }
  return salida;
}

export function huellaDeLaInterfaz(): string {
  const h = createHash('sha256');
  for (const carpeta of CARPETAS) {
    for (const rel of archivos(join(process.cwd(), carpeta))) {
      // El nombre entra junto con el contenido: mover una pantalla de archivo
      // sin tocar una línea también cambia la interfaz que se compila.
      h.update(rel);
      h.update(readFileSync(rel));
    }
  }
  return h.digest('hex').slice(0, 16);
}
