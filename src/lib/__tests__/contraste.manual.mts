/**
 * El contraste de la página comercial, medido y no estimado.
 *
 *   npx tsx src/lib/__tests__/contraste.manual.mts
 *
 * Sobre un fondo casi negro cualquier color "se ve". Eso no es una medición, y
 * la diferencia entre lo que se ve y lo que se lee la paga alguien con la vista
 * cansada mirando un teléfono al sol. Acá se recalcula cada par que la página
 * usa de verdad, con la fórmula de WCAG 2.1, y **falla por debajo de 4,5**.
 *
 * Los colores salen de `tailwind.config.ts`, que es el archivo que la página
 * usa. Si se copiaran acá a mano, el día que alguien cambie la paleta esta
 * prueba seguiría pasando contra los colores viejos, que es la única forma de
 * que una prueba de contraste sea peor que no tenerla.
 *
 * Los dos pares que esto ya cazó están contados en `src/lib/comercial/tema.ts`.
 */

import config from '../../../tailwind.config';

/* ---------- La fórmula de WCAG 2.1 ---------- */

/** Un canal de sRGB, linealizado. */
function canal(valor: number): number {
  const c = valor / 255;
  return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
}

/** Luminancia relativa de un `#RRGGBB`. */
function luminancia(hex: string): number {
  const n = Number.parseInt(hex.slice(1), 16);
  return (
    0.2126 * canal((n >> 16) & 255) + 0.7152 * canal((n >> 8) & 255) + 0.0722 * canal(n & 255)
  );
}

/** La razón de contraste entre dos colores, de 1 a 21. */
function razon(a: string, b: string): number {
  const [claro, oscuro] = [luminancia(a), luminancia(b)].sort((x, y) => y - x);
  return (claro + 0.05) / (oscuro + 0.05);
}

/* ---------- La paleta, leída del config que usa la página ---------- */

/*
 * Según cómo se corra, el config llega directo o envuelto en `default`: al
 * importar un módulo de CommonJS desde uno de ES, la interoperación agrega esa
 * capa. Se contemplan las dos formas, porque la prueba tiene que correr igual
 * con `tsx`, con el compilador y desde el linter.
 */
/* eslint-disable-next-line @typescript-eslint/no-explicit-any */
const crudo = config as any;
const tema = (crudo.default ?? crudo).theme;
if (!tema?.extend?.colors) {
  throw new Error('No pude leer la paleta de tailwind.config.ts. ¿Cambió la forma del archivo?');
}
const colores = tema.extend.colors;

/** `stone-900` → `#26302A`. Tira si el nombre no existe, que es lo que queremos. */
function color(nombre: string): string {
  if (nombre === 'blanco') return colores.white;
  const [escala, paso] = nombre.split('-');
  const valor = colores[escala]?.[paso];
  if (typeof valor !== 'string') {
    throw new Error(`En tailwind.config.ts no existe el color "${nombre}".`);
  }
  return valor;
}

/* ---------- Los pares que la página usa de verdad ---------- */

/**
 * Cada fila es un uso real. Si se agrega un color a la página, va acá: una
 * combinación que no está en esta tabla es una que nadie midió.
 */
const PARES: { uso: string; texto: string; fondo: string }[] = [
  // Sobre el fondo base (oliva profundo)
  { uso: 'título sobre el fondo base', texto: 'stone-50', fondo: 'stone-900' },
  { uso: 'texto secundario sobre el fondo base', texto: 'stone-300', fondo: 'stone-900' },
  { uso: 'acento del titular sobre el fondo base', texto: 'brand-400', fondo: 'stone-900' },

  // Sobre el fondo alterno, un escalón más hondo
  { uso: 'título sobre el fondo hondo', texto: 'stone-50', fondo: 'stone-950' },
  { uso: 'texto secundario sobre el fondo hondo', texto: 'stone-300', fondo: 'stone-950' },
  { uso: 'acento del titular sobre el fondo hondo', texto: 'brand-400', fondo: 'stone-950' },

  // La única sección clara
  { uso: 'título sobre la sección clara', texto: 'stone-900', fondo: 'stone-50' },
  { uso: 'texto secundario sobre la sección clara', texto: 'stone-600', fondo: 'stone-50' },
  { uso: 'acento sobre la sección clara', texto: 'brand-700', fondo: 'stone-50' },

  // Lo que se lee fuerte sin ser título: las tarjetas, las filas, los rótulos
  // de los precios. Están acá porque se agregaron con la página y nadie los
  // había medido.
  { uso: 'texto de tarjetas y filas sobre el fondo base', texto: 'stone-100', fondo: 'stone-900' },
  { uso: 'texto de tarjetas y filas sobre el fondo hondo', texto: 'stone-100', fondo: 'stone-950' },
  { uso: 'límite de pedidos y distintivo de los planes sobre el fondo base', texto: 'brand-300', fondo: 'stone-900' },
  { uso: 'número de los pasos sobre el fondo hondo', texto: 'brand-300', fondo: 'stone-950' },

  // Las tarjetas blancas de la sección clara (el blanco tibio de la marca)
  { uso: 'texto fuerte en las tarjetas de la sección clara', texto: 'stone-900', fondo: 'blanco' },
  { uso: 'texto suave en las tarjetas de la sección clara', texto: 'stone-600', fondo: 'blanco' },
  { uso: 'rótulo «Con GastroOS» en su tarjeta', texto: 'brand-700', fondo: 'blanco' },

  // Los botones
  { uso: 'botón principal', texto: 'stone-950', fondo: 'brand-400' },
  { uso: 'botón principal al pasar el mouse', texto: 'stone-950', fondo: 'brand-300' },
];

/**
 * Y estos son los que **no** se pueden usar, con el número que los descarta.
 *
 * Están acá porque son las elecciones que el instinto hace solo, y porque si
 * algún día dejan de fallar —alguien aclaró la paleta— quiero enterarme: la
 * prueba también falla si uno de estos pasa, para que nadie revise una
 * prohibición que ya no tiene motivo.
 */
const PROHIBIDOS: { uso: string; texto: string; fondo: string }[] = [
  { uso: 'el terracota de marca como botón, con texto blanco', texto: 'blanco', fondo: 'brand-600' },
  { uso: 'stone-400 como texto secundario sobre el fondo base', texto: 'stone-400', fondo: 'stone-900' },
  { uso: 'brand-500 como texto sobre el fondo base', texto: 'brand-500', fondo: 'stone-900' },
];

/* ---------- La corrida ---------- */

const MINIMO = 4.5;
let fallas = 0;

console.log(`Contraste de la página comercial (mínimo ${MINIMO})\n`);

for (const { uso, texto, fondo } of PARES) {
  const r = razon(color(texto), color(fondo));
  const pasa = r >= MINIMO;
  if (!pasa) fallas += 1;
  console.log(
    `${pasa ? 'OK    ' : 'FALLA '} ${r.toFixed(2).padStart(5)}  ${uso}` +
      `\n              ${texto} ${color(texto)} sobre ${fondo} ${color(fondo)}`
  );
}

console.log('\nLos que no se pueden usar, y por qué:\n');
for (const { uso, texto, fondo } of PROHIBIDOS) {
  const r = razon(color(texto), color(fondo));
  const sigueMal = r < MINIMO;
  if (!sigueMal) fallas += 1;
  console.log(
    `${sigueMal ? 'OK    ' : 'REVISAR'} ${r.toFixed(2).padStart(5)}  ${uso}` +
      (sigueMal ? '' : '  ← ya llega a 4,5: revisá si todavía tiene sentido prohibirlo')
  );
}

console.log(fallas === 0 ? '\nTODO OK' : `\n${fallas} PARES MAL`);
process.exit(fallas === 0 ? 0 : 1);
