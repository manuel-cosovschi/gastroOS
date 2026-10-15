/**
 * Los colores de la página comercial, y por qué son estos.
 *
 * La página del producto es oscura; el panel y la tienda siguen siendo claros.
 * No es un capricho de estilo: son dos públicos distintos. El panel lo mira un
 * dueño ocho horas por día y tiene que cansar poco; la página la mira alguien
 * diez segundos desde un WhatsApp y tiene que impactar.
 *
 * Todo sale de la misma paleta de `tailwind.config.ts` —el oliva profundo y la
 * terracota—, así que la página oscura y el sistema claro siguen siendo la misma
 * marca. Lo que cambia es cuál de los dos extremos va al fondo.
 *
 * **Cada par de acá está medido, no elegido a ojo.** Sobre un fondo casi negro
 * cualquier color "se ve", y "se ve" no es una medición: la prueba
 * `src/lib/__tests__/contraste.manual.mts` recalcula todos estos pares con la
 * fórmula de WCAG y falla si alguno baja de 4,5. Dos cosas que encontró y que no
 * se habrían visto mirando:
 *
 * 1. **El terracota de marca no sirve de botón.** `brand-600` (#C0553A) con
 *    texto blanco da **4,49**: falla por un centésimo. Por eso el botón usa
 *    `brand-400` relleno con texto `stone-950` (6,36), que además es el par que
 *    el propio manual de marca pide sobre oliva profundo.
 *
 * 2. **Los dos fondos oscuros no aceptan los mismos textos.** `stone-400`, que
 *    es el gris apagado obvio para texto secundario, da 5,30 sobre el fondo más
 *    profundo pero **4,34 sobre el otro**. Como las secciones alternan entre los
 *    dos, un único token de texto secundario tiene que funcionar en ambos: es
 *    `stone-300`, que da 7,83 y 9,56.
 */

/** Los dos fondos oscuros que se alternan sección por sección. */
export const FONDO = {
  /** El tono base. Oliva profundo: el 900 de la marca. */
  base: 'bg-stone-900',
  /** El alterno, un escalón más hondo. */
  hondo: 'bg-stone-950',
  /**
   * La única sección clara, la que corta el bloque oscuro por el medio.
   * Una sola: dos la vuelven un patrón y deja de cortar nada.
   */
  claro: 'bg-stone-50',
} as const;

/** Texto sobre los fondos oscuros. */
export const TEXTO = {
  /** Títulos y cualquier cosa que haya que leer sí o sí. */
  fuerte: 'text-stone-50',
  /** Lo secundario. `stone-300` y no `stone-400`: ver el punto 2 de arriba. */
  suave: 'text-stone-300',
  /** El acento, para la mitad del titular que va en color. */
  acento: 'text-brand-400',
} as const;

/** Texto sobre la sección clara. Son los mismos que usa el panel. */
export const TEXTO_CLARO = {
  fuerte: 'text-stone-900',
  suave: 'text-stone-600',
  /** Acá el acento baja a `brand-700`: sobre crema, el 400 y el 600 no llegan. */
  acento: 'text-brand-700',
} as const;

/**
 * La tarjeta sobre fondo oscuro.
 *
 * Blanco con muy poca opacidad en vez de un color fijo: así la misma clase sirve
 * sobre los dos fondos y la tarjeta se hunde o se levanta sola según cuál tenga
 * detrás.
 */
export const TARJETA = 'rounded-xl bg-white/[0.045] border border-white/[0.09]';

/**
 * El botón principal.
 *
 * Relleno claro sobre fondo oscuro, al revés de lo que pide el instinto. Es lo
 * que mide: el terracota de marca como relleno con texto blanco no llega a 4,5.
 */
export const BOTON = {
  principal: 'bg-brand-400 text-stone-950 hover:bg-brand-300',
  secundario: 'border border-white/20 text-stone-50 hover:bg-white/[0.06]',
} as const;

/**
 * El rótulo chiquito que va arriba de cada título, para el que scrollea rápido.
 * Versales y muy espaciado; el valor exacto importa poco, la separación sí.
 */
export const ROTULO = 'text-[11px] font-semibold uppercase tracking-[0.28em]';

/**
 * El título de sección: itálica, versales, peso 900 y espaciado muy cerrado.
 * Es el 80 % del carácter de la página y no cuesta nada.
 */
export const TITULO = 'font-display italic font-black uppercase tracking-[-0.03em]';
