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

/** Teléfono en formato internacional sin + ni espacios, p. ej. 5491155550134. */
export const WHATSAPP_NUMBER = (process.env.NEXT_PUBLIC_WHATSAPP || '').replace(/\D/g, '');

export const CONTACT_EMAIL = process.env.NEXT_PUBLIC_CONTACT_EMAIL || '';

/** A dónde lleva "Ver la demo". Por defecto, el login con el usuario demo. */
export const DEMO_URL = process.env.NEXT_PUBLIC_DEMO_URL || '/login';

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
// Cómo funciona
// ============================================

export const STEPS = [
  {
    title: 'Charlamos 20 minutos',
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
    title: 'Tus datos son tuyos',
    body: 'Exportables cuando quieras. Sin quedar atado a nosotros para llevarte tu información.',
  },
  {
    title: 'Crece con vos',
    body: 'Sumás tienda online, usuarios y sucursales cuando los necesites. Sin migrar a otra cosa.',
  },
];

// ============================================
// Preguntas frecuentes
// ============================================

export const FAQS = [
  {
    q: '¿Sirve si vendo por WhatsApp e Instagram?',
    a: 'Sí, es el caso más común. Vos seguís recibiendo el pedido por donde ya lo recibís y lo cargás en GastroOS en menos de un minuto. Si querés, además te damos una tienda online para que el cliente lo cargue solo.',
  },
  {
    q: '¿Tengo que cargar todo de cero?',
    a: 'No. La carga inicial de productos, precios, insumos y clientes la hacemos nosotros con la información que nos pases, aunque esté en un Excel o en fotos.',
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
    a: 'Sí. Podés entrar ahora mismo a la demo con datos de ejemplo, o coordinar una demostración en vivo donde lo recorremos juntos con el caso de tu negocio.',
  },
];
