/**
 * Guion de la visita guiada del panel.
 *
 * El contenido vive acá y no dentro de los componentes para que se edite como
 * se edita un texto de venta: corrido, en orden, sin tocar React.
 *
 * Cada paso declara cómo se muestra:
 *
 * - `focus`  ilumina un elemento concreto y oscurece el resto. Para "esto es
 *            esto, y está acá".
 * - `page`   no oscurece nada: la pantalla queda entera a la vista y la
 *            tarjeta se apoya en una esquina. Para "mirá esta pantalla".
 * - `center` tarjeta al medio, sin señalar nada. Apertura y cierre.
 *
 * Los `target` son selectores de atributos `data-tour`, no clases: una clase
 * de Tailwind cambia cuando se retoca el diseño y se lleva puesta la guía.
 */

export type TourKind = 'focus' | 'page' | 'center';

export interface TourStep {
  id: string;
  /** Módulo al que pertenece, para ubicar al visitante dentro del recorrido. */
  chapter: string;
  /** Ruta en la que el paso tiene sentido. La guía navega sola si hace falta. */
  route: string;
  kind: TourKind;
  /** Selector del elemento a iluminar. Sólo lo usan los pasos `focus`. */
  target?: string;
  title: string;
  body: string;
  /** Renglón al pie de la tarjeta: dónde mirar, qué probar, cómo seguir. */
  tip?: string;
  /**
   * El elemento vive en el menú lateral, que en mobile está oculto. La guía
   * abre el menú sola en esos pasos.
   */
  needsSidebar?: boolean;
}

export const TOUR_STEPS: TourStep[] = [
  {
    id: 'bienvenida',
    chapter: 'Bienvenida',
    route: '/admin',
    kind: 'center',
    title: 'Te muestro el sistema en dos minutos',
    body: 'Esta es una demo con datos de una pastelería inventada, así que probá todo lo que quieras: cargá un pedido, cambiá un precio, borrá algo. No se rompe nada y no hay datos reales de nadie.',
    tip: 'Podés salir cuando quieras y volver a esta guía desde el botón "Guía", arriba a la derecha.',
  },
  {
    id: 'menu',
    chapter: 'Cómo moverse',
    route: '/admin',
    kind: 'focus',
    target: '[data-tour="nav"]',
    needsSidebar: true,
    title: 'Todo el sistema está en este menú',
    body: 'El orden no es alfabético: es el del día de trabajo. Arriba lo que mirás todas las mañanas (pedidos, calendario, clientes) y abajo lo que tocás de vez en cuando (combos, categorías, configuración).',
    tip: 'Nunca estás a más de un clic de cualquier pantalla.',
  },
  {
    id: 'resumen-hoy',
    chapter: 'Dashboard',
    route: '/admin',
    kind: 'focus',
    target: '[data-tour="today"]',
    title: 'Abrís el sistema y ya sabés cómo viene el día',
    body: 'Cuántos pedidos hay, cuánto entró, cuánto salió y cuántos quedan por entregar. Sin abrir ningún informe ni buscar en ningún lado.',
    tip: 'Las tarjetas con número son botones: tocá "Pedidos pendientes" y te lleva a la lista ya filtrada.',
  },
  {
    id: 'ganancia',
    chapter: 'Dashboard',
    route: '/admin',
    kind: 'focus',
    target: '[data-tour="profit"]',
    title: 'Ganancia, no facturación',
    body: 'Facturar mucho no es ganar. Esta tarjeta es facturación menos gastos registrados, y debajo te muestra las dos cifras por separado para que veas de dónde sale.',
    tip: 'El costo de producción se mide aparte, en Estadísticas, para no contarlo dos veces.',
  },
  {
    id: 'alertas',
    chapter: 'Dashboard',
    route: '/admin',
    kind: 'focus',
    target: '[data-tour="alerts"]',
    title: 'El sistema te avisa antes de que sea un problema',
    body: 'Insumos por debajo del mínimo, señas sin cobrar y pedidos que vencen hoy. Aparecen solos: no hay que acordarse de ir a mirar.',
    tip: 'Cada alerta es un link directo a la pantalla donde se resuelve.',
  },
  {
    id: 'nuevo-pedido',
    chapter: 'Pedidos',
    route: '/admin',
    kind: 'focus',
    target: '[data-tour="new-order"]',
    title: 'Este es el botón que más vas a usar',
    body: 'Está fijo arriba, en todas las pantallas. Buscás el cliente, tocás los productos y listo: el total, la seña y el saldo se calculan solos mientras armás el pedido.',
    tip: 'Si el cliente es nuevo, lo escribís ahí mismo y queda dado de alta. No hay que crearlo antes.',
  },
  {
    id: 'pedidos',
    chapter: 'Pedidos',
    route: '/admin/pedidos',
    kind: 'page',
    title: 'Los pedidos, ordenados por lo que importa',
    body: 'Los próximos arriba, los históricos abajo. Buscás por cliente o por número, y filtrás por estado. Cada fila muestra qué se entrega, cuándo, cuánto se pagó y cuánto falta cobrar.',
    tip: 'Tocá cualquier pedido para abrirlo y ver el detalle completo.',
  },
  {
    id: 'estados',
    chapter: 'Pedidos',
    route: '/admin/pedidos',
    kind: 'page',
    title: 'Los estados hacen trabajar al sistema',
    body: 'Pendiente → confirmado → en preparación → listo → entregado. Cuando un pedido sale de "pendiente", el stock se descuenta solo: primero el producto terminado y, si no alcanza, los insumos de la receta.',
    tip: 'Todo movimiento queda registrado, así que siempre se puede reconstruir qué pasó con un insumo.',
  },
  {
    id: 'calendario',
    chapter: 'Calendario',
    route: '/admin/calendario',
    kind: 'page',
    title: 'La semana entera, de un vistazo',
    body: 'Cada punto es un pedido y el color es su estado. Sirve para ver de golpe si el viernes está cargado antes de aceptar una torta más.',
    tip: 'Tocá un día y al costado aparecen los pedidos de esa fecha, listos para abrir.',
  },
  {
    id: 'clientes',
    chapter: 'Clientes',
    route: '/admin/clientes',
    kind: 'page',
    title: 'La agenda se arma sola',
    body: 'Cada pedido da de alta al cliente si no existía. Con el tiempo tenés el historial completo: qué compró, cuánto gastó, cuál es su ticket promedio y cuándo fue la última vez.',
    tip: 'Las notas por cliente son para lo que no entra en ningún campo: "sin nueces", "toca timbre del fondo".',
  },
  {
    id: 'productos',
    chapter: 'Productos',
    route: '/admin/productos',
    kind: 'page',
    title: 'Precio, costo y margen de cada cosa',
    body: 'Cargás la receta por lote una vez y el sistema calcula cuánto te cuesta cada unidad. El margen deja de ser una corazonada y pasa a ser un número.',
    tip: 'Si cambia el precio de un insumo, el costo de todos los productos que lo usan se actualiza solo.',
  },
  {
    id: 'stock',
    chapter: 'Stock',
    route: '/admin/stock',
    kind: 'page',
    title: 'Te avisa antes de que te falte',
    body: 'Cada insumo tiene un mínimo. Cuando baja de ahí aparece en el dashboard y entra en la lista de compra sugerida, con el costo estimado de reponerlo.',
    tip: 'Acá también ves cuánta plata tenés inmovilizada en insumos.',
  },
  {
    id: 'gastos',
    chapter: 'Gastos',
    route: '/admin/gastos',
    kind: 'page',
    title: 'Sin esto, el margen es mentira',
    body: 'Alquiler, luz, harina, flete, sueldos. Se cargan por categoría, proveedor y método de pago, y son los que hacen que la ganancia del dashboard sea real y no sólo facturación.',
    tip: 'Hay un atajo para registrar un gasto desde cualquier pantalla, arriba a la derecha.',
  },
  {
    id: 'estadisticas',
    chapter: 'Estadísticas',
    route: '/admin/estadisticas',
    kind: 'page',
    title: 'Cómo venís contra el mes pasado',
    body: 'Ventas del período, ticket promedio, qué productos y qué clientes te dejan más, y en qué se te va la plata. Todo comparado contra el período anterior.',
    tip: 'Cambiá el rango de fechas arriba y todos los números se recalculan.',
  },
  {
    id: 'configuracion',
    chapter: 'Configuración',
    route: '/admin/configuracion',
    kind: 'page',
    title: 'El sistema se llama como tu negocio',
    body: 'Nombre, rubro, logo, moneda, zona horaria y datos de contacto. Nada está escrito a fuego en el código: lo que cargues acá es lo que se ve en todo el sistema y en la tienda online.',
    tip: 'En tu instalación esto ya viene cargado: la puesta a punto inicial la hacemos nosotros.',
  },
  {
    id: 'cierre',
    chapter: 'Listo',
    route: '/admin',
    kind: 'center',
    title: 'Eso es todo. Ahora probalo vos',
    body: 'Cargá un pedido de prueba, cambiale el estado y mirá cómo se mueve el stock y el dashboard. Es la mejor forma de ver si te sirve.',
    tip: 'Si te trabás o algo no se entiende, volvé a abrir esta guía desde el botón "Guía" o escribinos: contestamos nosotros, no un bot.',
  },
];

export const TOUR_TOTAL = TOUR_STEPS.length;

/** Clave de `localStorage`. Versionada: si cambia el guion, la guía se ofrece de nuevo. */
export const TOUR_STORAGE_KEY = 'gastroos:guia:v1';
