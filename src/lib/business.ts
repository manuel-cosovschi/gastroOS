import { cache } from 'react';
import { headers } from 'next/headers';
import { createServerClient } from '@/lib/supabase/server';
import { DEMO_MODE } from '@/lib/constants';
import {
  TENANT_HEADER,
  isReservedSlug,
  isValidSlug,
  tenantStoreUrl,
  tenantStoresLive,
} from '@/lib/tenant';
import type { Business, StorefrontBusiness } from '@/types';

/**
 * Resolución del negocio activo (tenant).
 *
 * Hoy un usuario pertenece a un solo negocio, así que el "negocio activo" es
 * el primero de sus membresías. Cuando haya que soportar varios por usuario,
 * este es el único punto que cambia: el resto de la app ya pide el negocio acá
 * y filtra por `business_id`.
 */

/**
 * El usuario de la sesión. Memoizado por pedido: `getUser()` le pregunta a
 * Supabase si el token sigue siendo bueno, y el panel lo necesita desde dos
 * lugares (el negocio y el cartel de demo).
 */
const getCurrentUser = cache(async () => {
  const supabase = await createServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user;
});

/** Negocio del usuario autenticado, o null si no hay sesión. */
export const getCurrentBusiness = cache(async (): Promise<Business | null> => {
  const user = await getCurrentUser();
  if (!user) return null;

  const supabase = await createServerClient();
  const { data: membership } = await supabase
    .from('business_members')
    .select('business_id')
    .eq('user_id', user.id)
    .order('created_at')
    .limit(1)
    .maybeSingle();

  if (!membership) return null;

  const { data: business } = await supabase
    .from('businesses')
    .select('*')
    .eq('id', membership.business_id)
    .maybeSingle();

  return (business as Business) || null;
});

/**
 * ¿La sesión es una copia de la demo?
 *
 * La demo marca a sus usuarios con `app_metadata.gastroos_demo` al crearlos (ver
 * `src/actions/demo.ts`), y ese campo sólo lo escribe la service role: la
 * persona no puede ponérselo ni sacárselo. Antes bastaba con `NEXT_PUBLIC_DEMO_MODE`,
 * pero ese interruptor es del deploy entero, y desde que el mismo deploy aloja
 * las cuentas de clientes de verdad no alcanza: un cliente vería el cartel de
 * "esta demo es tuya" y el botón de reiniciar su propio negocio.
 */
export async function isDemoSession(): Promise<boolean> {
  if (!DEMO_MODE) return false;
  const user = await getCurrentUser();
  return user?.app_metadata?.gastroos_demo === true;
}

/**
 * Igual que `getCurrentBusiness` pero lanza si no hay negocio.
 * Úsalo en server actions del panel: si no hay sesión válida no hay nada que hacer.
 */
export async function requireBusiness(): Promise<Business> {
  const business = await getCurrentBusiness();
  if (!business) {
    throw new Error('No hay un negocio activo para el usuario actual.');
  }
  return business;
}

/** Igual que `requireBusiness` pero devuelve sólo el id (el caso más común). */
export async function requireBusinessId(): Promise<string> {
  return (await requireBusiness()).id;
}

/**
 * De qué tienda es este pedido, según el subdominio por el que entró.
 *
 * La cabecera la escribe el middleware (y sólo él: borra la que llegue de
 * afuera). En el dominio principal no hay: es null. Fuera de un pedido, como en
 * un script, `headers()` tira, y también es null.
 */
export async function getTenantSlug(): Promise<string | null> {
  try {
    return (await headers()).get(TENANT_HEADER) || null;
  } catch {
    return null;
  }
}

/**
 * Columnas que la tienda pública puede leer.
 *
 * Tienen que coincidir con el GRANT por columna de la migración 001: el rol
 * anónimo no tiene permiso sobre la tabla completa (`order_seq` revelaría
 * cuántos pedidos lleva el negocio), así que un `select('*')` acá falla.
 */
const STOREFRONT_BUSINESS_COLUMNS =
  'id, name, slug, industry, logo_url, phone, email, instagram, address, currency, locale, timezone, storefront_enabled';

/**
 * Negocio que publica la tienda pública.
 *
 * Depende de por dónde se entró:
 *
 *   - `tunegocio.gastroos.shop`: el negocio de ese subdominio. Si no existe o
 *     tiene la tienda apagada, no hay tienda (404), nunca otra distinta.
 *   - el dominio principal: el negocio fijado en
 *     `NEXT_PUBLIC_STOREFRONT_BUSINESS_SLUG`, que es la tienda de ejemplo.
 *     Sin esa variable, el primero con la tienda habilitada, que es lo que
 *     corresponde en un deploy de un solo negocio. En una base con varios
 *     negocios la variable es obligatoria: si no, el primero por orden
 *     alfabético se queda con la tienda de ejemplo.
 *
 * Las copias de la demo nunca aparecen acá: la base no se las deja leer al
 * público (ver la migración 010).
 */
export const getStorefrontBusiness = cache(async (): Promise<StorefrontBusiness | null> => {
  const supabase = await createServerClient();
  const slug = (await getTenantSlug()) || process.env.NEXT_PUBLIC_STOREFRONT_BUSINESS_SLUG;

  let query = supabase
    .from('businesses')
    .select(STOREFRONT_BUSINESS_COLUMNS)
    .eq('storefront_enabled', true);

  if (slug) query = query.eq('slug', slug);

  const { data } = await query.order('slug').limit(1).maybeSingle();
  return (data as unknown as StorefrontBusiness) || null;
});

/**
 * La dirección pública de la tienda de un negocio, para poner en un mail.
 *
 * Es null cuando todavía no hay una dirección que funcione: una tienda por
 * subdominio antes de que el DNS esté listo, o la de un negocio que no es la
 * fijada en el dominio principal. Es preferible un mail sin link a uno con un
 * link que lleva a la tienda equivocada.
 */
export function publicStoreUrl(slug: string): string | null {
  // Un negocio cuyo nombre no puede ser un subdominio no tiene dirección propia.
  // Son las copias de la demo (`demo-…`): su link tiene que faltar y no llevar a
  // una dirección que el middleware rebota al sitio principal.
  if (tenantStoresLive() && isValidSlug(slug) && !isReservedSlug(slug)) {
    return tenantStoreUrl(slug);
  }

  const pinned = process.env.NEXT_PUBLIC_STOREFRONT_BUSINESS_SLUG;
  const site = process.env.NEXT_PUBLIC_SITE_URL?.trim().replace(/\/$/, '') || null;

  // Con una tienda fijada, esa y sólo esa vive en el dominio principal.
  if (pinned) return pinned === slug ? site : null;
  // Sin fijar es un deploy de un solo negocio: la tienda es el sitio.
  return site;
}
