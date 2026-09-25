/**
 * Constantes de producto.
 *
 * Nada de lo que hay acá describe a un negocio en particular: el nombre
 * comercial, el rubro, la moneda y los datos de contacto viven en la tabla
 * `businesses` y se leen en runtime. Esto es sólo la identidad de GastroOS.
 */

export const APP_NAME = 'GastroOS';
export const APP_TAGLINE = 'El sistema operativo de tu negocio gastronómico';
export const APP_DESCRIPTION =
  'Gestioná pedidos, clientes, stock y rentabilidad de tu negocio gastronómico desde un solo lugar.';

/** Valores por defecto cuando todavía no hay un negocio configurado. */
export const DEFAULT_CURRENCY = 'ARS';
export const DEFAULT_LOCALE = 'es-AR';
export const DEFAULT_TIMEZONE = 'America/Argentina/Buenos_Aires';

/** Anticipación mínima (horas) para aceptar un pedido desde la tienda pública. */
export const DEFAULT_MIN_ADVANCE_HOURS = 48;

export const MAX_IMAGE_SIZE = 5 * 1024 * 1024; // 5 MB
export const ACCEPTED_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp'];
export const MEDIA_BUCKET = 'gastroos-media';

export const ITEMS_PER_PAGE = 20;

/** Modo demo: habilita el banner y las credenciales visibles en el login. */
export const DEMO_MODE = process.env.NEXT_PUBLIC_DEMO_MODE === 'true';
export const DEMO_EMAIL = process.env.NEXT_PUBLIC_DEMO_EMAIL || 'demo@gastroos.app';

/** Franjas horarias sugeridas para entregas. */
export const TIME_SLOTS = [
  '08:00',
  '09:00',
  '10:00',
  '11:00',
  '12:00',
  '13:00',
  '14:00',
  '15:00',
  '16:00',
  '17:00',
  '18:00',
  '19:00',
  '20:00',
] as const;

/** Rubros sugeridos al configurar el negocio. El campo es de texto libre. */
export const INDUSTRY_OPTIONS = [
  'Pastelería artesanal',
  'Panadería',
  'Tortas por encargo',
  'Catering',
  'Viandas',
  'Repostería',
  'Comida por encargo',
  'Dark kitchen',
  'Cafetería',
  'Otro',
] as const;
