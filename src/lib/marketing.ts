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
        // Decía además «es el que toma casi todo el mundo»: no lo medimos —hay
        // un solo cliente— y una afirmación así se cae con una pregunta.
        'Cuando ya hay alguien más en la cocina.',
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
    q: '¿Sirve para un local con mostrador y caja?',
    a: 'No, y es a propósito. GastroOS está hecho para el negocio que produce contra una fecha de entrega: tomás el pedido el martes y entregás el sábado. No tiene mesas, ni comandas de cocina, ni caja para cobrar al que entra y se lleva algo en el momento. Si lo tuyo es mostrador, lo que necesitás es un punto de venta y hay varios buenos; pedirle eso a este sistema te va a hacer perder tiempo a vos y a nosotros. Si hacés las dos cosas —vendés en el local y además tomás encargos—, esto se ocupa de los encargos y convive sin problema con lo que uses para el mostrador.',
  },
  {
    q: '¿Emite facturas?',
    a: 'No. GastroOS no emite comprobantes de AFIP/ARCA ni se integra con la facturación electrónica: eso sigue donde lo tengas hoy. Lo que sí lleva es el registro de lo que vendiste y lo que cobraste, que es de donde después sacás lo que tengas que facturar. Lo decimos acá y no en la tercera reunión porque es la pregunta que más temprano conviene contestar.',
  },
  {
    q: '¿Se puede cobrar online, con Mercado Pago?',
    a: 'No todavía. La tienda toma el pedido y la seña se acuerda por fuera —transferencia, efectivo, como lo venís haciendo—; en el sistema registrás lo que cobraste, no lo cobrás desde acá. Si lo que necesitás es que el cliente pague con tarjeta en el momento de comprar, hoy no lo tenemos y conviene que lo sepas antes.',
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
