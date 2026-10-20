/**
 * La batería de la página comercial.
 *
 *   npm run prueba:comercial                                  # contra el servidor local
 *   GASTROOS_BASE=https://gastroos.shop npm run prueba:comercial
 *
 * Por defecto va contra `http://localhost:3000`: es lo que se corre antes de
 * subir. Contra producción es lo que se corre después, y es la que vale: una
 * prueba que sólo pasó en mi máquina no dice nada de lo que ve la gente.
 *
 * No escribe nada en ningún lado. La demo embebida se abre, pero no se toca el
 * botón de entrar: eso armaría una copia de la demo por cada corrida.
 *
 * Cada prueba lleva un número fijo: es lo que se cita cuando algo falla.
 */

import type { Browser, Page } from 'playwright';
import { abrirNavegador } from './comercial/navegador.mjs';
import { afirmar, correrTodas, desenvolver, prueba } from './comercial/arnes.mjs';
import { huellaDeLaInterfaz } from './comercial/huella.mjs';
import { PROHIBIDAS, frasesProhibidas } from './comercial/frases.mjs';
import * as modCapturas from '../src/components/comercial/capturas.generado';
import * as modVideos from '../src/components/comercial/videos.generado';

const { CAPTURAS, CAPTURAS_SACADAS_EL, HUELLA_DE_LA_INTERFAZ } = desenvolver(modCapturas);
const { VIDEOS, VIDEOS_GRABADOS_EL } = desenvolver(modVideos);

// Por defecto, el servidor local: esta batería se corre antes de subir. Las
// capturas y los videos van por defecto a producción; esto no.
const BASE = (process.env.GASTROOS_BASE ?? 'http://localhost:3000').replace(/\/$/, '');
const LOCAL = /localhost|127\.0\.0\.1/.test(BASE);
const comoFecha = (iso: string) => iso.split('-').reverse().join('/');

let navegador: Browser;

/** Abre la página en un contexto nuevo y junta los errores de la consola. */
async function abrir(opciones: Parameters<Browser['newContext']>[0] = {}) {
  const ctx = await navegador.newContext({ viewport: { width: 1280, height: 860 }, ...opciones });
  const page = await ctx.newPage();
  const errores: string[] = [];
  page.on('console', (m) => {
    if (m.type() === 'error') errores.push(m.text().slice(0, 300));
  });
  page.on('pageerror', (e) => errores.push(`excepción: ${e.message}`));
  const pedidos: string[] = [];
  page.on('request', (r) => pedidos.push(r.url()));
  const respuesta = await page.goto(`${BASE}/`, { waitUntil: 'networkidle' });
  return { ctx, page, errores, pedidos, respuesta };
}

/** Baja hasta el final de a pantallas, para que todo lo que aparece aparezca. */
async function recorrer(page: Page) {
  const alto = await page.evaluate(() => document.body.scrollHeight);
  for (let y = 0; y <= alto; y += 450) {
    await page.evaluate((yy) => window.scrollTo(0, yy), y);
    await page.waitForTimeout(90);
  }
  await page.waitForTimeout(700);
}

/**
 * El texto de la página como está escrito, no como se ve.
 *
 * `innerText` devuelve lo que pinta el CSS: con `uppercase`, «Probar la demo»
 * llega como «PROBAR LA DEMO» y una búsqueda de la frase falla aunque esté. Se
 * usa `textContent`, que además incluye las respuestas de las preguntas
 * cerradas, que también son parte de lo que la página dice.
 */
const textoDe = (page: Page) => page.evaluate(() => document.body.textContent ?? '');

/* ==================================================================
   Las frases que esta página no puede decir
   ================================================================== */

/* ==================================================================
   Las pruebas
   ================================================================== */

prueba(1, 'la página responde 200, sin errores en la consola', async () => {
  const { ctx, page, errores, respuesta } = await abrir();
  await recorrer(page);
  await ctx.close();
  afirmar(respuesta?.status() === 200, `respondió ${respuesta?.status()}`);
  afirmar(errores.length === 0, `errores en la consola:\n${errores.join('\n')}`);
});

prueba(2, 'el detector de frases prohibidas detecta (caso rojo)', async () => {
  for (const { ejemplo, patron } of PROHIBIDAS) {
    afirmar(frasesProhibidas(ejemplo).length > 0, `el patrón ${patron} no caza su propio ejemplo «${ejemplo}»`);
  }
});

prueba(3, 'no hay testimonios, números de resultados ni «más de X negocios»', async () => {
  const { ctx, page } = await abrir();
  const encontradas = frasesProhibidas(await textoDe(page));
  await ctx.close();
  afirmar(encontradas.length === 0, `la página dice:\n${encontradas.join('\n')}`);
});

prueba(4, 'el hero se ve desde el primer cuadro, sin esperar a nada', async () => {
  const ctx = await navegador.newContext({ viewport: { width: 1280, height: 860 } });
  const page = await ctx.newPage();
  // `commit` y no `load`: se mira apenas llega el HTML, antes de que corra
  // ningún archivo de JavaScript.
  await page.goto(`${BASE}/`, { waitUntil: 'commit' });
  await page.locator('h1').waitFor({ state: 'attached' });
  const opacidad = await page.locator('h1').evaluate((h) => {
    let el: HTMLElement | null = h as HTMLElement;
    let o = 1;
    while (el) {
      o *= Number(getComputedStyle(el).opacity);
      el = el.parentElement;
    }
    return o;
  });
  const marcado = await page.locator('#arriba [data-revelar]').count();
  await ctx.close();
  afirmar(opacidad === 1, `el título principal arranca con opacidad ${opacidad}`);
  afirmar(marcado === 0, `hay ${marcado} bloques del hero marcados para aparecer: el hero no se esconde nunca`);
});

prueba(5, 'sin JavaScript se lee todo: nada queda con opacidad distinta de 1', async () => {
  const { ctx, page } = await abrir({ javaScriptEnabled: false });
  const escondidos = await page.evaluate(() =>
    Array.from(document.querySelectorAll<HTMLElement>('main *'))
      .filter((e) => Number(getComputedStyle(e).opacity) < 1 && e.getBoundingClientRect().height > 0)
      .map((e) => e.textContent?.trim().slice(0, 50))
  );
  const titulos = await page.locator('h2').count();
  const conClase = await page.evaluate(() => document.documentElement.classList.contains('con-animaciones'));
  await ctx.close();
  afirmar(!conClase, 'sin JavaScript la clase con-animaciones no debería existir');
  afirmar(escondidos.length === 0, `quedan ${escondidos.length} bloques escondidos: ${escondidos.slice(0, 5).join(' | ')}`);
  afirmar(titulos >= 10, `sólo ${titulos} títulos de sección: falta contenido`);
});

prueba(6, 'si React nunca llega, la red del script muestra todo a los tres segundos', async () => {
  const ctx = await navegador.newContext({ viewport: { width: 1280, height: 860 } });
  const page = await ctx.newPage();
  // Se cortan los archivos de la aplicación: el guion de la página corre, React
  // no. Es el caso que la red tiene que cubrir.
  await page.route(/\/_next\/static\/chunks\//, (r) => r.abort());
  await page.goto(`${BASE}/`, { waitUntil: 'domcontentloaded' });
  const antes = await page.locator('[data-revelar="pendiente"]').count();
  await page.waitForTimeout(3600);
  const despues = await page.locator('[data-revelar="pendiente"]').count();
  await ctx.close();
  afirmar(antes > 0, 'no había nada pendiente: la prueba no está probando nada');
  afirmar(despues === 0, `a los 3,6 s siguen ${despues} bloques escondidos sin React`);
});

prueba(7, 'con React vivo: lo que está en pantalla aparece, y al bajar aparece todo', async () => {
  const { ctx, page } = await abrir();
  await page.waitForTimeout(3600);
  const enPantallaEscondidos = await page.evaluate(() =>
    Array.from(document.querySelectorAll<HTMLElement>('[data-revelar]')).filter(
      (e) => e.getBoundingClientRect().top < window.innerHeight && e.getAttribute('data-revelar') !== 'visto'
    ).length
  );
  await recorrer(page);
  await page.waitForTimeout(3600);
  const pendientes = await page.locator('[data-revelar="pendiente"]').count();
  const opacos = await page.evaluate(() =>
    Array.from(document.querySelectorAll<HTMLElement>('[data-revelar]')).filter((e) => Number(getComputedStyle(e).opacity) < 1).length
  );
  await ctx.close();
  afirmar(enPantallaEscondidos === 0, `${enPantallaEscondidos} bloques a la vista siguen escondidos`);
  afirmar(pendientes === 0 && opacos === 0, `después de recorrer: ${pendientes} pendientes, ${opacos} con opacidad < 1`);
});

prueba(8, 'con «reducir movimiento»: nada escondido, la cinta quieta y el video sin arrancar solo', async () => {
  const { ctx, page } = await abrir({ reducedMotion: 'reduce' });
  const opacos = await page.evaluate(() =>
    Array.from(document.querySelectorAll<HTMLElement>('[data-revelar]')).filter((e) => Number(getComputedStyle(e).opacity) < 1).length
  );
  const cinta = await page.locator('.cinta').evaluate((e) => getComputedStyle(e).animationName);
  await page.locator('video').scrollIntoViewIfNeeded();
  await page.waitForTimeout(1500);
  const video = await page.locator('video').evaluate((v: HTMLVideoElement) => ({ pausado: v.paused, controles: v.controls }));
  await ctx.close();
  afirmar(opacos === 0, `${opacos} bloques escondidos con movimiento reducido`);
  afirmar(cinta === 'none', `la cinta sigue animada: ${cinta}`);
  afirmar(video.pausado && video.controles, `el video: ${JSON.stringify(video)}`);
});

prueba(9, 'el video no se baja al abrir la página, y arranca cuando se ve', async () => {
  const { ctx, page, pedidos } = await abrir();
  const antes = pedidos.filter((u) => /\/videos\/.*\.(mp4|webm)/.test(u)).length;
  const preload = await page.locator('video').getAttribute('preload');
  await page.locator('video').scrollIntoViewIfNeeded();
  await page.waitForTimeout(2500);
  const corriendo = await page.locator('video').evaluate((v: HTMLVideoElement) => !v.paused && v.currentTime > 0);
  await ctx.close();
  afirmar(preload === 'none', `preload="${preload}"`);
  afirmar(antes === 0, `se pidieron ${antes} archivos de video antes de llegar a él`);
  afirmar(corriendo, 'el video no arrancó al estar a la vista');
});

prueba(10, 'los tres archivos del video existen: mp4, webm y póster', async () => {
  const v = VIDEOS.pedido;
  for (const [ruta, tipo] of [
    [v.mp4, 'video/mp4'],
    [v.webm, 'video/webm'],
    [v.poster, 'image/jpeg'],
  ] as const) {
    const r = await fetch(`${BASE}${ruta}`);
    const largo = (await r.arrayBuffer()).byteLength;
    afirmar(r.ok, `${ruta} respondió ${r.status}`);
    afirmar((r.headers.get('content-type') ?? '').startsWith(tipo), `${ruta} llegó como ${r.headers.get('content-type')}`);
    afirmar(largo > 10_000, `${ruta} pesa ${largo} bytes: no puede ser un video de verdad`);
  }
});

prueba(11, 'la demo embebida: no carga hasta el clic, y al tocarla se abre de verdad', async () => {
  const { ctx, page, errores } = await abrir();
  const antes = await page.locator('#demo iframe').count();
  await page.getByRole('button', { name: /Probar la demo acá/ }).click();
  const marco = page.frameLocator('#demo iframe');
  await marco.getByRole('button', { name: 'Entrar a la demo' }).waitFor({ timeout: 20_000 });
  const bloqueado = errores.filter((e) => /frame-ancestors|Refused to frame/i.test(e));
  await ctx.close();
  afirmar(antes === 0, 'el iframe estaba antes del clic');
  afirmar(bloqueado.length === 0, `el navegador bloqueó el marco: ${bloqueado.join(' | ')}`);
});

prueba(12, 'los encabezados de seguridad, en la respuesta de verdad', async () => {
  const r = await fetch(`${BASE}/`);
  const h = (n: string) => r.headers.get(n) ?? '';
  afirmar(/frame-ancestors[^;]*'self'/.test(h('content-security-policy')), `CSP: «${h('content-security-policy')}»`);
  if (!LOCAL) {
    const host = new URL(BASE).host;
    afirmar(
      h('content-security-policy').includes(`https://${host}`) && h('content-security-policy').includes(`https://*.${host}`),
      `frame-ancestors tiene que nombrar el dominio y sus subdominios: «${h('content-security-policy')}»`
    );
  }
  afirmar(h('x-content-type-options') === 'nosniff', `nosniff: «${h('x-content-type-options')}»`);
  afirmar(h('referrer-policy') === 'strict-origin-when-cross-origin', `Referrer-Policy: «${h('referrer-policy')}»`);
  afirmar(/camera=\(\)/.test(h('permissions-policy')), `Permissions-Policy: «${h('permissions-policy')}»`);
});

prueba(13, 'fondo oscuro de punta a punta y color-scheme dark', async () => {
  const { ctx, page } = await abrir();
  const r = await page.evaluate(() => ({
    fondo: getComputedStyle(document.body).backgroundColor,
    esquema: getComputedStyle(document.documentElement).colorScheme,
    margen: getComputedStyle(document.documentElement).scrollPaddingTop,
  }));
  await ctx.close();
  afirmar(r.fondo === 'rgb(38, 48, 42)', `el body es ${r.fondo}`);
  afirmar(r.esquema === 'dark', `color-scheme: ${r.esquema}`);
  afirmar(r.margen === '80px', `scroll-padding-top: ${r.margen}`);
});

prueba(14, 'las tarjetas pintan el blanco al 4,5 %, medido en el navegador', async () => {
  // La trampa: con colores definidos como `var()`, `bg-white/[0.045]` de
  // Tailwind no genera nada y la tarjeta queda transparente sin un solo aviso.
  // Se lee el color que el navegador calculó, no la clase que escribimos.
  const { ctx, page } = await abrir();
  const fondo = await page.locator('#problema li > div').first().evaluate((e) => getComputedStyle(e).backgroundColor);
  await ctx.close();
  // El navegador guarda el alfa en 8 bits: 0,045 × 255 = 11,5 → 11/255 = 0,043.
  // Se acepta lo que da ese redondeo; lo que no se acepta es transparente ni
  // opaco, que son las dos formas en que falla la trampa.
  const m = fondo.match(/^rgba\(255, 253, 249, ([\d.]+)\)$/);
  afirmar(m && Math.abs(Number(m[1]) - 0.045) < 0.004, `la tarjeta pinta ${fondo}`);
});

prueba(15, 'las capturas son de la interfaz de hoy (huella)', async () => {
  const actual = huellaDeLaInterfaz();
  afirmar(
    actual === HUELLA_DE_LA_INTERFAZ,
    `la interfaz cambió después de la última corrida de capturas (${HUELLA_DE_LA_INTERFAZ} → ${actual}).\n` +
      'Las imágenes de la página muestran algo que ya no existe: corré `npm run capturas`.'
  );
});

prueba(16, 'cada captura existe, con el tamaño que dice el módulo', async () => {
  for (const [clave, c] of Object.entries(CAPTURAS)) {
    const r = await fetch(`${BASE}${c.archivo}`);
    afirmar(r.ok, `${clave}: ${c.archivo} respondió ${r.status}`);
    const { default: sharp } = await import('sharp');
    const m = await sharp(Buffer.from(await r.arrayBuffer())).metadata();
    afirmar(m.width === c.ancho && m.height === c.alto, `${clave}: el archivo mide ${m.width}×${m.height} y el módulo dice ${c.ancho}×${c.alto}`);
  }
});

prueba(17, 'la fecha de las capturas y del video está a la vista, con la demo al lado', async () => {
  const { ctx, page } = await abrir();
  const texto = await textoDe(page);
  const enlaces = await page.locator('#arriba a').evaluateAll((as) => as.map((a) => a.getAttribute('href')));
  await ctx.close();
  afirmar(texto.includes(comoFecha(CAPTURAS_SACADAS_EL)), `no aparece la fecha de las capturas (${comoFecha(CAPTURAS_SACADAS_EL)})`);
  afirmar(texto.includes(comoFecha(VIDEOS_GRABADOS_EL)), `no aparece la fecha del video (${comoFecha(VIDEOS_GRABADOS_EL)})`);
  afirmar(enlaces.some((h) => h && /login|demo/.test(h)), 'al lado de la captura del hero no hay enlace a la demo');
});

prueba(18, 'título, descripción e imagen para compartir, con direcciones absolutas', async () => {
  const { ctx, page } = await abrir();
  // Un texto y no una función: `tsx` les pone nombre a las funciones con un
  // ayudante (`__name`) que en la página no existe.
  const meta = (await page.evaluate(`(() => {
    const m = (p) => document.querySelector('meta[property="' + p + '"], meta[name="' + p + '"]')?.getAttribute('content') ?? '';
    return { titulo: document.title, desc: m('description'), imagen: m('og:image'), sitio: m('og:site_name'), ogTitulo: m('og:title') };
  })()`)) as { titulo: string; desc: string; imagen: string; sitio: string; ogTitulo: string };
  await ctx.close();
  afirmar(meta.titulo.startsWith('GastroOS — '), `título: «${meta.titulo}»`);
  afirmar(!/·\s*GastroOS$/.test(meta.titulo), `el título repite la marca: «${meta.titulo}»`);
  afirmar(meta.desc.length > 60, 'falta la descripción');
  afirmar(/^https?:\/\//.test(meta.imagen), `og:image no es absoluta: «${meta.imagen}»`);
  afirmar(meta.sitio === 'GastroOS' && meta.ogTitulo.length > 0, `og:site_name «${meta.sitio}», og:title «${meta.ogTitulo}»`);
  if (!LOCAL) {
    afirmar(meta.imagen.startsWith(BASE), `og:image apunta a otro sitio: ${meta.imagen}`);
    const r = await fetch(meta.imagen);
    afirmar(r.ok && (r.headers.get('content-type') ?? '').startsWith('image/png'), `og:image respondió ${r.status} ${r.headers.get('content-type')}`);
  }
});

prueba(19, 'favicon.ico existe', async () => {
  const r = await fetch(`${BASE}/favicon.ico`);
  afirmar(r.ok, `favicon.ico respondió ${r.status}`);
});

prueba(20, 'un solo h1, y los títulos no saltan niveles', async () => {
  const { ctx, page } = await abrir();
  const niveles = await page.evaluate(() => Array.from(document.querySelectorAll('h1,h2,h3,h4,h5,h6')).map((h) => Number(h.tagName[1])));
  await ctx.close();
  afirmar(niveles.filter((n) => n === 1).length === 1, `hay ${niveles.filter((n) => n === 1).length} h1`);
  const salto = niveles.findIndex((n, i) => i > 0 && n > niveles[i - 1] + 1);
  afirmar(salto === -1, `salto de h${niveles[salto - 1]} a h${niveles[salto]} en el título ${salto + 1}`);
});

prueba(21, 'toda imagen dice qué es, salvo las decorativas escondidas', async () => {
  const { ctx, page } = await abrir();
  await recorrer(page);
  const mudas = await page.evaluate(() =>
    Array.from(document.querySelectorAll('img'))
      .filter((i) => !i.getAttribute('alt')?.trim() && !i.closest('[aria-hidden="true"]'))
      .map((i) => i.getAttribute('src'))
  );
  const video = await page.locator('video').getAttribute('aria-label');
  await ctx.close();
  afirmar(mudas.length === 0, `imágenes sin alt: ${mudas.join(', ')}`);
  afirmar(Boolean(video), 'el video no tiene aria-label');
});

prueba(22, 'la cinta repetida está escondida para los lectores de pantalla, y la frase se dice una vez', async () => {
  const { ctx, page } = await abrir();
  const oculta = await page.locator('.cinta').getAttribute('aria-hidden');
  const unaVez = await page.locator('p.sr-only', { hasText: 'Nadie quiere un sistema de gestión' }).count();
  await ctx.close();
  afirmar(oculta === 'true', `aria-hidden de la cinta: ${oculta}`);
  afirmar(unaVez === 1, `la frase para lectores aparece ${unaVez} veces`);
});

prueba(23, 'cada enlace interno lleva a una sección que existe, y ninguno a una dirección de prueba', async () => {
  const { ctx, page } = await abrir();
  const r = await page.evaluate(() => {
    const hrefs = Array.from(document.querySelectorAll('a')).map((a) => a.getAttribute('href') ?? '');
    return {
      rotos: hrefs.filter((h) => h.startsWith('#') && h.length > 1 && !document.getElementById(h.slice(1))),
      // Las direcciones de un despliegue puntual (`proyecto-a1b2c3d4e-equipo.vercel.app`)
      // dejan de existir; la de producción de un proyecto (`cosov-pedidos.vercel.app`)
      // no, y es donde vive de verdad la tienda de COSOV.
      raros: hrefs.filter((h) => /localhost|\.test[:/]|127\.0\.0\.1|-[a-z0-9]{9}-[a-z0-9-]+\.vercel\.app/.test(h)),
      vacios: hrefs.filter((h) => !h),
    };
  });
  await ctx.close();
  afirmar(r.rotos.length === 0, `anclas sin destino: ${r.rotos.join(', ')}`);
  afirmar(r.raros.length === 0, `enlaces a direcciones de prueba: ${r.raros.join(', ')}`);
  afirmar(r.vacios.length === 0, `${r.vacios.length} enlaces sin href`);
});

prueba(24, 'lo que baja al abrir la página pesa menos de 1,2 MB', async () => {
  const { ctx, page } = await abrir({ viewport: { width: 390, height: 844 }, isMobile: true });
  const bytes = await page.evaluate(() =>
    (performance.getEntriesByType('resource') as PerformanceResourceTiming[]).reduce((s, e) => s + (e.transferSize || e.encodedBodySize || 0), 0) +
    ((performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming)?.transferSize ?? 0)
  );
  await ctx.close();
  console.log(`        (bajó ${(bytes / 1024).toFixed(0)} KB en un celular, sin scrollear)`);
  afirmar(bytes < 1.2 * 1024 * 1024, `bajó ${(bytes / 1024).toFixed(0)} KB`);
});

prueba(25, 'en un celular no hay scroll de costado', async () => {
  const { ctx, page } = await abrir({ viewport: { width: 360, height: 780 }, isMobile: true, hasTouch: true });
  await recorrer(page);
  const ancho = await page.evaluate(() => document.documentElement.scrollWidth);
  await ctx.close();
  afirmar(ancho === 360, `la página mide ${ancho} px en una pantalla de 360`);
});

async function main() {
  navegador = await abrirNavegador();
  let codigo = 1;
  try {
    codigo = await correrTodas(`Página comercial — ${BASE}`);
  } finally {
    await navegador.close();
  }
  process.exit(codigo);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
