/**
 * Las capturas que muestra la página comercial.
 *
 * GENERADO por `npm run capturas`. Editarlo a mano no saca ninguna captura:
 * lo que dice acá tiene que ser lo que hay en `public/capturas/`.
 *
 * El ancho y el alto salen de las imágenes, así que son los de verdad. La fecha
 * es la de la corrida y la página la muestra: una captura sin fecha es una
 * afirmación sobre un producto que ya puede haber cambiado. La huella es la de
 * la interfaz en ese momento; `npm run prueba:comercial` la recalcula y falla si
 * alguien tocó una pantalla después.
 */

export const CAPTURAS_SACADAS_EL = '2026-10-20';

export const HUELLA_DE_LA_INTERFAZ = '69d2e5ed631ee807';

export const CAPTURAS = {
  'telefono-inicio': {
    archivo: '/capturas/telefono-inicio.webp',
    ancho: 780,
    alto: 1688,
    que: "El inicio del panel en un celular",
  },
  'panel-inicio': {
    archivo: '/capturas/panel-inicio.webp',
    ancho: 2560,
    alto: 1600,
    que: "El inicio del panel: lo de hoy, lo que falta y las próximas entregas",
  },
  'pedido-nuevo': {
    archivo: '/capturas/pedido-nuevo.webp',
    ancho: 2560,
    alto: 1600,
    que: "El alta de un pedido: el cliente, los productos y el total",
  },
  'estadisticas': {
    archivo: '/capturas/estadisticas.webp',
    ancho: 2560,
    alto: 1600,
    que: "Las estadísticas: facturación, gastos y margen",
  },
  'stock': {
    archivo: '/capturas/stock.webp',
    ancho: 2560,
    alto: 1600,
    que: "El stock de insumos, con los que están por debajo del mínimo",
  },
} as const;
