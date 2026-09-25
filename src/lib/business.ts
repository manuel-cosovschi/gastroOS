import { cache } from 'react';
import { createServerClient } from '@/lib/supabase/server';
import type { Business, StorefrontBusiness } from '@/types';

/**
 * Resolución del negocio activo (tenant).
 *
 * Hoy un usuario pertenece a un solo negocio, así que el "negocio activo" es
 * el primero de sus membresías. Cuando haya que soportar varios por usuario,
 * este es el único punto que cambia: el resto de la app ya pide el negocio acá
 * y filtra por `business_id`.
 */

/** Negocio del usuario autenticado, o null si no hay sesión. */
export const getCurrentBusiness = cache(async (): Promise<Business | null> => {
  const supabase = await createServerClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

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
 * Negocio que publica la tienda pública.
 *
 * En un deploy single-tenant es el único negocio con `storefront_enabled`.
 * `NEXT_PUBLIC_STOREFRONT_BUSINESS_SLUG` permite fijarlo explícitamente cuando
 * hay más de uno en la misma base.
 */
/**
 * Columnas que la tienda pública puede leer.
 *
 * Tienen que coincidir con el GRANT por columna de la migración 001: el rol
 * anónimo no tiene permiso sobre la tabla completa (`order_seq` revelaría
 * cuántos pedidos lleva el negocio), así que un `select('*')` acá falla.
 */
const STOREFRONT_BUSINESS_COLUMNS =
  'id, name, slug, industry, logo_url, phone, email, instagram, address, currency, locale, timezone, storefront_enabled';

export const getStorefrontBusiness = cache(async (): Promise<StorefrontBusiness | null> => {
  const supabase = await createServerClient();
  const slug = process.env.NEXT_PUBLIC_STOREFRONT_BUSINESS_SLUG;

  let query = supabase
    .from('businesses')
    .select(STOREFRONT_BUSINESS_COLUMNS)
    .eq('storefront_enabled', true);

  if (slug) query = query.eq('slug', slug);

  const { data } = await query.order('slug').limit(1).maybeSingle();
  return (data as unknown as StorefrontBusiness) || null;
});
