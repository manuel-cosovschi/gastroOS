/**
 * Lo que comparten los scripts que recorren el sistema con un navegador: cómo
 * se abre Chromium, cómo se entra a la demo y cómo se saca la guía de encima.
 *
 * ------------------------------------------------------------------
 * La dirección
 * ------------------------------------------------------------------
 * Sale de `GASTROOS_BASE`. Las capturas y los videos van contra producción por
 * defecto —es lo que la página muestra—; las baterías de prueba, contra el
 * servidor local, y cada una lo dice arriba.
 *
 * ------------------------------------------------------------------
 * El navegador
 * ------------------------------------------------------------------
 * `CHROMIUM` apunta a un ejecutable ya instalado y `CHROMIUM_ARGS` agrega
 * banderas. Existen porque el Chromium que trae Playwright no siempre es el que
 * hay en la máquina: un `npm install` que sube Playwright de versión pide un
 * navegador que no está, y bajarlo no siempre se puede. Con esto se usa el que
 * hay en vez de pelear con el que falta.
 */

import { chromium, type Browser, type Page } from 'playwright';

export const BASE = (process.env.GASTROOS_BASE ?? 'https://gastroos.shop').replace(/\/$/, '');

export async function abrirNavegador(): Promise<Browser> {
  return chromium.launch({
    executablePath: process.env.CHROMIUM || undefined,
    // Se corta antes de cada `--` y no en cada espacio: hay banderas que llevan
    // espacios adentro, como `--host-resolver-rules=MAP a 127.0.0.1`.
    args: (process.env.CHROMIUM_ARGS ?? '').trim().split(/\s+(?=--)/).filter(Boolean),
  });
}

/**
 * Entra a la demo como cualquier visitante: el botón del login, que arma una
 * copia propia de la plantilla. Nada de cuentas guardadas ni de atajos: lo que
 * se fotografía es lo que ve el que entra.
 */
export async function entrarALaDemo(page: Page): Promise<void> {
  const boton = page.getByRole('button', { name: 'Entrar a la demo' });
  for (let intento = 1; ; intento += 1) {
    const r = await page.goto(`${BASE}/login`, { waitUntil: 'networkidle' });
    if (await boton.isVisible().catch(() => false)) break;
    // No se reintenta en silencio: lo que mostró la pantalla queda escrito,
    // porque un login que a veces no muestra el botón es un error de
    // producción, no una molestia del script.
    const texto = (await page.locator('body').innerText().catch(() => '')).replace(/\s+/g, ' ').slice(0, 300);
    console.warn(`  ! intento ${intento}: /login respondió ${r?.status()} en ${page.url()} sin el botón de la demo: «${texto}»`);
    if (intento === 3) throw new Error('El login no mostró el botón de la demo en tres intentos.');
    await page.waitForTimeout(3000);
  }
  await boton.click({ timeout: 20_000 });
  await page.waitForURL(/\/admin/, { timeout: 60_000, waitUntil: 'commit' });
  await page.waitForLoadState('networkidle');
  await saltarLaGuia(page);
}

/**
 * La guía arranca sola en la primera visita y, mientras corre, lleva al panel
 * a la pantalla de su paso: un `goto` a otra pantalla termina de vuelta en el
 * inicio. Por eso se salta antes de navegar, no sólo antes de fotografiar.
 */
export async function saltarLaGuia(page: Page): Promise<void> {
  const saltar = page.getByRole('button', { name: 'Saltar la guía' });
  try {
    await saltar.click({ timeout: 8_000 });
    await page.waitForTimeout(400);
  } catch {
    // Ya estaba saltada: es lo que pasa si la sesión vuelve.
  }
}

/** Va a una pantalla del panel y espera a que esté de verdad, no sólo la URL. */
export async function irA(page: Page, ruta: string, titulo: string): Promise<void> {
  await page.goto(`${BASE}${ruta}`, { waitUntil: 'networkidle' });
  await page.getByRole('heading', { name: titulo, exact: true, level: 1 }).waitFor({ timeout: 20_000 });
  await page.waitForTimeout(500);
}

/** Hoy en Argentina, como `AAAA-MM-DD`. El servidor puede estar en UTC. */
export function hoyEnArgentina(): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Argentina/Buenos_Aires' }).format(new Date());
}
