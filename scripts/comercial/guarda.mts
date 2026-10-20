/**
 * La guarda de datos personales: antes de fotografiar el panel, comprobar que
 * no haya nadie de verdad adentro.
 *
 * ------------------------------------------------------------------
 * Por qué hace falta, si la demo es inventada
 * ------------------------------------------------------------------
 * La demo es una copia de un negocio plantilla, y la plantilla es inventada:
 * ocho clientes con teléfonos `+54 11 5555 01xx` que no existen. Pero «es
 * inventada» es una afirmación sobre el pasado. Alcanza con que algo escriba en
 * la plantilla —un pedido de la tienda de ejemplo, una corrida de prueba, una
 * carga a mano— para que la próxima copia lleve el nombre y el teléfono de una
 * persona, y la próxima captura los publique en la página de venta.
 *
 * Pasó en AlojaOS, el sistema hermano: una batería de prueba dejó una reserva
 * viva en producción y la corrida de capturas que vino después fotografió el
 * panel con el nombre, el mail y el teléfono adentro. Lo que se aprendió de eso
 * es que la única garantía es mirar antes de disparar.
 *
 * ------------------------------------------------------------------
 * Qué mira
 * ------------------------------------------------------------------
 * La lista de clientes de la copia, que es por donde pasa todo: cada pedido
 * —de la tienda o cargado a mano— crea o reutiliza un cliente. Cada fila tiene
 * que ser un cliente del sembrado, con su nombre y su teléfono. Uno que no
 * está, o una lista con más de una página, y corta.
 *
 * Se mira con la sesión de la propia demo y no con una clave de servicio: la
 * pregunta no es «qué hay en la base» sino «qué va a salir en la foto», y eso
 * lo contesta exactamente lo que esa sesión ve.
 *
 * Corta en vez de avisar porque una captura con datos ajenos no se arregla
 * mirando la consola después: se publica.
 */

import type { Page } from 'playwright';
import * as datosDeLaDemo from '../demo-data';
import { irA } from './navegador.mjs';

export class DatosAjenos extends Error {}

/*
 * `demo-data.ts` es un módulo de CommonJS para Node (el paquete no es `type:
 * module`), y al importarlo desde acá la interoperación lo envuelve en
 * `default`. Se contemplan las dos formas para que ande igual si un día cambia.
 */
const modulo = datosDeLaDemo as unknown as {
  DEMO_CUSTOMERS?: typeof datosDeLaDemo.DEMO_CUSTOMERS;
  default?: { DEMO_CUSTOMERS: typeof datosDeLaDemo.DEMO_CUSTOMERS };
};
const DEMO_CUSTOMERS = modulo.DEMO_CUSTOMERS ?? modulo.default?.DEMO_CUSTOMERS;
if (!DEMO_CUSTOMERS?.length) throw new Error('No pude leer los clientes del sembrado en scripts/demo-data.ts.');

/** Los del sembrado, como aparecen en la lista: nombre completo y teléfono. */
const PERMITIDOS = DEMO_CUSTOMERS.map((c) => ({
  nombre: `${c.first_name} ${c.last_name}`,
  telefono: c.phone,
}));

export async function nadieAjeno(page: Page): Promise<void> {
  await irA(page, '/admin/clientes', 'Clientes');

  // Cada cliente es un enlace a su ficha. Las iniciales del avatar son otro
  // enlace a la misma ficha, así que se agrupa por dirección y se queda el
  // texto más largo, que es el de la fila.
  const filas = await page
    .locator('main a[href^="/admin/clientes/"]')
    .evaluateAll((enlaces) => {
      const porFicha = new Map<string, string>();
      for (const a of enlaces) {
        const href = a.getAttribute('href') ?? '';
        if (!/\/admin\/clientes\/[0-9a-f-]{36}$/.test(href)) continue;
        const texto = (a as HTMLElement).innerText;
        if (texto.length > (porFicha.get(href)?.length ?? 0)) porFicha.set(href, texto);
      }
      return [...porFicha.values()];
    });

  if (filas.length === 0) {
    // Una lista vacía no es «nadie ajeno»: es que la pantalla cambió y esta
    // guarda dejó de mirar. Pasar en verde acá sería contestar que está bien
    // sin estarlo.
    throw new DatosAjenos('No encontré ningún cliente en la lista: la pantalla cambió y la guarda no está mirando.');
  }

  const ajenos = filas.filter(
    (fila) => !PERMITIDOS.some((p) => fila.includes(p.nombre) && fila.includes(p.telefono))
  );

  const hayMasPaginas =
    (await page.getByRole('link', { name: /siguiente/i }).count()) > 0 ||
    (await page.getByRole('button', { name: /siguiente/i }).count()) > 0;

  if (ajenos.length > 0 || hayMasPaginas) {
    throw new DatosAjenos(
      'La demo tiene clientes que no son del sembrado:\n   ' +
        (ajenos.length ? ajenos.map((a) => `«${a.split('\n').slice(0, 2).join(' · ')}»`).join('\n   ') : '(hay más de una página de clientes)') +
        '\n   Fotografiar el panel así publicaría esos datos en la página de venta.' +
        '\n   Revisá la plantilla de la demo (`is_demo_template`) y volvé a correr.'
    );
  }

  console.log(`  ✓ guarda: ${filas.length} clientes, todos del sembrado`);
}
