/**
 * Los iconos del panel, para instalarlo en un teléfono.
 *
 *   npx tsx scripts/iconos.ts
 *
 * Se generan y se commitean: no se arman en el build. Un icono es una decisión de
 * marca, no un artefacto, y si se rompiera el generador el panel igual tiene que
 * verse bien.
 *
 * Son cuatro archivos porque cada sistema quiere algo distinto, y usar el de otro
 * se ve mal:
 *
 *   - `apple-touch-icon.png` (180). Es el que usa iOS al "Añadir a pantalla de
 *     inicio". **Tiene que ser PNG**: iOS no entiende SVG acá, y sin este archivo
 *     no pone el logo, pone una captura de la página. Va sin esquinas redondeadas
 *     y sin transparencia, porque iOS le aplica su propio recorte encima: un
 *     cuadrado ya redondeado queda redondeado dos veces, y lo transparente lo
 *     rellena de negro.
 *
 *   - `icono-192.png` y `icono-512.png` (`purpose: any`). Los de Android y los del
 *     manifiesto. Van cuadrados: Android le da la forma con el maskable de abajo,
 *     y redondearlos acá no serviría igual, porque un PNG sin transparencia no
 *     tiene esquinas que recortar. La pestaña del navegador sí los tiene
 *     redondeados, pero ese es `src/app/icon.svg`, que es vectorial.
 *
 *   - `icono-maskable-512.png` (`purpose: maskable`). Android recorta el icono con
 *     la forma que tenga el launcher —círculo, cuadrado, gota— así que acá el
 *     fondo va de borde a borde y la marca más chica, dentro de la zona que
 *     ningún recorte toca. Sin este archivo, Android recorta el de arriba y le
 *     come las puntas.
 */

import { mkdirSync } from 'node:fs';
import { join } from 'node:path';
import sharp from 'sharp';

/** El gris de la marca, el mismo del `themeColor` del layout. */
const FONDO = '#26292D';

/**
 * La marca, en el sistema de coordenadas de 32 unidades de `src/app/icon.svg`.
 * Es el mismo trazo: el icono de la pestaña y el de la pantalla de inicio tienen
 * que ser el mismo dibujo.
 */
const MARCA = 'M21.5 6 11 13.2l4.6 2.9L9.5 20v6l10.5-7.2-4.6-2.9L21.5 12z';

/**
 * La marca sobre su fondo, ya al tamaño final.
 *
 * El `width`/`height` van explícitos y no sólo el `viewBox`: sin ellos sharp
 * rasteriza el SVG a las 32 unidades del viewBox y después hay que agrandar un
 * dibujo de 32 píxeles hasta 512, que sale borroso. Con el tamaño puesto, lo
 * dibuja directo en 512 y los bordes quedan limpios.
 *
 * `escala` 1 es el tamaño original de la marca; más chica, para el maskable.
 */
function svg({ lado, escala }: { lado: number; escala: number }): Buffer {
  // Escalar desde el centro: se corre al centro, se escala, y se vuelve.
  const centro = 16;
  const transform =
    escala === 1
      ? ''
      : ` transform="translate(${centro} ${centro}) scale(${escala}) translate(${-centro} ${-centro})"`;

  return Buffer.from(
    `<svg xmlns="http://www.w3.org/2000/svg" width="${lado}" height="${lado}" viewBox="0 0 32 32">` +
      `<rect width="32" height="32" fill="${FONDO}"/>` +
      `<path d="${MARCA}" fill="#fff"${transform}/>` +
      `</svg>`
  );
}

const SALIDA = join(process.cwd(), 'public');

/**
 * `escala` baja sólo en el maskable: así la marca entra dentro del 80% central,
 * que es lo que ningún recorte de Android toca.
 */
const ARCHIVOS = [
  { nombre: 'apple-touch-icon.png', lado: 180, escala: 1 },
  { nombre: 'icono-192.png', lado: 192, escala: 1 },
  { nombre: 'icono-512.png', lado: 512, escala: 1 },
  { nombre: 'icono-maskable-512.png', lado: 512, escala: 0.72 },
];

async function main() {
  mkdirSync(SALIDA, { recursive: true });

  for (const { nombre, lado, escala } of ARCHIVOS) {
    const destino = join(SALIDA, nombre);
    await sharp(svg({ lado, escala }))
      // Sin canal alfa: lo que sea transparente, iOS lo pinta de negro.
      .flatten({ background: FONDO })
      .png({ compressionLevel: 9 })
      .toFile(destino);
    console.log(`${nombre.padEnd(28)} ${lado}×${lado}`);
  }

  console.log('\nListo. Están en sovare-panel/public/.');
}

main().catch((error) => {
  console.error('No se pudieron generar los iconos:', error);
  process.exit(1);
});
