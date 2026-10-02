import {
  BarChart3,
  CalendarDays,
  ClipboardList,
  Package,
  Receipt,
  Store,
  Users,
  Warehouse,
} from 'lucide-react';

/**
 * Contenido de la home comercial.
 *
 * Todo el texto de venta vive acá para que se edite sin tocar componentes.
 * Los datos de contacto salen de variables de entorno: cambiarlos en Vercel
 * no requiere un deploy de código.
 */

// ============================================
// Contacto
// ============================================

/**
 * Link de reserva: la página de citas de Google Calendar
 * (https://calendar.app.google/…). Sin esto el botón no se muestra.
 */
export const BOOKING_URL = process.env.NEXT_PUBLIC_BOOKING_URL || '';

/**
 * Franja en la que se toman reuniones. El tope real lo pone la página de
 * citas de Google Calendar; esto lo dice antes de que el visitante haga clic,
 * para que no descubra recién ahí que no hay horarios a la tarde.
 */
export const BOOKING_NOTE = 'Coordinamos reuniones hasta las 16 h.';

/** Teléfono en formato internacional sin + ni espacios, p. ej. 5491155550134. */
export const WHATSAPP_NUMBER = (process.env.NEXT_PUBLIC_WHATSAPP || '').replace(/\D/g, '');

export const CONTACT_EMAIL = process.env.NEXT_PUBLIC_CONTACT_EMAIL || '';

/** A dónde lleva "Probar el sistema". Por defecto, el login del usuario de prueba. */
export const DEMO_URL = process.env.NEXT_PUBLIC_DEMO_URL || '/login';

/**
 * Panel interno de SOVARE. Sin esto, el crédito del pie es sólo una firma.
 * Va en variable de entorno porque este repositorio es la plantilla que se
 * forkea por cliente y esa URL no tiene por qué viajar en su instalación.
 */
export const SOVARE_PANEL_URL = process.env.NEXT_PUBLIC_SOVARE_PANEL_URL || '';

const WHATSAPP_MESSAGE = encodeURIComponent(
  'Hola, vi GastroOS y me gustaría saber más.'
);

export const WHATSAPP_URL = WHATSAPP_NUMBER
  ? `https://wa.me/${WHATSAPP_NUMBER}?text=${WHATSAPP_MESSAGE}`
  : '';

/** El mismo link con otro mensaje, para los que llegan desde otra pantalla. */
export function whatsappUrl(message: string): string {
  if (!WHATSAPP_NUMBER) return '';
  return `https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(message)}`;
}

/**
 * La URL absoluta del sitio. Hace falta en los mails, donde un link relativo no
 * lleva a ningún lado. En Vercel sale de la variable del deploy de producción,
 * así que en el caso normal no hay que cargar nada.
 */
export const SITE_URL = (() => {
  const explicit = process.env.NEXT_PUBLIC_SITE_URL?.trim().replace(/\/$/, '');
  if (explicit) return explicit;

  const vercel =
    process.env.VERCEL_PROJECT_PRODUCTION_URL?.trim() || process.env.VERCEL_URL?.trim();
  return vercel ? `https://${vercel.replace(/\/$/, '')}` : '';
})();

export const EMAIL_URL = CONTACT_EMAIL
  ? `mailto:${CONTACT_EMAIL}?subject=${encodeURIComponent('Consulta sobre GastroOS')}`
  : '';

/** Hay al menos una vía de contacto configurada. */
export const HAS_CONTACT = Boolean(BOOKING_URL || WHATSAPP_URL || EMAIL_URL);

// ============================================
// Hero
// ============================================

export const HERO = {
  eyebrow: 'Software de gestión para negocios gastronómicos',
  title: 'El sistema operativo de tu negocio gastronómico',
  subtitle:
    'Pedidos, clientes, stock y rentabilidad en una sola pantalla. Pensado para pastelerías, panaderías, catering, viandas y todo negocio que trabaja por encargo.',
  bullets: [
    'Cargás un pedido en menos de un minuto',
    'Sabés qué entregás hoy y qué te falta comprar',
    'Ves cuánto entra, cuánto sale y cuánto queda',
  ],
};

/** Rubros a los que apunta el producto. */
export const INDUSTRIES = [
  'Pastelerías',
  'Panaderías',
  'Tortas por encargo',
  'Catering',
  'Viandas',
  'Repostería',
  'Dark kitchens',
  'Comida por encargo',
];

// ============================================
// Problema
// ============================================

export const PROBLEMS = [
  {
    title: 'Los pedidos viven en cuatro lugares',
    body: 'WhatsApp, Instagram, un cuaderno y la memoria. Algo siempre se pierde, y cuando se pierde, se pierde un cliente.',
  },
  {
    title: 'El Excel se abandona a las dos semanas',
    body: 'Cargar todo a mano no se sostiene. A fin de mes nadie sabe con certeza cuánto se vendió ni cuánto costó producirlo.',
  },
  {
    title: 'No sabés si estás ganando plata',
    body: 'Facturar mucho no es ganar. Sin costos por producto ni gastos registrados, el margen es una corazonada.',
  },
];

// ============================================
// Módulos
// ============================================

export const MODULES = [
  {
    icon: ClipboardList,
    title: 'Pedidos',
    body: 'Alta en menos de un minuto, estados, seña y saldo, búsqueda y filtros. Próximos e históricos separados.',
  },
  {
    icon: CalendarDays,
    title: 'Calendario',
    body: 'Qué entregás cada día, de un vistazo. Tocás un pedido y lo abrís.',
  },
  {
    icon: Users,
    title: 'Clientes',
    body: 'Historial, total gastado, ticket promedio y notas. Cada pedido da de alta al cliente solo.',
  },
  {
    icon: Package,
    title: 'Productos',
    body: 'Precio, costo y margen calculado. Receta por lote para saber cuánto te cuesta de verdad.',
  },
  {
    icon: Warehouse,
    title: 'Stock',
    body: 'Insumos con mínimos, aviso de faltantes y lista de compra sugerida. Se descuenta solo al confirmar.',
  },
  {
    icon: Receipt,
    title: 'Gastos',
    body: 'Por categoría, proveedor y método de pago. Es lo que hace que el margen sea real.',
  },
  {
    icon: BarChart3,
    title: 'Estadísticas',
    body: 'Ventas, ticket promedio, mejores clientes y productos, comparado contra el período anterior.',
  },
  {
    icon: Store,
    title: 'Tienda online',
    body: 'Catálogo público opcional. Tu cliente arma el pedido y entra directo al panel.',
  },
];

// ============================================
// Recorrido del producto (capturas reales)
// ============================================

export interface Showcase {
  eyebrow: string;
  title: string;
  body: string;
  image: string;
  alt: string;
  points: string[];
}

export const SHOWCASE: Showcase[] = [
  {
    eyebrow: 'Dashboard',
    title: 'Abrís y ya sabés cómo viene el día',
    body: 'Lo que entra, lo que sale, lo que hay que entregar y lo que está por faltar. Sin buscar en ningún lado.',
    image: '/producto/dashboard.webp',
    alt: 'Dashboard de GastroOS con el resumen del día, alertas y próximas entregas',
    points: [
      'Facturación, gastos y ganancia del día',
      'Próximas entregas ordenadas por hora',
      'Alertas de stock y de señas sin cobrar',
    ],
  },
  {
    eyebrow: 'Pedidos',
    title: 'Un pedido nuevo en menos de un minuto',
    body: 'Buscás el cliente, tocás los productos y listo. El total y el saldo se actualizan mientras armás.',
    image: '/producto/pedido-nuevo.webp',
    alt: 'Pantalla de alta de pedido con buscador de clientes y catálogo',
    points: [
      'El cliente queda asociado automáticamente',
      'Seña y saldo calculados solos',
      'Fecha, hora y forma de entrega',
    ],
  },
  {
    eyebrow: 'Calendario',
    title: 'La semana entera, día por día',
    body: 'Cada punto es un pedido, con el color de su estado. Elegís un día y ves qué sale.',
    image: '/producto/calendario.webp',
    alt: 'Vista de calendario mensual con los pedidos de cada día',
    points: ['Vista mensual de entregas', 'Detalle del día al costado', 'Abrís el pedido de un toque'],
  },
  {
    eyebrow: 'Rentabilidad',
    title: 'Cuánto ganás, no sólo cuánto vendés',
    body: 'Facturación contra gastos reales, con el costo de producción medido aparte para no contarlo dos veces.',
    image: '/producto/estadisticas.webp',
    alt: 'Estadísticas con facturación, gastos, margen y ranking de productos',
    points: [
      'Comparación contra el período anterior',
      'Productos y clientes que más aportan',
      'Gastos por categoría',
    ],
  },
  {
    eyebrow: 'Stock',
    title: 'Te avisa antes de que te falte',
    body: 'Cada insumo con su mínimo. Cuando baja, aparece en el dashboard y en la lista de compra.',
    image: '/producto/stock.webp',
    alt: 'Pantalla de stock con insumos, mínimos y lista de compra sugerida',
    points: ['Se descuenta al confirmar el pedido', 'Lista de compra con costo estimado', 'Valorización del inventario'],
  },
];

// ============================================
// Caso de éxito
// ============================================

/**
 * El caso de COSOV.
 *
 * Las capturas de la tienda son de su sistema real, que es público. Las del
 * panel no: son GastroOS con su paleta y sus tipografías sobre los datos de la
 * demo. El panel de un cliente muestra sus clientes, sus pedidos y su
 * facturación, y eso no va en una página de venta.
 */
export const CASE_STUDY = {
  eyebrow: 'COSOV.',
  client: 'COSOV.',
  title: 'Caso real: el mismo sistema, con la cara de su negocio',
  lead: 'COSOV. es una pastelería artesanal que produce por encargo para cafeterías y eventos. Los pedidos entraban por WhatsApp e Instagram y se anotaban a mano; el costo real de cada producto era una estimación.',
  /**
   * Acá decía además "su dominio".
   *
   * No es cierto todavía: COSOV. está en el subdominio que le dio Vercel. Pasaba
   * desapercibido mientras la tienda era sólo una captura, pero más abajo el plan
   * Negocio vende "tu dominio propio, no un subdominio nuestro", y ahora el caso
   * tiene un link: el visitante que lo sigue ve la dirección real. Una frase que
   * se desarma en el clic siguiente hace más daño que la que nunca se dijo.
   */
  outcome:
    'Hoy trabaja sobre su propia instalación de GastroOS: su paleta, sus tipografías y su base de datos. No comparte el sistema con nadie y no parece software alquilado. Parece de ellos, porque lo es.',
  facts: [
    { label: 'Rubro', value: 'Pastelería artesanal por encargo' },
    { label: 'Trabaja con', value: 'Cafeterías y eventos' },
    { label: 'Qué se personalizó', value: 'Identidad, tienda y flujo de pedidos' },
  ],
  /**
   * Una sola imagen, y real.
   *
   * Acá había además una comparación "la misma pantalla, dos identidades" con
   * una captura del panel rotulada "Con la identidad de COSOV.". Esa captura no
   * era de COSOV.: era el panel de la demo de GastroOS recoloreado, y seguía
   * diciendo "GastroOS" en el logo y "estás viendo una demo" en el cartel.
   * Prometía exactamente lo que no mostraba.
   *
   * Se sacó en vez de rehacerla. El panel de un cliente no se puede mostrar
   * (tiene sus clientes, sus pedidos y su facturación) y fabricar una imitación
   * para ilustrarlo es presentar algo armado como si fuera la instalación de
   * alguien. La tienda, en cambio, es pública: se puede entrar y verla. Una
   * captura que el visitante puede ir a verificar vale más que dos que no.
   */
  storefront: {
    title: 'Su tienda, con su marca',
    body: 'Esto no es un tema elegido de una lista de cuatro: es la identidad de COSOV. llevada al sistema. Sus clientes arman el pedido desde un catálogo que es de ellos, no de un proveedor de software, y el pedido cae directo en el panel.',
    image: '/casos/cosov-tienda.webp',
    alt: 'Catálogo público de COSOV. con sus productos, en bordó y crema',
    caption: 'Tienda pública de COSOV., en producción',
    /**
     * La tienda de COSOV., en vivo.
     *
     * El comentario de arriba dice que una captura verificable vale más que dos
     * que no, y ese era el argumento para dejar sólo ésta. El link es la otra
     * mitad: sin él la verificación queda enunciada y no ofrecida.
     *
     * Es un negocio de verdad y los pedidos que entran son de verdad, así que el
     * texto dice de quién es la tienda antes de que la abran. Lo que se toca sin
     * consecuencias es la demo, que es lo que ofrece el botón de arriba.
     *
     * Sale de una variable porque la dirección va a cambiar el día que COSOV.
     * tenga dominio propio.
     */
    url:
      process.env.NEXT_PUBLIC_CASE_STUDY_STOREFRONT_URL ||
      'https://cosov-pedidos.vercel.app/catalogo',
    cta: 'Abrir la tienda de COSOV.',
  },
  /**
   * Sus redes, para que se vea que es un negocio de verdad y no un ejemplo armado.
   *
   * Sólo está la que se pudo comprobar: el Instagram existe, es público y es el
   * mismo que COSOV. imprime en sus comprobantes. No se agregan redes "por si
   * acaso": un link a un perfil que no existe es peor que no tener link.
   *
   * No se muestran seguidores ni publicaciones: son números que cambian y quedarían
   * viejos en el código.
   */
  social: {
    note: 'Es un negocio real, con tienda y redes públicas. Entrá y mirá cómo trabaja.',
    links: [
      {
        network: 'Instagram',
        handle: '@cosov_',
        url: process.env.NEXT_PUBLIC_CASE_STUDY_INSTAGRAM_URL || 'https://www.instagram.com/cosov_/',
      },
    ],
  },
};

// ============================================
// Cómo funciona
// ============================================

export const STEPS = [
  {
    title: 'Reservás una reunión de 20 minutos',
    body: 'Nos contás cómo trabajás hoy: qué vendés, cómo entran los pedidos, qué te duele. Sin compromiso.',
  },
  {
    title: 'Lo dejamos listo para usar',
    body: 'Del plan Negocio para arriba cargamos tu catálogo, tus precios, tus insumos y tus clientes, y arrancás con el sistema lleno. En el Taller lo cargás vos con una guía, y arrancás el mismo día.',
  },
  {
    title: 'Te enseñamos a usarlo',
    body: 'Una sesión de capacitación con tu equipo, incluida en la puesta a punto. En una hora están cargando pedidos solos.',
  },
  {
    title: 'Te acompañamos',
    body: 'Soporte por WhatsApp y ajustes sobre la marcha, del plan Negocio para arriba. En el Taller la ayuda se cobra por hora y sabés cuánto antes de pedirla.',
  },
];

// ============================================
// Diferenciales
// ============================================

export const REASONS = [
  {
    title: 'Hecho para negocios por encargo',
    body: 'No es un punto de venta adaptado. Está pensado para quien produce contra pedido, con fecha de entrega y seña.',
  },
  {
    title: 'Lleva tu marca, no la nuestra',
    body: 'Del plan Negocio para arriba: tu paleta, tus tipografías y tu dominio, que registrás a tu nombre. Tus clientes ven tu negocio, no el logo de un proveedor de software. En el Taller va tu nombre y tu logo sobre el diseño de GastroOS.',
  },
  {
    title: 'Arrancás con tus datos adentro',
    body: 'Del plan Negocio para arriba la carga inicial la hacemos nosotros: no te dejamos un sistema vacío para que lo llenes en tus ratos libres. En el Taller la hacés vos con una guía, y por eso ese plan no tiene puesta a punto.',
  },
  {
    title: 'Simple de verdad',
    body: 'Si tu equipo necesita un manual, algo hicimos mal. Todo lo importante está a un clic del inicio.',
  },
  {
    title: 'Funciona desde el teléfono',
    body: 'Cargar un pedido, cambiar un estado o ver las entregas del día se hace igual de bien desde el celular.',
  },
  {
    title: 'Tu negocio, no una cuenta genérica',
    body: 'Tus datos son tuyos y nadie más los ve: el aislamiento lo aplica la base de datos en cada consulta, no el código de la pantalla. Y el sistema lleva tu marca, no la nuestra.',
  },
];

// ============================================
// Contra qué competimos de verdad
// ============================================

/**
 * El competidor real no es otro software: es el cuaderno, el Excel y la
 * memoria. Nombrarlos es más honesto que comparar features contra un rival
 * que el visitante no está evaluando.
 */
export const COMPARISON = {
  eyebrow: 'Comparación',
  title: 'Contra qué lo estás comparando',
  subtitle:
    'La mayoría no viene de otro sistema: viene del cuaderno, del Excel y de acordarse. Así queda cada uno.',
  columns: ['El cuaderno y WhatsApp', 'Una planilla de Excel', 'GastroOS'],
  rows: [
    {
      criterion: 'Cargar un pedido',
      values: ['Rápido, pero se pierde', 'Lento, y hay que acordarse', 'Menos de un minuto, y queda'],
    },
    {
      criterion: 'Saber qué entregás hoy',
      values: ['Revisando conversaciones', 'Si filtraste bien', 'La pantalla abre con eso'],
    },
    {
      criterion: 'Stock de insumos',
      values: ['Cuando te falta, te enteraste tarde', 'Otra planilla más', 'Se descuenta solo y avisa antes'],
    },
    {
      criterion: 'Costo real de un producto',
      values: ['A ojo', 'Si mantenés las fórmulas', 'Sale de la receta, se actualiza solo'],
    },
    {
      criterion: 'Cuánto ganaste este mes',
      values: ['Una sensación', 'Facturación, no ganancia', 'Facturación menos gastos, con el margen'],
    },
    {
      criterion: 'Si se rompe el teléfono',
      values: ['Perdiste todo', 'Si lo tenías en la nube', 'Está en la base, no en el aparato'],
    },
    {
      criterion: 'Cuando entra alguien nuevo al equipo',
      values: ['Le explicás tu sistema', 'Le explicás tu planilla', 'Abre y entiende'],
    },
  ],
  note: 'Si tu Excel funciona y lo mantenés al día, no te hace falta cambiar. Este sistema es para cuando dejó de alcanzar.',
};

// ============================================
// Un día antes y después
// ============================================

export const BEFORE_AFTER = {
  eyebrow: 'Un día cualquiera',
  title: 'Lo que cambia no son las funciones, es el día',
  before: {
    label: 'Hoy',
    items: [
      'Abrís WhatsApp y revisás qué quedó sin contestar de anoche',
      'Anotás tres pedidos en el cuaderno y uno se te pasa',
      'Buscás el precio de una torta en una conversación de hace dos meses',
      'Vas a comprar y te olvidás del chocolate, otra vez',
      'A la noche sumás con la calculadora para saber cómo te fue',
      'A fin de mes no sabés si ganaste o sólo facturaste',
    ],
  },
  after: {
    label: 'Con GastroOS',
    items: [
      'Abrís el panel y ves lo que entregás hoy, ordenado por hora',
      'Cargás el pedido mientras hablás con el cliente, en un minuto',
      'El precio y el cliente ya están: los tomás del catálogo',
      'La lista de compra la arma el sistema con lo que está bajo el mínimo',
      'La facturación del día está calculada antes de que cierres',
      'A fin de mes ves la ganancia, el margen y contra qué comparar',
    ],
  },
};

// ============================================
// Calculadora
// ============================================

/**
 * Los tres números que devuelve la calculadora.
 *
 * Dos son aritmética pura y el tercero es un condicional explícito: nada de
 * prometer un retorno inventado. Los supuestos van escritos en la pantalla,
 * no escondidos en una nota al pie.
 */
export const CALCULATOR = {
  eyebrow: 'Calculadora',
  title: '¿Cuánto te está costando no tener el número?',
  subtitle:
    'Dos datos que ya sabés de memoria, y te devuelve tres que probablemente no tengas a mano.',
  fields: {
    orders: { label: 'Pedidos por mes', min: 5, max: 400, step: 5, initial: 60 },
    ticket: { label: 'Ticket promedio', min: 2000, max: 150000, step: 1000, initial: 25000 },
  },
  /** Minutos que se ahorran por pedido al cargarlo en el sistema en vez de a mano. */
  minutesSavedPerOrder: 5,
  /** Desvío de margen que se usa para el tercer número. */
  marginErrorPct: 5,
  results: {
    revenue: {
      label: 'Facturás por año',
      note: 'Pedidos por mes × ticket promedio × 12.',
    },
    hours: {
      label: 'Horas al mes en administración',
      note: 'Estimado sobre 5 minutos de ahorro por pedido: anotarlo, buscar el precio, confirmarlo y acordarse de la entrega.',
    },
    margin: {
      label: 'Si tu margen real es 5 puntos menor',
      note: 'No decimos que lo sea. Decimos que sin el costo por receta cargado no hay forma de saberlo, y que 5 puntos sobre tu facturación son esta plata.',
    },
  },
  cta: 'Estos números salen de dos datos. El sistema los calcula con los tuyos, todos los días.',
};

// ============================================
// Qué no hace
// ============================================

export const NOT_INCLUDED = {
  eyebrow: 'Honestidad',
  title: 'Qué no hace',
  subtitle:
    'Preferimos que lo sepas ahora y no en la tercera reunión. Nada de esto está, y si lo necesitás hoy, no somos para vos.',
  items: [
    { title: 'No cobra online', body: 'No procesa pagos ni se integra con Mercado Pago. Registrás lo que cobraste, no lo cobrás desde acá.' },
    { title: 'No factura', body: 'No emite comprobantes AFIP/ARCA. Tu facturación electrónica sigue donde está.' },
    { title: 'No manda WhatsApp solo', body: 'No automatiza WhatsApp: los mensajes los mandás vos. Mail sí manda, cuando el pedido se confirma, queda listo o se entrega.' },
    { title: 'No gestiona delivery', body: 'No se conecta con PedidosYa, Rappi ni apps de reparto.' },
    { title: 'No es un punto de venta', body: 'No está pensado para cobrar en mostrador con caja y ticket. Está pensado para producir contra pedido.' },
    { title: 'No tiene IA', body: 'No predice tu demanda ni te sugiere precios. Te muestra tus números y las decisiones las tomás vos.' },
  ],
};

// ============================================
// Precios
// ============================================

/**
 * Planes.
 *
 * Se cobra por pedidos al mes y no por funciones. El motivo no es comercial: es
 * que todos los planes corren el mismo sistema, así que recortarle módulos al
 * plan chico sería inventar una limitación para poder venderla.
 *
 * El piso de $15.000 se pudo bajar porque desapareció el costo que lo sostenía.
 * Con el modelo viejo, cada cliente tenía su propio proyecto de Supabase: unos
 * USD 10 de compute por mes, que con el dólar a ~$1.550 son $17.000 por cliente
 * antes de que nadie toque nada. Ese número obligaba a un plan de entrada de
 * $26.900 y dejaba afuera a todo el segmento que más lo necesita, el que cocina
 * desde su casa.
 *
 * Hoy el sistema es multi-inquilino: cada tabla tiene `business_id`, las
 * políticas aíslan por `is_business_member()`, y sumar un negocio chico cuesta
 * unos megabytes de filas. El plan Taller no es una promoción a pérdida, es lo
 * que de verdad cuesta.
 *
 * Los números se comparan contra la competencia relevada en septiembre de 2026:
 * los sistemas de gestión gastronómica en Argentina arrancan cerca de $21.000 +
 * IVA, y los que traen tienda online y control de stock van de $68.000 a
 * $99.000 + IVA, con los módulos de mesa, cocina y facturación cobrados aparte a
 * $23.000 a $24.500 cada uno.
 *
 * Son pesos y hay inflación: `asOf` está para que se note cuándo se fijaron.
 */
export const PRICING = {
  enabled: true,
  eyebrow: 'Precios',
  title: 'Cuánto cuesta',
  subtitle:
    'Se paga por los pedidos que entran, no por una lista de funciones. Todos los planes traen el sistema entero. Sin porcentaje sobre tus ventas: lo que vendas es tuyo.',
  asOf: 'Precios de octubre de 2026, en pesos y con IVA incluido.',
  /** El ancla: contra qué se compara el número de abajo. */
  context:
    'Los sistemas de gestión gastronómica con tienda online y control de stock cobran entre $68.000 y $99.000 por mes más IVA, y te cobran aparte cada módulo. Arrancamos en la quinta parte del plan más chico de ellos.',

  /** El medidor, explicado antes de mostrar los números. */
  meter: {
    title: 'Por qué se cobra por pedidos',
    body: 'Porque es lo único que mide a la vez cuánto trabajo te saca el sistema y qué tamaño tiene tu negocio. El que hace veinte tortas por mes y la cocina que entrega cuatrocientas viandas por semana no pueden pagar lo mismo, y tampoco les sirve lo mismo. Si un mes te pasás del escalón no se corta nada: el mes siguiente pasás al que te toca, y si bajás, bajás.',
  },

  /**
   * La puesta a punto.
   *
   * Acá había un `price` único de $95.000 y la sección lo mostraba en una caja
   * aparte. Era el número equivocado de dos maneras: el monto vive en
   * `sovare.plans` y es distinto por plan, y la caja leía el del primer plan de
   * la lista, que desde que Taller encabeza vale cero. La página terminó
   * anunciando "puesta a punto: $0" mientras la contratación cobraba $95.000.
   *
   * Por eso ya no hay un número acá. Cada plan muestra el suyo, que es lo único
   * que el visitante puede comparar sin que le mientan.
   */
  setup: {
    name: 'Puesta a punto',
    summary:
      'Se paga una sola vez, al principio, y no la lleva el plan Taller. Es el trabajo de dejarte el sistema andando con tu negocio adentro, no una licencia. Cuesta distinto en cada plan porque el trabajo es distinto: con ciento veinte pedidos por mes hay menos catálogo y menos recetas que cargar que en una cocina que entrega cuatrocientos.',
    features: [
      'Tu instalación con tu paleta y tus tipografías',
      'Carga de catálogo, precios, insumos y clientes',
      'Recetas y costo real de cada producto',
      'Tu tienda online publicada en tu dominio, que comprás vos aparte',
      'Una sesión de capacitación con tu equipo',
    ],
  },

  plans: [
    {
      code: 'taller',
      name: 'Taller',
      price: 15000,
      setup: 0,
      unit: 'por mes',
      limit: 'hasta 30 pedidos por mes',
      summary:
        'Para el que cocina solo. Sin puesta a punto: cargás vos tu catálogo con una guía que te damos, y por eso no hay nada que cobrarte al principio.',
      features: [
        'El sistema entero, sin funciones recortadas',
        'Con tu nombre y tu logo, sobre el diseño de GastroOS',
        'Tu tienda online en tunegocio.gastroos.shop',
        'Pedidos, calendario, stock por receta y costos',
        'Sin puesta a punto y sin permanencia',
        'Soporte por hora, cuando lo necesites',
      ],
      highlight: false,
    },
    {
      code: 'negocio',
      name: 'Negocio',
      price: 32000,
      /**
       * Más barata que en los planes de arriba, y a propósito.
       *
       * A $95.000 el primer pago del plano que más se vende era de $127.000: casi
       * cuatro meses de cuota juntos, en el momento en que todavía no vio el
       * sistema andar con sus cosas adentro. Es la cifra que frena a un negocio
       * chico, no la mensualidad.
       *
       * No es un descuento: con ciento veinte pedidos por mes el catálogo es más
       * corto y las recetas son menos, así que el trabajo entra en menos horas.
       * Los planes de arriba, donde el catálogo es grande de verdad, la siguen
       * pagando entera.
       */
      setup: 55000,
      unit: 'por mes',
      limit: 'hasta 120 pedidos por mes',
      summary:
        'Cuando ya hay alguien más en la cocina. Es el que toma casi todo el mundo.',
      features: [
        'Todo lo del plan Taller',
        'Tu paleta y tus tipografías, no las nuestras',
        'Tu dominio propio, no un subdominio nuestro (el dominio lo comprás vos)',
        // "Incluida" se leía como "no se paga", y arriba de esta misma tarjeta
        // dice que son $55.000. Lo que el plan trae no es gratis: es que el
        // trabajo lo hacemos nosotros en lugar de que lo haga él.
        'La puesta a punto la hacemos nosotros: te lo dejamos cargado',
        'Soporte por WhatsApp, respuesta en el día hábil',
        'Ajustes y cambios chicos incluidos',
      ],
      highlight: true,
    },
    {
      code: 'cocina',
      name: 'Cocina grande',
      price: 56000,
      setup: 95000,
      unit: 'por mes',
      limit: 'hasta 400 pedidos por mes',
      summary:
        'Volumen de verdad: viandas semanales, catering con varios eventos por fin de semana.',
      features: [
        'Todo lo del plan Negocio',
        'Prioridad en los pedidos de cambio',
        'Usuarios para todo tu equipo',
        'Revisión de costos y márgenes cada tres meses',
        'Las mejoras del producto apenas salen',
      ],
      highlight: false,
    },
    {
      code: 'medida',
      name: 'A medida',
      price: 89000,
      setup: 95000,
      unit: 'por mes',
      priceFrom: true,
      limit: 'más de 400 pedidos, o varias sucursales',
      summary:
        'Cuando el sistema tiene que hacer algo que hoy no hace, o el negocio ya no entra en una sola cocina.',
      features: [
        'Todo lo del plan Cocina grande',
        'Desarrollo de funciones propias',
        'Integraciones con lo que ya uses',
        'Varias sucursales o equipos',
        'Tu propia instalación aparte, si la querés',
      ],
      highlight: false,
    },
  ],

  hourly: {
    label: 'Hora de soporte o cambios, para el plan Taller',
    price: 19000,
  },

  /**
   * Lo que no entra en ningún plan.
   *
   * Está escrito y a la vista a propósito. El dominio es el caso típico de
   * costo que el cliente descubre después y siente como una letra chica, aunque
   * nadie se lo haya ocultado: alcanza con no mencionarlo.
   *
   * Y no es que no lo queramos incluir: un dominio se registra a nombre del
   * titular, y si lo compramos nosotros queda a nombre nuestro. Eso es
   * exactamente lo que no queremos, porque el día que alguien se vaya tiene que
   * poder llevárselo.
   *
   * El arancel no se escribe acá a propósito: lo fija NIC Argentina, cambia con
   * la inflación, y un número viejo en esta página es peor que ninguno.
   */
  notIncluded: {
    title: 'Qué no está incluido',
    items: [
      {
        name: 'El dominio',
        body: 'No entra en ningún plan. Se registra a tu nombre en NIC Argentina y se renueva una vez por año, y el arancel lo pagás vos directamente a ellos. Te decimos cuál te conviene y lo configuramos nosotros, pero la titularidad es tuya: si un día te vas, el dominio se va con vos.',
      },
      {
        name: 'El diseño con tu marca, en el plan Taller',
        body: 'La paleta y las tipografías propias son parte de la puesta a punto, así que van del plan Negocio para arriba. El Taller corre sobre el diseño de GastroOS, con tu nombre y tu logo arriba. Es la diferencia visible entre los dos, y es a propósito: es trabajo nuestro, y en el Taller no lo hacemos.',
      },
    ],
  },

  /** Cierre de la sección. Sin permanencia es lo único que prometemos acá. */
  closing: {
    title: 'Sin contrato de permanencia',
    body: 'Se paga mes a mes. Si un mes decidís que no va más, avisás y listo. Te llevás tu información exportada, que es tuya.',
  },
};

// ============================================
// Preguntas frecuentes
// ============================================

export const FAQS = [
  {
    q: '¿Sirve si vendo por WhatsApp e Instagram?',
    a: 'Sí, es el caso más común. Vos seguís recibiendo el pedido por donde ya lo recibís y lo cargás en GastroOS en menos de un minuto. La tienda online viene en todos los planes y ya arranca publicada, así que el que quiera se carga el pedido solo y te entra al panel igual que los demás. Si no la querés, la apagás desde Configuración y listo: es una decisión tuya, no algo que se paga aparte.',
  },
  {
    q: '¿Puedo ponerle los colores y la tipografía de mi marca?',
    a: 'Del plan Negocio para arriba sí, y no de una lista de temas: tu instalación se arma con tu paleta y tus tipografías, igual que el caso de COSOV. que está más arriba. Si tenés manual de marca lo seguimos; si no, lo sacamos de tu logo y tus redes. Va incluido en la puesta a punto y no es un extra, pero es trabajo nuestro: por eso el Taller, que no la lleva, corre sobre el diseño de GastroOS con tu nombre y tu logo. Si arrancaste ahí y después la querés, se pasa de plan y se hace.',
  },
  {
    q: '¿Tengo que cargar todo de cero?',
    a: 'Depende del plan. Del Negocio para arriba la carga inicial de productos, precios, insumos y clientes la hacemos nosotros con lo que nos pases, aunque esté en un Excel o en fotos. En el Taller la cargás vos con una guía: por eso ese plan no tiene puesta a punto, y por eso es el más barato.',
  },
  {
    q: '¿Por qué el plan Taller no incluye soporte ni puesta a punto?',
    a: 'Porque queríamos un precio de entrada real y no uno que se cae cuando pedís algo. A $15.000 no entra que alguien te cargue el catálogo ni que te conteste el WhatsApp, y meterlo igual sería mentirte. Lo que sí entra es el sistema entero funcionando, sin funciones recortadas. Si necesitás una mano se cobra por hora y sabés cuánto; si preferís no pensar en eso, el plan Negocio ya lo trae.',
  },
  {
    q: '¿Estoy obligado a tener la tienda online?',
    a: 'No. Viene incluida en todos los planes y arranca publicada, pero es un interruptor en Configuración: la apagás cuando quieras y el sistema sigue funcionando igual, cargando vos los pedidos a mano. No cambia lo que pagás. Hay negocios que la apagan porque laburan sólo con clientes de siempre, y otros que la dejan prendida nada más que para dejar de contestar el precio uno por uno.',
  },
  {
    q: '¿El dominio está incluido en el precio?',
    a: 'No, y conviene que no lo esté. Un dominio se registra a nombre de su titular: si lo compráramos nosotros quedaría a nombre nuestro, y el día que quieras irte no te lo podrías llevar. Lo registrás vos en NIC Argentina, lo renovás una vez por año y le pagás el arancel directamente a ellos. Nosotros te decimos cuál te conviene y lo dejamos configurado y andando, sin cobrarte por eso. Si todavía no querés comprar uno, arrancás con un subdominio nuestro y lo cambiás cuando quieras.',
  },
  {
    q: '¿Por qué son más baratos que los demás?',
    a: 'Por dos cosas. Una, no somos un punto de venta: no tenemos que mantener módulos de mesas, comandas ni impresoras fiscales, que es de donde sale buena parte del precio de los otros. Y dos, no cobramos cada función aparte: lo que ves es lo que hay, sin módulos que se suman de a $24.000.',
  },
  {
    q: '¿Cuánto tarda en estar funcionando?',
    a: 'En el plan Taller, el mismo día: entrás y cargás tu catálogo. Del Negocio para arriba lo cargamos nosotros, y depende del tamaño del catálogo, pero en general es una semana desde que nos pasás la información.',
  },
  {
    q: '¿Necesito instalar algo?',
    a: 'No. Funciona en el navegador, en la computadora y en el celular. No hay nada que instalar ni actualizar.',
  },
  {
    q: '¿Qué pasa con mis datos si dejo de usarlo?',
    a: 'Te los llevás. Exportamos todo a un formato estándar y es tuyo.',
  },
  {
    q: '¿Puedo probarlo antes de decidir?',
    a: 'Sí, y de dos formas distintas. Una es entrar vos solo al sistema de prueba, ahora mismo y sin registrarte: se abre con una guía que te muestra para qué sirve cada pantalla y qué conviene probar, con datos de ejemplo, así que podés tocar todo. La otra es reservar una reunión de 20 minutos por videollamada, donde lo recorremos nosotros con los productos y los números de tu negocio adelante. No son lo mismo y podés hacer las dos.',
  },
];
