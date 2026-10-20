/**
 * Los videos del sistema que muestra la página comercial.
 *
 *   npm run videos                                    # contra producción
 *   GASTROOS_BASE=http://localhost:3000 npm run videos
 *
 * Necesita `ffmpeg`: el del sistema, o el que diga `FFMPEG`.
 *
 * ==================================================================
 * Qué son, y qué no
 * ==================================================================
 * Grabaciones de un navegador usando el sistema de verdad: entrar al panel,
 * tocar «Nuevo pedido», escribir el cliente, elegir los productos, la fecha, y
 * crearlo. No son una animación dibujada de algo que podría pasar: se vuelven a
 * grabar con un comando, y muestran literalmente lo que hace el sistema hoy —lo
 * mismo que cualquiera comprueba abriendo la demo, que está enlazada al lado—.
 *
 * ==================================================================
 * Por qué tres archivos por clip
 * ==================================================================
 * Playwright graba en webm, que un Safari viejo no reproduce, y la mitad de la
 * gente abre esta página desde un iPhone. De cada clip salen:
 *
 *   · `.mp4` (H.264) — el que anda en todos lados, y va primero;
 *   · `.webm` (VP9) — más chico, lo toma el navegador que puede;
 *   · `.jpg` — el primer cuadro, como póster: sin él, el lugar del video queda
 *     vacío hasta que el archivo baja.
 *
 * Sin audio, a propósito: un video que suena solo en una página de venta se
 * cierra en dos segundos.
 *
 * ==================================================================
 * Lo que escribe en producción
 * ==================================================================
 * El pedido del video se crea de verdad, en una copia de la demo armada para
 * esta corrida: la misma copia aislada que recibe cualquier visitante, que nadie
 * más ve y que la base tira sola a los tres días. Antes de grabar corre la misma
 * guarda de datos personales que las capturas, porque el video muestra el inicio
 * del panel con los nombres de los clientes.
 */

import { execFileSync } from 'node:child_process';
import { mkdirSync, readdirSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { BASE, abrirNavegador, entrarALaDemo, hoyEnArgentina, irA } from './comercial/navegador.mjs';
import { DatosAjenos, nadieAjeno } from './comercial/guarda.mjs';

const DESTINO = join(process.cwd(), 'public', 'videos');
const CRUDO = join(process.cwd(), '.videos-crudos');
const MODULO = join(process.cwd(), 'src', 'components', 'comercial', 'videos.generado.ts');
const FFMPEG = process.env.FFMPEG ?? 'ffmpeg';

/** Un celular: es desde donde se carga un pedido mientras te escriben. */
const ANCHO = 390;
const ALTO = 780;
/**
 * El ancho del archivo final: el de la pantalla, sin agrandar.
 *
 * La primera versión grababa a 780×1560 «para que se lea nítido» y salió un
 * video con el panel en el cuarto de arriba a la izquierda y el resto gris:
 * Playwright no escala la página al tamaño del video, la pega en una esquina.
 * Agrandar después tampoco suma nitidez, sólo peso.
 */
const ANCHO_FINAL = ANCHO;

/** El día de entrega del pedido: pasado mañana, en Argentina. */
function pasadoManiana(): string {
  const [a, m, d] = hoyEnArgentina().split('-').map(Number);
  return new Date(Date.UTC(a, m - 1, d + 2)).toISOString().slice(0, 10);
}

async function main() {
  mkdirSync(DESTINO, { recursive: true });
  rmSync(CRUDO, { recursive: true, force: true });
  mkdirSync(CRUDO, { recursive: true });
  console.log(`\nVideos de ${BASE}\n`);

  const navegador = await abrirNavegador();
  let inicio = 0;

  try {
    // La entrada a la demo y la guarda van en un contexto sin grabar: el
    // video empieza en el panel, no en la pantalla de login.
    const previo = await navegador.newContext({ viewport: { width: 1280, height: 800 } });
    const p0 = await previo.newPage();
    await entrarALaDemo(p0);
    await nadieAjeno(p0);
    const sesion = await previo.storageState();
    await previo.close();

    const contexto = await navegador.newContext({
      viewport: { width: ANCHO, height: ALTO },
      deviceScaleFactor: 2,
      isMobile: true,
      hasTouch: true,
      storageState: sesion,
      recordVideo: { dir: CRUDO, size: { width: ANCHO, height: ALTO } },
    });
    const page = await contexto.newPage();
    await irA(page, '/admin', 'Hola, Dulce Estudio');
    // No se corta el principio contando segundos desde acá: el webm de
    // Playwright arranca en el primer cuadro pintado, no cuando se abre la
    // pestaña, así que restar el tiempo de carga se comía el inicio del panel.
    // Lo que se corta es el primer segundo, que sale en blanco mientras la
    // pestaña pinta por primera vez.
    inicio = 1;
    await page.waitForTimeout(1500);

    await page.getByRole('link', { name: 'Nuevo pedido' }).first().tap();
    await page.getByRole('heading', { name: 'Nuevo pedido', level: 1 }).waitFor();
    await page.waitForTimeout(700);

    await page.getByLabel('Nombre *').tap();
    await page.getByLabel('Nombre *').pressSequentially('Lucía Fernández', { delay: 70 });
    await page.waitForTimeout(400);

    const producto = async (nombre: RegExp) => {
      const boton = page.getByRole('button', { name: nombre });
      await boton.scrollIntoViewIfNeeded();
      await page.waitForTimeout(350);
      await boton.tap();
      await page.waitForTimeout(600);
    };

    await page.getByLabel('Fecha *').scrollIntoViewIfNeeded();
    await page.waitForTimeout(400);
    await page.getByLabel('Fecha *').fill(pasadoManiana());
    await page.getByLabel('Hora').fill('16:00');
    await page.waitForTimeout(600);

    await producto(/Torta Red Velvet/);
    await producto(/Cookies x6/);

    await page.getByRole('button', { name: 'Crear pedido' }).tap();
    await page.waitForURL(/\/admin\/pedidos\/[0-9a-f-]{36}/, { timeout: 30_000 });
    // Hasta que el pedido está pintado, no hasta que la red se calma: la
    // primera grabación terminó en el esqueleto de carga, que es justo lo que
    // no hay que mostrar.
    await page.getByText('Lucía Fernández').first().waitFor({ timeout: 30_000 });
    await page.waitForTimeout(2500);

    await contexto.close();
  } catch (e) {
    if (e instanceof DatosAjenos) {
      console.error(`\n✗ ${e.message}\n`);
      rmSync(CRUDO, { recursive: true, force: true });
      process.exitCode = 3;
      return;
    }
    throw e;
  } finally {
    await navegador.close();
  }

  const crudo = readdirSync(CRUDO).find((f) => f.endsWith('.webm'));
  if (!crudo) throw new Error('Playwright no dejó ningún video.');
  const entrada = join(CRUDO, crudo);
  const salida = (ext: string) => join(DESTINO, `pedido.${ext}`);
  const corte = ['-ss', inicio.toFixed(2), '-i', entrada];
  const escala = ['-vf', `scale=${ANCHO_FINAL}:-2`, '-an'];

  execFileSync(FFMPEG, ['-y', ...corte, ...escala, '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-crf', '28', '-preset', 'slow', '-movflags', '+faststart', salida('mp4')], { stdio: 'ignore' });
  execFileSync(FFMPEG, ['-y', ...corte, ...escala, '-c:v', 'libvpx-vp9', '-b:v', '0', '-crf', '40', '-row-mt', '1', salida('webm')], { stdio: 'ignore' });
  // El póster es un cuadro de un segundo más adentro, con el panel ya pintado:
  // el primero, aun cortado, puede seguir siendo el blanco de la carga.
  execFileSync(FFMPEG, ['-y', '-ss', (inicio + 1).toFixed(2), '-i', entrada, '-vf', `scale=${ANCHO_FINAL}:-2`, '-frames:v', '1', '-q:v', '3', salida('jpg')], { stdio: 'ignore' });
  rmSync(CRUDO, { recursive: true, force: true });

  const alto = Math.round((ANCHO_FINAL * ALTO) / ANCHO / 2) * 2;
  for (const ext of ['mp4', 'webm', 'jpg']) {
    console.log(`  ✓ pedido.${ext}  ${(statSync(salida(ext)).size / 1024).toFixed(0)} KB`);
  }

  writeFileSync(
    MODULO,
    `/**
 * Los videos que muestra la página comercial.
 *
 * GENERADO por \`npm run videos\`. Son grabaciones del sistema andando, no
 * animaciones: editar esto a mano no graba nada.
 */

export const VIDEOS_GRABADOS_EL = '${hoyEnArgentina()}';

export const VIDEOS = {
  pedido: {
    mp4: '/videos/pedido.mp4',
    webm: '/videos/pedido.webm',
    poster: '/videos/pedido.jpg',
    ancho: ${ANCHO_FINAL},
    alto: ${alto},
    que: 'Un pedido cargado desde el celular: el cliente, la fecha, los productos y listo',
  },
} as const;
`
  );
  console.log(`\n✓ video grabado contra ${BASE}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
