/**
 * Dónde vive la tienda de cada negocio.
 *
 * Cada cliente tiene la suya en `tunegocio.gastroos.shop`: el middleware lee el
 * subdominio de cada pedido, lo valida, y lo pasa al resto de la aplicación en
 * una cabecera propia (`x-tenant-slug`). Nada más que el middleware escribe esa
 * cabecera, y antes de escribirla borra la que venga de afuera: si no, cualquiera
 * podría mandarla a mano y ver la tienda de otro negocio bajo el dominio
 * principal.
 *
 * Este archivo lo importa el middleware, que corre en el runtime de borde: nada de
 * módulos de Node ni de React acá. Tampoco se importa desde componentes de
 * cliente, donde las variables que no empiezan con NEXT_PUBLIC_ no existen.
 */

export const TENANT_HEADER = 'x-tenant-slug';

/**
 * Subdominios que no pueden ser una tienda: ya tienen otro dueño (la página, el
 * mail, el panel) o confundirían a quien los lea.
 *
 * La base tiene la misma lista en `sovare.slug_reservado()`; si se toca una, se
 * toca la otra. Lo que empieza con `demo-` también es reservado: así se llaman
 * las copias de la demo.
 */
const RESERVED = new Set([
  'www', 'app', 'admin', 'api', 'panel', 'sovare', 'gastroos', 'cosov',
  'mail', 'email', 'send', 'smtp', 'imap', 'pop', 'mx', 'ns1', 'ns2', 'ftp',
  'hola', 'soporte', 'ayuda', 'contacto', 'info', 'ventas', 'billing',
  'login', 'salir', 'contratar', 'alta', 'vendedor', 'vendedores', 'catalogo',
  'tienda', 'tiendas', 'demo', 'test', 'prueba', 'staging', 'dev', 'static',
  'cdn', 'assets', 'status', 'blog', 'docs', 'resend', 'dashboard', 'cuenta',
]);

export function isReservedSlug(slug: string): boolean {
  return RESERVED.has(slug) || slug.startsWith('demo-');
}

/** Una etiqueta de DNS en minúsculas: letras, números y guiones en el medio. */
const LABEL = /^[a-z0-9]+(-[a-z0-9]+)*$/;

export function isValidSlug(slug: string): boolean {
  return slug.length >= 3 && slug.length <= 40 && LABEL.test(slug);
}

// ============================================
// El dominio raíz
// ============================================

/**
 * La URL del sitio, la de producción. Sale de la misma variable que usan los
 * mails; `NEXT_PUBLIC_ROOT_DOMAIN` existe por si algún día el sitio de venta y
 * las tiendas cuelgan de dominios distintos.
 */
function siteUrl(): URL | null {
  const raw =
    process.env.NEXT_PUBLIC_SITE_URL?.trim() ||
    (process.env.VERCEL_PROJECT_PRODUCTION_URL?.trim()
      ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL.trim()}`
      : '');
  if (!raw) return null;
  try {
    return new URL(raw);
  } catch {
    return null;
  }
}

/** El host raíz tal como llega en la cabecera `Host` (con puerto si no es el estándar). */
export function rootHost(): string | null {
  const explicit = process.env.NEXT_PUBLIC_ROOT_DOMAIN?.trim().toLowerCase();
  if (explicit) return explicit;
  return siteUrl()?.host.toLowerCase() || null;
}

/** `https://gastroos.shop`, o null si el sitio no tiene dirección configurada. */
export function rootOrigin(): string | null {
  const host = rootHost();
  if (!host) return null;
  const protocol = siteUrl()?.protocol || 'https:';
  return `${protocol}//${host}`;
}

/**
 * De qué tienda es este host.
 *
 * `dulce.gastroos.shop` → `dulce`. Devuelve null para el dominio raíz, para los
 * subdominios reservados, para los que tienen más de un nivel y para cualquier
 * host que no cuelgue del dominio raíz (el `.vercel.app` de un deploy, por
 * ejemplo): en todos esos casos la aplicación se comporta como siempre.
 */
export function tenantFromHost(rawHost: string | null | undefined): string | null {
  const root = rootHost();
  if (!root || !rawHost) return null;

  // Un proxy puede mandar el puerto estándar en la cabecera; no forma parte del nombre.
  const host = rawHost
    .trim()
    .toLowerCase()
    .replace(/:(80|443)$/, root.includes(':') ? '$&' : '')
    .replace(/\.$/, '');
  const suffix = `.${root}`;
  if (!host.endsWith(suffix)) return null;

  const label = host.slice(0, -suffix.length);
  if (!label || !isValidSlug(label) || isReservedSlug(label)) return null;
  return label;
}

/**
 * ¿Es un subdominio del dominio raíz que no es una tienda?
 *
 * `www`, `admin`, `demo-…`, un nombre con guion bajo, uno de dos niveles. Ninguno
 * tiene nada propio para mostrar: el middleware los manda al dominio principal
 * en vez de servir el sitio entero bajo un nombre que no es el suyo.
 */
export function isOtherRootSubdomain(rawHost: string | null | undefined): boolean {
  const root = rootHost();
  if (!root || !rawHost) return false;

  const host = rawHost
    .trim()
    .toLowerCase()
    .replace(/:(80|443)$/, root.includes(':') ? '$&' : '')
    .replace(/\.$/, '');
  return host.endsWith(`.${root}`) && tenantFromHost(rawHost) === null;
}

// ============================================
// Direcciones de las tiendas
// ============================================

/** `https://dulce.gastroos.shop`. No mira si la tienda existe ni si el DNS ya está. */
export function tenantStoreUrl(slug: string): string | null {
  const root = rootHost();
  if (!root) return null;
  const protocol = siteUrl()?.protocol || 'https:';
  return `${protocol}//${slug}.${root}`;
}

/**
 * ¿Las tiendas por subdominio están funcionando de verdad?
 *
 * Hace falta que el comodín `*.gastroos.shop` resuelva y tenga certificado, y
 * eso depende de un cambio de DNS que se hace afuera del código. Mientras no
 * esté, no se le puede mandar a nadie un link que no abre: los mails y las
 * pantallas dicen que la tienda se activa en breve en vez de mostrar una
 * dirección muerta. Se prende con `TENANT_STORES=on`.
 */
export function tenantStoresLive(): boolean {
  return process.env.TENANT_STORES === 'on';
}

// ============================================
// Del nombre del negocio a su dirección
// ============================================

/**
 * El subdominio que se le propone a un negocio a partir de su nombre.
 *
 * Sin tildes, en minúsculas, con guiones. Es sólo la propuesta: la base se
 * encarga de que sea única (agrega -2, -3…) y de rechazar los reservados.
 */
export function slugFromName(name: string): string {
  const base = name
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/&/g, ' y ')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40)
    .replace(/-+$/, '');

  if (!base) return 'mi-tienda';
  if (base.length < 3) return `${base}-tienda`;
  return base;
}
