'use server';

import { revalidatePath } from 'next/cache';
import { createServerClient } from '@/lib/supabase/server';
import { getStorefrontBusiness } from '@/lib/business';
import { notifyBusiness } from '@/lib/push';
import {
  loadOrderLines,
  sendNewOrderNotification,
  sendOrderConfirmation,
} from '@/lib/order-emails';
import { SITE_URL } from '@/lib/marketing';
import { storefrontOrderSchema } from '@/lib/validations/order';
import type {
  Category,
  CreateOrderInput,
  OrderStatus,
  OrderTracking,
  Package,
  PackageDetail,
  Product,
  StorefrontBusiness,
  StorefrontOrderReceipt,
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

/**
 * Alta de pedido desde la tienda pública (sin sesión).
 *
 * Va por la función `create_storefront_order` y no por un INSERT como el
 * panel, por dos motivos que se refuerzan.
 *
 * Uno: RLS no sabe decir "podés leer la fila que acabás de escribir". Cuando el
 * INSERT lleva RETURNING —y el cliente de Supabase siempre lo manda— Postgres
 * aplica además las policies de SELECT, así que el pedido entraba y la
 * devolución lo hacía fallar todo, con un error que señalaba la policy
 * equivocada. La función devuelve exactamente lo que el visitante necesita ver:
 * su número de pedido.
 *
 * Dos: la anon key es pública, viaja en el navegador. Un precio que llegue de
 * afuera no es un precio. Adentro de la función los toma del catálogo y de acá
 * sólo salen ids y cantidades.
 */
export async function submitStorefrontOrder(
  input: CreateOrderInput
): Promise<{ success: boolean; order?: StorefrontOrderReceipt; error?: string }> {
  const business = await getStorefrontBusiness();
  if (!business) {
    return { success: false, error: 'La tienda no está disponible en este momento.' };
  }

  // Lo que valida el formulario lo valida el navegador, y el navegador es de
  // quien está del otro lado. Esta acción es una ruta HTTP como cualquier otra:
  // se le puede mandar cualquier cosa sin pasar por la pantalla.
  const revisado = storefrontOrderSchema.safeParse(input);
  if (!revisado.success) {
    return {
      success: false,
      error: revisado.error.issues[0]?.message || 'Revisá los datos del pedido.',
    };
  }
  input = revisado.data as CreateOrderInput;

  const supabase = await createServerClient();
  const { data, error } = await supabase.rpc('create_storefront_order', {
    p_business_id: business.id,
    p_contact: {
      contact_name: input.contact_name,
      phone: input.phone ?? null,
      email: input.email ?? null,
      delivery_method: input.delivery_method,
      address: input.address ?? null,
      city: input.city ?? null,
      delivery_date: input.delivery_date,
      observations: input.observations ?? null,
    },
    p_items: input.items.map((item) => ({
      product_id: item.product_id ?? null,
      package_id: item.package_id ?? null,
      quantity: item.quantity,
      notes: item.notes ?? null,
    })),
  });

  if (error) {
    console.error('[submitStorefrontOrder] falló create_storefront_order:', error);
    // P0001 es el código de un RAISE de la función: esos mensajes están
    // escritos para que los lea el visitante ("falta la dirección", "ese
    // producto ya no está"). Cualquier otro código es un problema nuestro y su
    // detalle no le sirve a nadie del otro lado del mostrador.
    return {
      success: false,
      error: error.code === 'P0001' ? error.message : 'No se pudo crear el pedido. Probá de nuevo.',
    };
  }

  const order = data as StorefrontOrderReceipt | null;
  if (!order?.order_number) {
    return { success: false, error: 'No se pudo crear el pedido. Probá de nuevo.' };
  }

  // El pedido nuevo tiene que aparecer en el panel sin que nadie recargue.
  revalidatePath('/admin');
  revalidatePath('/admin/pedidos');
  revalidatePath('/admin/calendario');

  // Los avisos van sin `await` a propósito: quien acaba de encargar no tiene
  // por qué esperar a que Google entregue una notificación ni a que Resend
  // acepte un mail. El pedido ya está guardado, que es lo que importa.
  notifyBusiness(business.id, {
    title: `Pedido nuevo #${order.order_number}`,
    body: `${input.contact_name} encargó por la tienda. Entrega el ${formatDeliveryDate(input.delivery_date)}.`,
    url: `/admin/pedidos/${order.id}`,
    tag: `pedido-${order.order_number}`,
  }).catch((error) => console.error('[submitStorefrontOrder] no se pudo avisar:', error));

  sendOrderMails(business, order, input).catch((error) =>
    console.error('[submitStorefrontOrder] no se pudieron mandar los mails:', error)
  );

  return { success: true, order };
}

/**
 * Seguimiento público por número de pedido.
 *
 * Va por `get_order_tracking`, que es SECURITY DEFINER y devuelve sólo los
 * campos que le sirven a quien encargó. Antes esto consultaba `orders` de
 * frente con el cliente anónimo: como los pedidos no son legibles sin sesión
 * —y no deben serlo—, RLS filtraba todo y la pantalla contestaba "Pedido no
 * encontrado" siempre, incluso para el pedido recién hecho.
 */
export async function getOrderTracking(orderNumber: number): Promise<OrderTracking | null> {
  const business = await getStorefrontBusiness();
  if (!business || !Number.isInteger(orderNumber) || orderNumber <= 0) return null;

  const supabase = await createServerClient();
  const { data, error } = await supabase.rpc('get_order_tracking', {
    p_business_id: business.id,
    p_order_number: orderNumber,
  });

  if (error) {
    console.error('[getOrderTracking] falló get_order_tracking:', error);
    return null;
  }
  if (!data) return null;

  const tracking = data as OrderTracking;
  return {
    ...tracking,
    status: tracking.status as OrderStatus,
    subtotal: Number(tracking.subtotal),
    items: (tracking.items || []).map((item) => ({
      ...item,
      quantity: Number(item.quantity),
      unit_price: Number(item.unit_price),
      subtotal: Number(item.subtotal),
    })),
    timeline: tracking.timeline || [],
  };
}

/** La fecha de entrega en el texto de la notificación, corta y legible. */
function formatDeliveryDate(date: string): string {
  // Al mediodía y no a medianoche: una fecha sola parseada como UTC cae el día
  // anterior en Argentina, y el aviso diría un día menos.
  return new Intl.DateTimeFormat('es-AR', { day: 'numeric', month: 'short' }).format(
    new Date(`${date}T12:00:00`)
  );
}

/**
 * Los dos mails de un pedido de la tienda: la confirmación a quien encargó y
 * el aviso al negocio.
 *
 * Van juntos y en una función aparte para que el camino feliz del alta se lea
 * de un tirón. Las líneas se releen de la base y no se toman de la entrada: lo
 * que el mail tiene que decir es lo que quedó guardado, con los precios del
 * catálogo, no lo que mandó el navegador.
 */
async function sendOrderMails(
  business: StorefrontBusiness,
  receipt: StorefrontOrderReceipt,
  input: CreateOrderInput
) {
  const items = await loadOrderLines(receipt.id);
  if (items.length === 0) return;

  const order = {
    order_number: receipt.order_number,
    contact_name: input.contact_name,
    phone: input.phone ?? null,
    email: input.email ?? null,
    delivery_date: input.delivery_date,
    delivery_method: input.delivery_method,
    address: input.address ?? null,
    observations: input.observations ?? null,
    subtotal: items.reduce((total, item) => total + Number(item.subtotal), 0),
  };

  const tracking = SITE_URL ? `${SITE_URL}/pedido/seguimiento/${receipt.order_number}` : undefined;
  const admin = SITE_URL ? `${SITE_URL}/admin/pedidos/${receipt.id}` : undefined;

  await Promise.all([
    sendOrderConfirmation({ business, order, items, trackingUrl: tracking }),
    sendNewOrderNotification({ business, order, items, adminUrl: admin }),
  ]);
}
