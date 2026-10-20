/**
 * La imagen que se ve cuando alguien pega el enlace en un mensaje.
 *
 *   npm run og
 *
 * Esta página se reparte por WhatsApp. Un enlace sin vista previa es un renglón
 * gris con una dirección; uno con imagen ocupa media pantalla del teléfono y se
 * lee antes de abrirlo. Es la parte de la página que más gente va a ver.
 *
 * Se escribe en `src/app/opengraph-image.png`: con ese nombre Next la publica
 * sola y arma las etiquetas `og:image` con la dirección absoluta.
 *
 * ------------------------------------------------------------------
 * La tipografía, y por qué la corrida falla sin ella
 * ------------------------------------------------------------------
 * Se baja de Google **en esta corrida**, que pasa en la máquina del que la
 * genera, no en la de un visitante: la página nunca le pide nada a Google.
 *
 * Y se comprueba de la forma que no miente. `document.fonts.check()` —lo
 * obvio— devuelve `true` cuando la familia no está declarada en absoluto,
 * porque «no hay nada que cargar»: con la hoja de estilos bloqueada pasaría en
 * verde y la imagen saldría en Georgia. Acá se busca la cara itálica 900 de
 * Fraunces entre las cargadas, y si no está, no se genera nada.
 */

import { mkdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { abrirNavegador } from './comercial/navegador.mjs';

const DESTINO = join(process.cwd(), 'src', 'app', 'opengraph-image.png');
const ANCHO = 1200;
const ALTO = 630;

// Los de `tailwind.config.ts`: stone-900, stone-950, stone-50, stone-300, brand-400.
const C = { fondo: '#26302A', hondo: '#18201A', texto: '#FBF5EA', suave: '#CFC3AC', acento: '#E08A6B' };

const html = `<!doctype html>
<html lang="es-AR"><head><meta charset="utf-8">
<link href="https://fonts.googleapis.com/css2?family=Fraunces:ital,wght@1,900&family=Karla:wght@600;700&display=block" rel="stylesheet">
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body {
    width: ${ANCHO}px; height: ${ALTO}px; background: ${C.fondo}; color: ${C.texto};
    font-family: Karla, sans-serif; padding: 70px 76px; position: relative; overflow: hidden;
  }
  .resplandor { position: absolute; inset: 0;
    background: radial-gradient(46rem 26rem at 80% 10%, rgba(224,138,107,.20), transparent 60%); }
  .contenido { position: relative; }
  .rotulo { font-size: 21px; font-weight: 700; letter-spacing: .28em; text-transform: uppercase; color: ${C.acento}; }
  h1 { margin-top: 28px; font-family: Fraunces, serif; font-size: 78px; line-height: 1; font-weight: 900;
       font-style: italic; text-transform: uppercase; letter-spacing: -.03em; max-width: 19ch; }
  h1 span { color: ${C.acento}; }
  .pie { position: absolute; left: 76px; right: 76px; bottom: 58px; display: flex;
         align-items: baseline; justify-content: space-between; font-size: 25px; color: ${C.suave}; font-weight: 600; }
  .marca { font-family: Fraunces, serif; font-weight: 900; font-style: italic; font-size: 36px; color: ${C.texto}; }
  .marca b { color: ${C.acento}; font-weight: 900; }
</style></head>
<body>
  <div class="resplandor"></div>
  <div class="contenido">
    <p class="rotulo">Para negocios que trabajan por encargo</p>
    <h1>Los pedidos de tu WhatsApp, <span>en una sola pantalla</span></h1>
  </div>
  <div class="pie">
    <span class="marca">Gastro<b>OS</b></span>
    <span>Pedidos, stock y costos · gastroos.shop</span>
  </div>
</body></html>`;

async function main() {
  mkdirSync(join(process.cwd(), 'src', 'app'), { recursive: true });
  const navegador = await abrirNavegador();
  try {
    const page = await (await navegador.newContext({ viewport: { width: ANCHO, height: ALTO } })).newPage();
    // Sólo para probar que la corrida falla sin la tipografía: corta los
    // pedidos a Google. Bloquearlo por DNS no sirve si el navegador sale por un
    // proxy, porque el que resuelve el nombre es el proxy.
    if (process.env.OG_PRUEBA_SIN_FUENTE === '1') {
      await page.route(/fonts\.(googleapis|gstatic)\.com/, (r) => r.abort());
    }
    await page.setContent(html, { waitUntil: 'networkidle' });
    await page.evaluate('document.fonts.ready');

    const cara = await page.evaluate(() =>
      Array.from(document.fonts).some(
        (f) => f.family.replace(/"/g, '') === 'Fraunces' && f.style === 'italic' && f.weight.includes('900') && f.status === 'loaded'
      )
    );
    if (!cara) {
      console.error(
        '\n✗ La itálica 900 de Fraunces no cargó: la imagen saldría con otra tipografía\n' +
          '  y no se parecería a la página. No la genero.\n'
      );
      process.exitCode = 1;
      return;
    }

    await page.screenshot({ path: DESTINO });
  } finally {
    await navegador.close();
  }
  console.log(`\n✓ ${DESTINO} — ${ANCHO}×${ALTO}, ${Math.round(statSync(DESTINO).size / 1024)} KB\n`);
}

main().catch((e) => {
  console.error('\n✗ la imagen se cortó:', e instanceof Error ? e.message : e);
  process.exit(1);
});
