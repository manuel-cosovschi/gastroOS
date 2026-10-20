/**
 * La batería de la página de conversión (`/conv`).
 *
 *   npm run prueba:conv                                   # contra el servidor local
 *   GASTROOS_BASE=https://gastroos.shop npm run prueba:conv
 *
 * No escribe nada salvo con `CONV_PRUEBA_REAL=1`: entonces manda una consulta
 * de verdad, a nombre de «ZZ Prueba conv (borrar)», que queda en el panel de
 * SOVARE como prospecto y se descarta desde ahí con el botón «Descartar». Esta
 * batería no la puede borrar sola —no tiene, ni debe tener, una clave para
 * borrar prospectos—, así que lo dice al terminar.
 *
 * Los eventos se miden reemplazando `fbq` por un grabador antes de que cargue
 * la página: se prueba lo que la página manda, no lo que Meta dice que recibió.
 */

import type { Browser, Page } from 'playwright';
import { abrirNavegador } from './comercial/navegador.mjs';
import { afirmar, correrTodas, prueba } from './comercial/arnes.mjs';
import { frasesProhibidas } from './comercial/frases.mjs';

const BASE = (process.env.GASTROOS_BASE ?? 'http://localhost:3000').replace(/\/$/, '');
const LOCAL = /localhost|127\.0\.0\.1/.test(BASE);
const REAL = process.env.CONV_PRUEBA_REAL === '1';
let navegador: Browser;

/** Abre /conv con un `fbq` grabador en lugar del de Meta. */
async function abrir(query = '', opciones: Parameters<Browser['newContext']>[0] = {}) {
  const ctx = await navegador.newContext({ viewport: { width: 1280, height: 860 }, ...opciones });
  await ctx.addInitScript(() => {
    const w = window as unknown as { __eventos: unknown[][]; fbq: (...a: unknown[]) => void };
    w.__eventos = [];
    w.fbq = (...a: unknown[]) => w.__eventos.push(a);
  });
  const page = await ctx.newPage();
  const errores: string[] = [];
  page.on('console', (m) => m.type() === 'error' && errores.push(m.text().slice(0, 200)));
  page.on('pageerror', (e) => errores.push(e.message));
  const r = await page.goto(`${BASE}/conv${query}`, { waitUntil: 'networkidle' });
  return { ctx, page, errores, status: r?.status() };
}

const eventos = (page: Page) => page.evaluate(() => (window as unknown as { __eventos: unknown[][] }).__eventos.map((e) => [e[1], e[3]]));

prueba(1, '/conv responde 200 y sin errores en la consola', async () => {
  const { ctx, page, errores, status } = await abrir();
  await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
  await page.waitForTimeout(800);
  await ctx.close();
  afirmar(status === 200, `respondió ${status}`);
  afirmar(errores.length === 0, errores.join('\n'));
});

prueba(2, 'sin menú: la barra tiene el logo y una sola acción', async () => {
  const { ctx, page } = await abrir();
  const enlaces = await page.locator('header a').evaluateAll((as) => as.map((a) => a.getAttribute('href')));
  await ctx.close();
  afirmar(enlaces.length === 1 && ['#planes', '#consulta'].includes(enlaces[0] ?? ''), `la barra tiene: ${JSON.stringify(enlaces)}`);
});

prueba(3, 'la acción principal lleva a los planes, y cada plan al alta real', async () => {
  const { ctx, page } = await abrir();
  const principal = await page.locator('main section').first().locator('a').first().getAttribute('href');
  const altas = await page.locator('#planes a[href^="/contratar?plan="]').evaluateAll((as) =>
    as.map((a) => [a.getAttribute('href'), a.getAttribute('data-conv-evento')])
  );
  await ctx.close();
  if (altas.length === 0) {
    // Contrataciones apagadas: la acción principal tiene que ser el formulario.
    afirmar(principal === '#consulta', `sin contrataciones, el botón principal va a ${principal}`);
    if (!LOCAL) throw new Error('en producción no hay ningún plan con «Contratar»: las contrataciones están apagadas');
    return;
  }
  afirmar(principal === '#planes', `el botón principal va a ${principal}`);
  afirmar(altas.every(([, e]) => e === 'InitiateCheckout'), 'hay un «Contratar» que no manda el inicio de pago');
});

prueba(4, 'no dice nada que no podamos sostener', async () => {
  const { ctx, page } = await abrir();
  const texto = await page.evaluate(() => document.body.textContent ?? '');
  await ctx.close();
  const malas = frasesProhibidas(texto);
  afirmar(malas.length === 0, malas.join('\n'));
  // Y no promete rubros que el sistema no atiende: no es un punto de venta.
  afirmar(!/rotiser[ií]a|casa de comidas|restaurante/i.test(texto.replace(/¿Sirve para un local con mostrador[^?]*\?/, '')), 'la página ofrece el sistema a un rubro de mostrador');
});

prueba(5, 'las variantes del titular: ?v= cambia el h1, y una desconocida cae en la base', async () => {
  const titulo = async (q: string) => {
    const { ctx, page } = await abrir(q);
    const t = await page.locator('h1').textContent();
    await ctx.close();
    return t?.trim();
  };
  const base = await titulo('');
  const stock = await titulo('?v=stock');
  const rara = await titulo('?v=<script>');
  afirmar(base !== stock, 'la variante stock muestra el mismo titular que la base');
  afirmar(rara === base, `una variante desconocida mostró «${rara}»`);
});

prueba(6, 'la campaña queda guardada, y la primera visita manda', async () => {
  const { ctx, page } = await abrir('?utm_source=meta&utm_medium=cpc&utm_campaign=pasteleria-oct&v=stock&fbclid=abc123');
  await page.goto(`${BASE}/conv?utm_source=otra`, { waitUntil: 'networkidle' });
  const cookie = (await ctx.cookies()).find((c) => c.name === 'conv_atrib');
  await ctx.close();
  afirmar(cookie, 'no se guardó la cookie de atribución');
  const a = JSON.parse(decodeURIComponent(cookie.value));
  afirmar(a.utm_source === 'meta' && a.utm_campaign === 'pasteleria-oct' && a.variante === 'stock' && a.fbclid === 'abc123', `atribución: ${cookie.value}`);
  afirmar(cookie.sameSite === 'Lax' && (LOCAL || cookie.secure), `la cookie: sameSite ${cookie.sameSite}, secure ${cookie.secure}`);
});

prueba(7, '«Contratar» manda InitiateCheckout una sola vez, con el plan y el valor', async () => {
  const { ctx, page } = await abrir('?utm_source=meta');
  if ((await page.locator('#planes a[data-conv-plan="negocio"]').count()) === 0) {
    await ctx.close();
    afirmar(LOCAL, 'en producción no está el «Contratar» del plan Negocio');
    console.log('        (salteada en local: las contrataciones están apagadas)');
    return;
  }
  // Dos clics seguidos y sin navegar: se mide el evento, no el alta.
  await page.evaluate(() => {
    const a = document.querySelector<HTMLAnchorElement>('#planes a[data-conv-plan="negocio"]')!;
    a.addEventListener('click', (e) => e.preventDefault());
    a.click();
    a.click();
  });
  const ev = (await eventos(page)).filter(([n]) => n === 'InitiateCheckout');
  const params = (await page.evaluate(() => (window as unknown as { __eventos: unknown[][] }).__eventos.find((e) => e[1] === 'InitiateCheckout')?.[2])) as
    | Record<string, unknown>
    | undefined;
  await ctx.close();
  afirmar(ev.length === 1, `InitiateCheckout salió ${ev.length} veces`);
  afirmar(params?.plan === 'negocio' && Number(params?.value) > 0 && params?.currency === 'ARS', `parámetros: ${JSON.stringify(params)}`);
  afirmar(params?.utm_source === 'meta', `no viajó la campaña: ${JSON.stringify(params)}`);
  afirmar(!JSON.stringify(params).match(/@|\d{8,}/), 'el evento lleva algo que parece un dato personal');
});

prueba(8, 'el formulario vacío avisa qué falta y no cuenta un lead', async () => {
  const { ctx, page } = await abrir();
  await page.locator('#consulta button[type="submit"]').click();
  await page.locator('#consulta [role="alert"]').waitFor({ timeout: 10_000 });
  const aviso = await page.locator('#consulta [role="alert"]').textContent();
  const leads = (await eventos(page)).filter(([n]) => n === 'Lead');
  await ctx.close();
  afirmar(/nombre/i.test(aviso ?? ''), `el aviso dice «${aviso}»`);
  afirmar(leads.length === 0, 'salió un Lead sin consulta guardada');
});

prueba(9, 'si se corta la conexión: mensaje claro, los datos quedan y no hay lead', async () => {
  const { ctx, page } = await abrir();
  await page.locator('input[name="nombre"]').fill('Ana');
  await page.locator('input[name="negocio"]').fill('Pastelería de prueba');
  await page.locator('input[name="contacto"]').fill('11 5555 0000');
  // La acción del servidor viaja por POST a la misma página: se corta.
  await page.route(`${BASE}/conv**`, (r) => (r.request().method() === 'POST' ? r.abort() : r.continue()));
  await page.locator('#consulta button[type="submit"]').click();
  await page.locator('#consulta [role="alert"]').waitFor({ timeout: 15_000 });
  const aviso = await page.locator('#consulta [role="alert"]').textContent();
  const sigue = await page.locator('input[name="negocio"]').inputValue();
  const leads = (await eventos(page)).filter(([n]) => n === 'Lead');
  await ctx.close();
  afirmar(/probá de nuevo/i.test(aviso ?? ''), `el aviso dice «${aviso}»`);
  afirmar(sigue === 'Pastelería de prueba', 'se borraron los datos del formulario');
  afirmar(leads.length === 0, 'salió un Lead con el envío cortado');
});

prueba(10, REAL ? 'consulta de verdad: la base la guarda y recién entonces sale el Lead' : 'consulta de verdad (salteada: CONV_PRUEBA_REAL=1 para correrla)', async () => {
  if (!REAL) return;
  const { ctx, page } = await abrir('?utm_source=prueba&utm_campaign=bateria-conv');
  await page.locator('input[name="nombre"]').fill('ZZ Prueba conv');
  await page.locator('input[name="negocio"]').fill('ZZ Prueba conv (borrar)');
  await page.locator('input[name="contacto"]').fill('prueba-conv@gastroos.shop');
  await page.locator('textarea[name="mensaje"]').fill('Consulta automática de la batería de /conv. Descartala desde Prospección.');
  await page.locator('#consulta button[type="submit"]').click();
  await page.getByText('Recibimos tu consulta').waitFor({ timeout: 20_000 });
  const leads = (await eventos(page)).filter(([n]) => n === 'Lead');
  await ctx.close();
  afirmar(leads.length === 1, `Lead salió ${leads.length} veces`);
  afirmar((leads[0][1] as { eventID?: string })?.eventID, 'el Lead salió sin eventID: Meta no podría descartar el duplicado del servidor');
  console.log('        → quedó «ZZ Prueba conv (borrar)» en Prospección: descartala desde el panel.');
});

prueba(11, 'en un celular de 360 px no hay scroll de costado', async () => {
  const { ctx, page } = await abrir('', { viewport: { width: 360, height: 780 }, isMobile: true, hasTouch: true });
  await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
  await page.waitForTimeout(500);
  const ancho = await page.evaluate(() => document.documentElement.scrollWidth);
  await ctx.close();
  afirmar(ancho === 360, `mide ${ancho}px`);
});

prueba(12, 'un h1, campos con etiqueta y la política de privacidad enlazada', async () => {
  const { ctx, page } = await abrir();
  const h1 = await page.locator('h1').count();
  const sinEtiqueta = await page.evaluate(() =>
    Array.from(document.querySelectorAll('#consulta input:not([name="sitio_web"]), #consulta select, #consulta textarea')).filter((c) => !c.closest('label')).length
  );
  const priv = await page.locator('a[href="/privacidad"]').count();
  await ctx.close();
  const r = await fetch(`${BASE}/privacidad`);
  afirmar(h1 === 1, `${h1} h1`);
  afirmar(sinEtiqueta === 0, `${sinEtiqueta} campos sin etiqueta`);
  afirmar(priv > 0 && r.ok, `privacidad: ${priv} enlaces, responde ${r.status}`);
});

prueba(13, 'título, canonical y vista previa para compartir', async () => {
  const { ctx, page } = await abrir();
  const m = (await page.evaluate(`({
    titulo: document.title,
    canonical: document.querySelector('link[rel="canonical"]')?.getAttribute('href') ?? '',
    imagen: document.querySelector('meta[property="og:image"]')?.getAttribute('content') ?? '',
  })`)) as { titulo: string; canonical: string; imagen: string };
  await ctx.close();
  afirmar(m.titulo.startsWith('GastroOS — '), `título «${m.titulo}»`);
  afirmar(m.canonical.endsWith('/conv'), `canonical «${m.canonical}»`);
  afirmar(/^https?:\/\//.test(m.imagen), `og:image «${m.imagen}»`);
  if (!LOCAL) afirmar(m.canonical === `${BASE}/conv`, `canonical apunta a ${m.canonical}`);
});

prueba(14, 'lo que baja al abrir pesa menos de 1 MB en un celular', async () => {
  const { ctx, page } = await abrir('', { viewport: { width: 390, height: 844 }, isMobile: true });
  const bytes = await page.evaluate(
    () =>
      (performance.getEntriesByType('resource') as PerformanceResourceTiming[]).reduce((s, e) => s + (e.transferSize || e.encodedBodySize || 0), 0) +
      ((performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming)?.transferSize ?? 0)
  );
  await ctx.close();
  console.log(`        (bajó ${(bytes / 1024).toFixed(0)} KB)`);
  afirmar(bytes < 1024 * 1024, `bajó ${(bytes / 1024).toFixed(0)} KB`);
});

async function main() {
  navegador = await abrirNavegador();
  let codigo = 1;
  try {
    codigo = await correrTodas(`Página de conversión — ${BASE}/conv`);
  } finally {
    await navegador.close();
  }
  process.exit(codigo);
}
main().catch((e) => {
  console.error(e);
  process.exit(1);
});
