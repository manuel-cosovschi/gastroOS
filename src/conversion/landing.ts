/**
 * Verificación de las páginas /conv antes de mandarles tráfico pago.
 *
 * Por cada producto:
 *   1. La página responde 200 en su dominio (sin redirecciones a otro host).
 *   2. Cada variante `?v=` que usan los anuncios muestra SU titular (el texto
 *      verificado del catálogo). Un anuncio que promete «stock» y cae en una
 *      página que habla de otra cosa es plata tirada.
 *   3. Hay un formulario o una acción principal.
 *   4. Los UTM no se pierden (la página no redirige sacándolos).
 *   5. El píxel de Meta: si está en el HTML y, con Chromium, si se carga de
 *      verdad. En el navegador se BLOQUEAN las llamadas a facebook.com/tr para
 *      que la verificación no mande eventos falsos al píxel.
 *
 * El resultado queda en `smf.landing_checks`. `campaign.prepare` exige una
 * verificación correcta de las últimas 24 h.
 */

import { config } from '../config.ts';
import { db, j } from '../db/index.ts';
import { audit } from '../core/audit.ts';
import { getProduct } from '../catalog/index.ts';
import type { Product } from '../catalog/types.ts';
import { notify } from '../notify/index.ts';

export interface Check {
  name: string;
  ok: boolean;
  detail: string;
  blocking: boolean;
}

export interface LandingResult {
  product: string;
  url: string;
  ok: boolean;
  pixel: 'present' | 'missing' | 'unknown';
  pixelId?: string;
  checks: Check[];
  checkedAt: string;
}

const UTM_PRUEBA = 'utm_source=smf_check&utm_medium=verification&utm_campaign=smf_check';

const norm = (s: string) =>
  s
    .replace(/&#x27;|&#39;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/&amp;/g, '&')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ');

export async function verifyLanding(productId: string, { browser = true, actor = 'system' } = {}): Promise<LandingResult> {
  const p = getProduct(productId);
  const checks: Check[] = [];
  const base = new URL(p.urls.conv);
  let pixel: LandingResult['pixel'] = 'unknown';
  let pixelId: string | undefined;

  for (const v of p.conv.variants) {
    const url = `${base.origin}${base.pathname}?${UTM_PRUEBA}&v=${encodeURIComponent(v)}`;
    try {
      const r = await fetch(url, { redirect: 'follow', signal: AbortSignal.timeout(20_000), headers: { 'User-Agent': 'SovareMarketingFactory/0.1 (verificación de landing)' } });
      const html = await r.text();
      const final = new URL(r.url);
      checks.push({ name: `responde (${v})`, ok: r.status === 200, detail: `HTTP ${r.status}`, blocking: true });
      checks.push({ name: `mismo dominio (${v})`, ok: final.host === base.host, detail: final.host, blocking: true });
      checks.push({ name: `conserva UTM (${v})`, ok: final.searchParams.get('utm_source') === 'smf_check', detail: final.search || '(sin parámetros)', blocking: true });
      const angle = p.angles.find((a) => a.conv_variant === v);
      if (angle) {
        // La bajada de la variante se renderiza entera (el titular viene partido
        // en título y acento): si está, la página muestra lo que promete el anuncio.
        const visto = norm(html).includes(norm(angle.body).trim());
        checks.push({ name: `texto de la variante ${v}`, ok: visto, detail: visto ? angle.headline : `no se encontró la bajada de «${angle.headline}»`, blocking: true });
      }
      if (v === p.conv.variants[0]) {
        checks.push({ name: 'tiene formulario o acción principal', ok: /<form[\s>]/i.test(html) || /contratar/i.test(html), detail: /<form[\s>]/i.test(html) ? 'formulario' : 'botón', blocking: true });
        const m = html.match(/fbq\(\\?['"]init\\?['"]\s*,\s*\\?['"](\d{6,20})/);
        pixel = m ? 'present' : 'missing';
        pixelId = m?.[1];
        checks.push({ name: 'píxel de Meta en el HTML', ok: !!m, detail: m ? `píxel ${m[1]}` : `no está: falta ${p.conv.pixel_env ?? 'NEXT_PUBLIC_META_PIXEL_ID'} en el despliegue`, blocking: false });
      }
    } catch (e) {
      checks.push({ name: `responde (${v})`, ok: false, detail: e instanceof Error ? e.message : String(e), blocking: true });
    }
  }

  if (browser && config.chromium) {
    try {
      const b = await browserCheck(p);
      checks.push(...b.checks);
      if (b.pixelLoaded) pixel = 'present';
    } catch (e) {
      checks.push({ name: 'verificación en navegador', ok: false, detail: e instanceof Error ? e.message : String(e), blocking: false });
    }
  }

  const expected = config.pixelFor(p.id).pixelId;
  if (expected && pixelId && expected !== pixelId) {
    checks.push({ name: 'píxel coincide con la configuración', ok: false, detail: `la página usa ${pixelId}, la Factory espera ${expected}`, blocking: true });
  }

  const ok = checks.filter((c) => c.blocking).every((c) => c.ok);
  const result: LandingResult = { product: p.id, url: p.urls.conv, ok, pixel, pixelId, checks, checkedAt: new Date().toISOString() };
  const d = await db();
  await d.query('INSERT INTO smf.landing_checks (product_id, url, ok, pixel, checks) VALUES ($1,$2,$3,$4,$5::jsonb)', [p.id, p.urls.conv, ok, pixel, j(checks)]);
  await audit({ actor, action: 'conv.verify', decision: ok ? 'done' : 'failed', target: p.id, details: { pixel, failed: checks.filter((c) => !c.ok).map((c) => c.name) } });
  if (!ok) {
    await notify({ kind: 'tracking_problem', severity: 'critical', title: `${p.name}: la página /conv no pasó la verificación`, body: checks.filter((c) => !c.ok).map((c) => `✗ ${c.name}: ${c.detail}`).join('\n'), dedupKey: `conv:${p.id}:${new Date().toISOString().slice(0, 10)}:fail` });
  } else if (pixel !== 'present') {
    await notify({ kind: 'tracking_problem', severity: 'warning', title: `${p.name}: /conv sin píxel de Meta`, body: `La página anda, pero no carga el píxel. Sin él Meta no puede optimizar por consultas ni atribuir resultados. Cargar ${p.conv.pixel_env} en el despliegue del producto.`, dedupKey: `conv:${p.id}:pixel-missing:${new Date().toISOString().slice(0, 10)}`, push: false });
  }
  return result;
}

async function browserCheck(p: Product): Promise<{ pixelLoaded: boolean; checks: Check[] }> {
  const { chromium } = await import('playwright-core');
  const proxy = process.env.HTTPS_PROXY || process.env.https_proxy;
  const b = await chromium.launch({ executablePath: config.chromium, ...(proxy ? { proxy: { server: proxy } } : {}) });
  const checks: Check[] = [];
  let pixelScript = false;
  let eventosBloqueados = 0;
  try {
    const ctx = await b.newContext({ ignoreHTTPSErrors: !!proxy, viewport: { width: 390, height: 844 }, isMobile: true });
    // Nada de la verificación llega al píxel ni a GA4.
    await ctx.route(/facebook\.com\/tr|google-analytics\.com|\/g\/collect/, (route) => {
      eventosBloqueados++;
      return route.abort();
    });
    ctx.on('request', (r) => {
      if (r.url().includes('connect.facebook.net') && r.url().includes('fbevents.js')) pixelScript = true;
    });
    const page = await ctx.newPage();
    const errores: string[] = [];
    page.on('pageerror', (e) => errores.push(e.message));
    const resp = await page.goto(`${p.urls.conv}?${UTM_PRUEBA}&v=${p.conv.variants[0]}`, { waitUntil: 'networkidle', timeout: 45_000 });
    checks.push({ name: 'carga en un celular (Chromium)', ok: !!resp && resp.status() === 200, detail: `HTTP ${resp?.status()}`, blocking: true });
    const fbq = await page.evaluate(() => typeof (window as unknown as { fbq?: unknown }).fbq === 'function');
    const cookie = await page.evaluate(() => document.cookie.includes('conv_atrib'));
    checks.push({ name: 'guarda la atribución (cookie conv_atrib)', ok: cookie, detail: cookie ? 'sí' : 'no se creó la cookie', blocking: false });
    checks.push({ name: 'píxel cargado en el navegador', ok: fbq && pixelScript, detail: fbq ? `fbq listo; ${eventosBloqueados} envío(s) bloqueado(s) por la prueba` : 'window.fbq no existe', blocking: false });
    checks.push({ name: 'sin errores de JavaScript', ok: errores.length === 0, detail: errores.slice(0, 2).join(' | ') || 'ninguno', blocking: false });
    return { pixelLoaded: fbq && pixelScript, checks };
  } finally {
    await b.close();
  }
}

/** La última verificación de un producto, si existe. */
export async function lastLandingCheck(productId: string): Promise<{ ok: boolean; pixel: string; checked_at: string; checks: Check[] } | null> {
  const d = await db();
  const [r] = await d.query<{ ok: boolean; pixel: string; checked_at: string; checks: Check[] }>(
    'SELECT ok, pixel, checked_at, checks FROM smf.landing_checks WHERE product_id = $1 ORDER BY checked_at DESC LIMIT 1',
    [productId]
  );
  return r ?? null;
}
