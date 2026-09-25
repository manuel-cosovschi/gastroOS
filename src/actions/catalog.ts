'use server';

import { createServerClient } from '@/lib/supabase/server';
import { getStorefrontBusiness } from '@/lib/business';
import { createOrderForBusiness } from '@/actions/orders';
import type {
  Category,
  CreateOrderInput,
  Order,
  OrderStatus,
  OrderTracking,
  Package,
  PackageDetail,
  Product,
  StorefrontBusiness,
} from '@/types';

/**
 * Lecturas de la tienda pública. Siempre pasan por `getStorefrontBusiness`,
 * así que un deploy nunca expone el catálogo de un negocio que no publicó
 * su tienda.
 */

export async function getStorefront(): Promise<StorefrontBusiness | null> {
  return getStorefrontBusiness();
}

export async function getActiveCategories(): Promise<Category[]> {
  const business = await getStorefrontBusiness();
  if (!business) return [];

  const supabase = await createServerClient();
  const { data } = await supabase
    .from('categories')
    .select('*')
    .eq('business_id', business.id)
    .eq('is_active', true)
    .order('sort_order');

  return (data as Category[]) || [];
}

export async function getActiveProducts(categorySlug?: string): Promise<Product[]> {
  const business = await getStorefrontBusiness();
  if (!business) return [];

  const supabase = await createServerClient();

  let categoryId: string | undefined;
  if (categorySlug) {
    const { data: category } = await supabase
      .from('categories')
      .select('id')
      .eq('business_id', business.id)
      .eq('slug', categorySlug)
      .maybeSingle();
    if (!category) return [];
    categoryId = category.id;
  }

  let query = supabase
    .from('products')
    .select('*, category:categories(*)')
    .eq('business_id', business.id)
    .eq('is_active', true)
    .order('sort_order')
    .order('name');

  if (categoryId) query = query.eq('category_id', categoryId);

  const { data } = await query;
  return (data as Product[]) || [];
}

export async function getProductBySlug(slug: string): Promise<Product | null> {
  const business = await getStorefrontBusiness();
  if (!business) return null;

  const supabase = await createServerClient();
  const { data } = await supabase
    .from('products')
    .select('*, category:categories(*)')
    .eq('business_id', business.id)
    .eq('slug', slug)
    .eq('is_active', true)
    .maybeSingle();

  return (data as Product) || null;
}

export async function getActivePackages(): Promise<Package[]> {
  const business = await getStorefrontBusiness();
  if (!business) return [];

  const supabase = await createServerClient();
  const { data } = await supabase
    .from('packages')
    .select('*')
    .eq('business_id', business.id)
    .eq('is_active', true)
    .order('sort_order');

  return (data as Package[]) || [];
}

export async function getPackageBySlug(slug: string): Promise<PackageDetail | null> {
  const business = await getStorefrontBusiness();
  if (!business) return null;

  const supabase = await createServerClient();
  const { data: pkg } = await supabase
    .from('packages')
    .select('*')
    .eq('business_id', business.id)
    .eq('slug', slug)
    .eq('is_active', true)
    .maybeSingle();

  if (!pkg) return null;

  const { data: items } = await supabase
    .from('package_items')
    .select('*, product:products(id, name, price, image_url)')
    .eq('package_id', pkg.id);

  return { ...pkg, items: items || [] } as PackageDetail;
}

/** Alta de pedido desde la tienda pública (sin sesión). */
export async function submitStorefrontOrder(
  input: CreateOrderInput
): Promise<{ success: boolean; order?: Order; error?: string }> {
  const business = await getStorefrontBusiness();
  if (!business) {
    return { success: false, error: 'La tienda no está disponible en este momento.' };
  }
  return createOrderForBusiness(business.id, { ...input, status: 'pending' }, 'storefront');
}

/**
 * Seguimiento público por número de pedido.
 *
 * Se resuelve acá (y no vía RLS) a propósito: los pedidos no son legibles por
 * anónimos, y esta función devuelve sólo los campos que el cliente necesita ver.
 */
export async function getOrderTracking(orderNumber: number): Promise<OrderTracking | null> {
  const business = await getStorefrontBusiness();
  if (!business) return null;

  const supabase = await createServerClient();
  const { data: order } = await supabase
    .from('orders')
    .select('id, order_number, status, contact_name, delivery_date, delivery_method, subtotal, created_at')
    .eq('business_id', business.id)
    .eq('order_number', orderNumber)
    .maybeSingle();

  if (!order) return null;

  const [{ data: items }, { data: history }] = await Promise.all([
    supabase
      .from('order_items')
      .select('item_name, quantity, unit_price, subtotal')
      .eq('order_id', order.id),
    supabase
      .from('order_status_history')
      .select('to_status, created_at, notes')
      .eq('order_id', order.id)
      .order('created_at'),
  ]);

  return {
    order_number: order.order_number,
    status: order.status as OrderStatus,
    contact_name: order.contact_name,
    delivery_date: order.delivery_date,
    delivery_method: order.delivery_method,
    subtotal: Number(order.subtotal),
    items: (items || []).map((item) => ({
      name: item.item_name,
      quantity: item.quantity,
      unit_price: Number(item.unit_price),
      subtotal: Number(item.subtotal),
    })),
    timeline: (history || []).map((entry) => ({
      status: entry.to_status,
      date: entry.created_at,
      notes: entry.notes,
    })),
    created_at: order.created_at,
  };
}
