/**
 * Las capturas del sistema que muestra la página comercial.
 *
 *   npm run capturas                                    # contra producción
 *   GASTROOS_BASE=http://localhost:3000 npm run capturas
 *
 * ==================================================================
 * Por qué un script y no sacarlas a mano
 * ==================================================================
 * Una captura es la parte de la página de venta que puede quedar vieja sin que
 * nadie lo note: el producto cambia, la imagen se queda, y la página sigue
 * mostrando algo que ya no existe. Con esto, actualizarlas es un comando. Y como
 * la corrida escribe `src/components/comercial/capturas.generado.ts` con la
 * fecha, el tamaño real de cada imagen y la huella de la interfaz,
 * `npm run prueba:comercial` falla cuando una pantalla se tocó después de la
 * última corrida.
 *
 * ==================================================================
 * De dónde salen
 * ==================================================================
 * De la demo en vivo, entrando como cualquier visitante: el botón del login
 * arma una copia propia de la plantilla, así que lo que se fotografía es
 * exactamente lo que ve el que entra. La página enlaza a esa misma demo al lado
 * de cada imagen: cualquiera la abre y compara.
 *
 * Antes de la primera foto del panel corre la guarda de datos personales
 * (`scripts/comercial/guarda.mts`). Si hay un cliente que no es del sembrado,
 * la corrida corta con código 3 y no se escribe ni una imagen.
 *
 * ==================================================================
 * Lo que escribe en producción, y cómo lo limpia
 * ==================================================================
 * Entrar a la demo crea una cuenta y una copia del negocio de ejemplo. Es lo
 * mismo que pasa con cada visitante, vive aislada —nadie más la ve— y la base la
 * tira sola a los tres días. No se escribe nada más: el pedido de la captura se
 * arma en la pantalla pero no se guarda.
 *
 * La excepción es `CAPTURAS_PRUEBA_AJENO=1`, que existe sólo para la prueba de
 * la guarda: carga un cliente ajeno en la copia para comprobar que la corrida
 * corta. Ese cliente se borra al terminar, salga bien o mal, reiniciando la
 * copia: el `finally` de abajo.
 */

import { mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import sharp from 'sharp';
import type { Page } from 'playwright';
import { BASE, abrirNavegador, entrarALaDemo, hoyEnArgentina, irA } from './comercial/navegador.mjs';
import { DatosAjenos, nadieAjeno } from './comercial/guarda.mjs';
import { huellaDeLaInterfaz } from './comercial/huella.mjs';

const DESTINO = process.env.CAPTURAS_DESTINO ?? join(process.cwd(), 'public', 'capturas');
const MODULO = join(process.cwd(), 'src', 'components', 'comercial', 'capturas.generado.ts');
const PRUEBA_AJENO = process.env.CAPTURAS_PRUEBA_AJENO === '1';

/**
 * Las que la página necesita. Si una no sale, la corrida falla y no se escribe
 * el módulo: si no, un selector que cambió dejaría la página compilando contra
 * la versión anterior y con una imagen rota en producción.
 */
const REQUERIDAS = ['telefono-inicio', 'panel-inicio', 'pedido-nuevo', 'estadisticas', 'stock'] as const;
type Clave = (typeof REQUERIDAS)[number];

const hechas = new Map<Clave, { que: string; de: string; ancho: number; alto: number }>();
const crudas: string[] = [];

/**
 * Guarda la foto como webp. El PNG de una pantalla a doble densidad pesa medio
 * mega; la página tiene seis, y el que la abre desde un celular las paga todas.
 */
async function guardar(page: Page, clave: Clave, que: string, recorte?: { alto: number }) {
  const cruda = join(DESTINO, `${clave}.png`);
  crudas.push(cruda);
  const viewport = page.viewportSize()!;
  await page.screenshot({
    path: cruda,
    clip: recorte ? { x: 0, y: 0, width: viewport.width, height: recorte.alto } : undefined,
  });
  const archivo = join(DESTINO, `${clave}.webp`);
  const info = await sharp(cruda).webp({ quality: 82 }).toFile(archivo);
  hechas.set(clave, { que, de: page.url(), ancho: info.width, alto: info.height });
  console.log(`  ✓ ${clave}.webp  ${info.width}×${info.height}  ${(info.size / 1024).toFixed(0)} KB`);
}

/** Carga un cliente que no es del sembrado. Sólo para la prueba de la guarda. */
async function sembrarAjeno(page: Page) {
  await irA(page, '/admin/clientes/nuevo', 'Nuevo cliente');
  await page.getByLabel('Nombre *').fill('Persona');
  await page.getByLabel('Apellido').fill('Ajena De Prueba');
  await page.getByLabel('Teléfono').fill('+54 9 223 400 0000');
  await page.getByRole('button', { name: 'Crear cliente' }).click();
  await page.waitForURL(/\/admin\/clientes\/[0-9a-f-]{36}/, { timeout: 20_000 });
  console.log('  … cargué un cliente ajeno en esta copia de la demo (CAPTURAS_PRUEBA_AJENO)');
}

/**
 * Tira la copia y arma otra limpia: es la forma de borrar lo que esta corrida
 * cargó. El botón está en el cartel de la demo y pide confirmación.
 *
 * Y después vuelve a mirar la lista con la misma guarda: decir «lo borré» sin
 * comprobarlo sería contestar que está bien sin saberlo.
 */
async function reiniciarLaDemo(page: Page) {
  await page.goto(`${BASE}/admin`, { waitUntil: 'networkidle' });
  await page.getByRole('button', { name: 'Reiniciar la demo' }).first().click();
  await page.getByRole('button', { name: 'Sí, reiniciar' }).first().click();
  await page.waitForURL(/\/admin/, { waitUntil: 'networkidle' });
  await page.waitForTimeout(1500);
  await nadieAjeno(page);
  console.log('  ✓ reinicié la copia de la demo y la volví a revisar: lo cargado por la prueba ya no existe');
}

async function main() {
  mkdirSync(DESTINO, { recursive: true });
  console.log(`\nCapturas de ${BASE}\n`);

  const navegador = await abrirNavegador();
  let sembrado = false;
  let panelParaLimpiar: Page | null = null;

  try {
    // ================================================================
    // El panel, en una pantalla de escritorio
    // ================================================================
    const escritorio = await navegador.newContext({ viewport: { width: 1280, height: 800 }, deviceScaleFactor: 2 });
    const panel = await escritorio.newPage();
    panelParaLimpiar = panel;
    await entrarALaDemo(panel);

    if (PRUEBA_AJENO) {
      await sembrarAjeno(panel);
      sembrado = true;
    }

    // Antes de la primera foto. Todo lo que sigue sale de esta misma copia.
    await nadieAjeno(panel);

    await irA(panel, '/admin', `Hola, Dulce Estudio`);
    await guardar(panel, 'panel-inicio', 'El inicio del panel: lo de hoy, lo que falta y las próximas entregas');

    await irA(panel, '/admin/pedidos/nuevo', 'Nuevo pedido');
    await panel.getByLabel('Nombre *').fill('Lucía Fernández');
    await panel.getByRole('button', { name: /Torta Red Velvet/ }).click();
    await panel.getByRole('button', { name: /Cookies x6/ }).click();
    await panel.waitForTimeout(500);
    await guardar(panel, 'pedido-nuevo', 'El alta de un pedido: el cliente, los productos y el total');

    await irA(panel, '/admin/estadisticas', 'Estadísticas');
    await guardar(panel, 'estadisticas', 'Las estadísticas: facturación, gastos y margen');

    await irA(panel, '/admin/stock', 'Stock');
    await guardar(panel, 'stock', 'El stock de insumos, con los que están por debajo del mínimo');

    // ================================================================
    // El panel en el celular, con la misma sesión
    // ================================================================
    // Un contexto nuevo con las cookies del anterior: es la misma copia de la
    // demo, que ya pasó la guarda. Abrir otra sería fotografiar algo que nadie
    // revisó.
    const celular = await navegador.newContext({
      viewport: { width: 390, height: 844 },
      deviceScaleFactor: 2,
      isMobile: true,
      hasTouch: true,
      storageState: await escritorio.storageState(),
    });
    const movil = await celular.newPage();
    await irA(movil, '/admin', 'Hola, Dulce Estudio');
    await guardar(movil, 'telefono-inicio', 'El inicio del panel en un celular');

    await celular.close();
    if (!sembrado) await escritorio.close();
  } catch (e) {
    if (e instanceof DatosAjenos) {
      console.error(`\n✗ ${e.message}\n`);
      // Lo que alcanzó a escribirse no sirve: se borra para que nadie lo suba.
      for (const c of crudas) rmSync(c, { force: true });
      process.exitCode = 3;
      return;
    }
    throw e;
  } finally {
    if (sembrado && panelParaLimpiar) {
      await reiniciarLaDemo(panelParaLimpiar).catch((e) =>
        console.error(`  ✗ NO pude reiniciar la demo: el cliente ajeno sigue en esa copia (${e}). Vence sola en tres días.`)
      );
    }
    await navegador.close();
  }

  for (const c of crudas) rmSync(c, { force: true });

  const faltan = REQUERIDAS.filter((r) => !hechas.has(r));
  if (faltan.length > 0) {
    console.error(`\n✗ Faltan capturas: ${faltan.join(', ')}. No toqué ${MODULO}.`);
    process.exitCode = 1;
    return;
  }

  // Una corrida de prueba (con otro destino) no reescribe el módulo de la
  // página: escribiría en el código direcciones de imágenes que no se publican.
  if (process.env.CAPTURAS_DESTINO) {
    console.log('\nDestino de prueba: no reescribo el módulo generado.');
    return;
  }

  const fecha = hoyEnArgentina();
  const huella = huellaDeLaInterfaz();
  const entradas = REQUERIDAS.map((clave) => {
    const c = hechas.get(clave)!;
    return `  '${clave}': {
    archivo: '/capturas/${clave}.webp',
    ancho: ${c.ancho},
    alto: ${c.alto},
    que: ${JSON.stringify(c.que)},
  },`;
  }).join('\n');

  writeFileSync(
    MODULO,
    `/**
 * Las capturas que muestra la página comercial.
 *
 * GENERADO por \`npm run capturas\`. Editarlo a mano no saca ninguna captura:
 * lo que dice acá tiene que ser lo que hay en \`public/capturas/\`.
 *
 * El ancho y el alto salen de las imágenes, así que son los de verdad. La fecha
 * es la de la corrida y la página la muestra: una captura sin fecha es una
 * afirmación sobre un producto que ya puede haber cambiado. La huella es la de
 * la interfaz en ese momento; \`npm run prueba:comercial\` la recalcula y falla si
 * alguien tocó una pantalla después.
 */

export const CAPTURAS_SACADAS_EL = '${fecha}';

export const HUELLA_DE_LA_INTERFAZ = '${huella}';

export const CAPTURAS = {
${entradas}
} as const;
`
  );
  console.log(`\n✓ ${hechas.size} capturas, ${fecha}, huella ${huella}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
