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
  outcome:
    'Hoy trabaja sobre su propia instalación de GastroOS: su paleta, sus tipografías, su dominio y su base de datos. No comparte el sistema con nadie y no parece software alquilado — parece de ellos, porque lo es.',
  facts: [
    { label: 'Rubro', value: 'Pastelería artesanal por encargo' },
    { label: 'Trabaja con', value: 'Cafeterías y eventos' },
    { label: 'Qué se personalizó', value: 'Identidad, tienda y flujo de pedidos' },
  ],
  /** El antes y después no es de versiones: es la misma pantalla en dos marcas. */
  skins: {
    title: 'La misma pantalla, dos identidades',
    body: 'A la izquierda, GastroOS como viene. A la derecha, la misma pantalla con la paleta y la tipografía de COSOV. No es un tema que elegís de una lista de cuatro: es la identidad de tu negocio llevada al sistema.',
    left: {
      image: '/casos/gastroos-panel.webp',
      alt: 'Panel de GastroOS con su identidad por defecto, en verde',
      caption: 'GastroOS, como viene',
    },
    right: {
      image: '/casos/cosov-panel.webp',
      alt: 'La misma pantalla del panel con la paleta bordó y las tipografías de COSOV.',
      caption: 'Con la identidad de COSOV.',
    },
    note: 'Capturas del panel con datos de ejemplo. Los números de un cliente no se muestran nunca.',
  },
  storefront: {
    title: 'Y la tienda, con su marca',
    body: 'Sus clientes arman el pedido desde un catálogo que es de COSOV., no de un proveedor de software. El pedido cae directo en el panel.',
    image: '/casos/cosov-tienda.webp',
    alt: 'Catálogo público de COSOV. con sus productos, en bordó y crema',
    caption: 'Tienda pública de COSOV., en producción',
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
    body: 'Cargamos tu catálogo, tus precios, tus insumos y tus clientes. Arrancás con el sistema lleno, no vacío.',
  },
  {
    title: 'Te enseñamos a usarlo',
    body: 'Una sesión de capacitación con tu equipo. En una hora están cargando pedidos solos.',
  },
  {
    title: 'Te acompañamos',
    body: 'Soporte por WhatsApp y ajustes sobre la marcha. El sistema se adapta a tu negocio, no al revés.',
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
    body: 'Tu paleta, tus tipografías y tu dominio. Tus clientes ven tu negocio, no el logo de un proveedor de software.',
  },
  {
    title: 'Arrancás con tus datos adentro',
    body: 'La carga inicial la hacemos nosotros. No te dejamos un sistema vacío para que lo llenes en tus ratos libres.',
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
    title: 'Tu instalación, no una cuenta compartida',
    body: 'Cada negocio tiene la suya, con su propia base de datos. Tus números no conviven con los de nadie, y lo que se ajusta para vos no depende de lo que necesiten otros.',
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
      note: 'No decimos que lo sea. Decimos que sin el costo por receta cargado, no hay forma de saberlo — y que 5 puntos sobre tu facturación es esta plata.',
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
    { title: 'No manda WhatsApp solo', body: 'No hay envío automático de mensajes ni de mails al cliente.' },
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
 * Los números están puestos contra la competencia relevada en septiembre de
 * 2026: los sistemas de gestión gastronómica en Argentina arrancan cerca de
 * $21.000 + IVA por el plan más chico, y los que traen tienda online y control
 * de stock —lo comparable a esto— van de $68.000 a $99.000 + IVA, con los
 * módulos de mesa, cocina y facturación cobrados aparte a $23.000–24.500 cada
 * uno. La implementación en el más conocido son $180.000.
 *
 * El piso de `Base` no es arbitrario: cada instalación tiene su propio proyecto
 * de Supabase, que cuesta unos USD 10 de compute por mes más la parte
 * proporcional de la organización. Con el dólar a ~$1.550 eso es $17.000–19.000
 * por cliente antes de tocar nada. Por eso `Base` no incluye soporte: a ese
 * precio no entra, y meterlo igual sería vender a pérdida.
 *
 * Son pesos y hay inflación: `asOf` está para que se note cuándo se fijaron.
 */
export const PRICING = {
  enabled: true,
  eyebrow: 'Precios',
  title: 'Cuánto cuesta',
  subtitle:
    'Una instalación propia, con tu marca y tu base de datos. Sin porcentaje sobre tus ventas: lo que vendas es tuyo.',
  asOf: 'Precios de septiembre de 2026, en pesos y con IVA incluido.',
  /** El ancla: contra qué se compara el número de abajo. */
  context:
    'Los sistemas de gestión gastronómica con tienda online y control de stock cobran entre $68.000 y $99.000 por mes más IVA, y te cobran aparte cada módulo. Nosotros arrancamos en menos de la mitad.',

  setup: {
    name: 'Puesta a punto',
    price: 95000,
    unit: 'pago único',
    summary:
      'Se paga una sola vez, al principio. Es el trabajo de dejarte el sistema andando con tu negocio adentro, no una licencia.',
    features: [
      'Tu instalación con tu paleta y tus tipografías',
      'Carga de catálogo, precios, insumos y clientes',
      'Recetas y costo real de cada producto',
      'Tu tienda online publicada',
      'Una sesión de capacitación con tu equipo',
    ],
  },

  plans: [
    {
      name: 'Base',
      price: 26900,
      unit: 'por mes',
      summary:
        'El sistema entero funcionando. Sin soporte ni cambios incluidos: si necesitás algo, se cobra por hora.',
      features: [
        'Todos los módulos, sin límite de pedidos',
        'Tienda online con tu marca',
        'Tu propia base de datos, con backup diario',
        'Actualizaciones de seguridad',
        'Soporte y cambios aparte, por hora',
      ],
      highlight: false,
    },
    {
      name: 'Con soporte',
      price: 46900,
      unit: 'por mes',
      summary:
        'Lo mismo, pero con alguien del otro lado. Es el que toma casi todo el mundo.',
      features: [
        'Todo lo del plan Base',
        'Soporte por WhatsApp, respuesta en el día hábil',
        'Ajustes y cambios chicos incluidos',
        'Las mejoras del producto, a medida que salen',
        'Te ayudamos a cargar los cambios de temporada',
      ],
      highlight: true,
    },
    {
      name: 'A medida',
      price: 89000,
      unit: 'por mes',
      priceFrom: true,
      summary:
        'Cuando el sistema tiene que hacer algo que hoy no hace, o el negocio ya no entra en una sola cocina.',
      features: [
        'Todo lo del plan Con soporte',
        'Desarrollo de funciones propias',
        'Integraciones con lo que ya uses',
        'Varias sucursales o equipos',
        'Prioridad en los pedidos de cambio',
      ],
      highlight: false,
    },
  ],

  hourly: {
    label: 'Hora de soporte o cambios, para el plan Base',
    price: 19000,
  },

  /** Cierre de la sección. Sin permanencia es lo único que prometemos acá. */
  closing: {
    title: 'Sin contrato de permanencia',
    body: 'Se paga mes a mes. Si un mes decidís que no va más, avisás y listo — y te llevás tu información exportada, que es tuya.',
  },
};

// ============================================
// Preguntas frecuentes
// ============================================

export const FAQS = [
  {
    q: '¿Sirve si vendo por WhatsApp e Instagram?',
    a: 'Sí, es el caso más común. Vos seguís recibiendo el pedido por donde ya lo recibís y lo cargás en GastroOS en menos de un minuto. Si querés, además te damos una tienda online para que el cliente lo cargue solo.',
  },
  {
    q: '¿Puedo ponerle los colores y la tipografía de mi marca?',
    a: 'Sí, y no de una lista de temas: tu instalación se arma con tu paleta y tus tipografías, igual que el caso de COSOV. que está más arriba. Si tenés manual de marca lo seguimos; si no, lo sacamos de tu logo y tus redes. Va incluido en la puesta a punto, no es un extra.',
  },
  {
    q: '¿Tengo que cargar todo de cero?',
    a: 'No. La carga inicial de productos, precios, insumos y clientes la hacemos nosotros con la información que nos pases, aunque esté en un Excel o en fotos.',
  },
  {
    q: '¿Por qué el plan Base no incluye soporte?',
    a: 'Porque queríamos un precio de entrada real y no uno que se cae cuando pedís algo. Cada instalación tiene su propio servidor y su propia base de datos, y eso cuesta plata todos los meses aunque nadie toque nada. El plan Base cubre eso y el sistema funcionando; si necesitás ayuda, se cobra por hora y sabés cuánto. Si preferís tenerlo incluido y no pensar, está el plan Con soporte, que es el que toma casi todo el mundo.',
  },
  {
    q: '¿Por qué son más baratos que los demás?',
    a: 'Por dos cosas. Una, no somos un punto de venta: no tenemos que mantener módulos de mesas, comandas ni impresoras fiscales, que es de donde sale buena parte del precio de los otros. Y dos, no cobramos cada función aparte — lo que ves es lo que hay, sin módulos que se suman de a $24.000.',
  },
  {
    q: '¿Cuánto tarda en estar funcionando?',
    a: 'Depende del tamaño del catálogo, pero en general una semana desde que nos pasás la información.',
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
