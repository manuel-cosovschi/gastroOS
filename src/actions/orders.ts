'use server';

import { revalidatePath } from 'next/cache';
import { createServerClient } from '@/lib/supabase/server';
import { requireBusinessId } from '@/lib/business';
import { getProductUnitCosts, getPackageUnitCosts } from '@/lib/production-cost';
import { round2, todayISO } from '@/lib/utils';
import { findOrCreateCustomer } from '@/actions/customers';
import { applyStockForOrder } from '@/actions/inventory';
import { VALID_TRANSITIONS, ORDER_STATUS_LABELS } from '@/types';
import type {
  CreateOrderInput,
  Customer,
  Order,
  OrderDetail,
  OrderFilters,
  OrderItem,
  OrderLineInput,
  OrderStatus,
  UpdateOrderInput,
} from '@/types';

const PAGE_SIZE = 20;

// ============================================
// Lectura
// ============================================

export async function listOrders(
  filters: OrderFilters = {}
): Promise<{ orders: Order[]; total: number }> {
  const businessId = await requireBusinessId();
  const supabase = await createServerClient();
  const { page = 1, per_page = PAGE_SIZE, status, customer_id, from_date, to_date, search, scope } =
    filters;

  let query = supabase
    .from('orders')
    .select('*', { count: 'exact' })
    .eq('business_id', businessId);

  if (status) query = query.eq('status', status);
  if (customer_id) query = query.eq('customer_id', customer_id);
  if (from_date) query = query.gte('delivery_date', from_date);
  if (to_date) query = query.lte('delivery_date', to_date);
  if (search?.trim()) {
    const term = `%${search.trim()}%`;
    query = query.or(`contact_name.ilike.${term},phone.ilike.${term},email.ilike.${term}`);
  }

  // "Próximos" ordena de la entrega más cercana a la más lejana;
  // "histórico" y "todos" ordenan de lo más reciente hacia atrás.
  if (scope === 'upcoming') {
    query = query
      .gte('delivery_date', todayISO())
      .not('status', 'in', '("delivered","cancelled")')
      .order('delivery_date', { ascending: true })
      .order('delivery_time', { ascending: true, nullsFirst: true });
  } else if (scope === 'history') {
    query = query.lt('delivery_date', todayISO()).order('delivery_date', { ascending: false });
  } else {
    query = query
      .order('delivery_date', { ascending: false })
      .order('order_number', { ascending: false });
  }

  const from = (page - 1) * per_page;
  const { data, count } = await query.range(from, from + per_page - 1);

  return { orders: (data as Order[]) || [], total: count || 0 };
}

export async function getOrder(id: string): Promise<OrderDetail | null> {
  const businessId = await requireBusinessId();
  const supabase = await createServerClient();

  const { data: order } = await supabase
    .from('orders')
    .select('*')
    .eq('id', id)
    .eq('business_id', businessId)
    .maybeSingle();

  if (!order) return null;

  const [{ data: items }, { data: history }, customer] = await Promise.all([
    supabase.from('order_items').select('*').eq('order_id', id),
    supabase.from('order_status_history').select('*').eq('order_id', id).order('created_at'),
    order.customer_id
      ? supabase.from('customers').select('*').eq('id', order.customer_id).maybeSingle()
      : Promise.resolve({ data: null }),
  ]);

  return {
    ...(order as Order),
    items: (items as OrderItem[]) || [],
    status_history: history || [],
    customer: (customer.data as Customer) || null,
  } as OrderDetail;
}

// ============================================
// Escritura
// ============================================

export async function createOrder(
  input: CreateOrderInput
): Promise<{ success: boolean; order?: Order; error?: string }> {
  const businessId = await requireBusinessId();
  return createOrderForBusiness(businessId, input, 'manual');
}

/**
 * Crea un pedido. Se usa desde el panel (channel `manual`) y desde la tienda
 * pública (channel `storefront`), que no tiene sesión y por eso recibe el
 * `businessId` resuelto por slug en vez de por membresía.
 */
export async function createOrderForBusiness(
  businessId: string,
  input: CreateOrderInput,
  channel: 'manual' | 'storefront'
): Promise<{ success: boolean; order?: Order; error?: string }> {
  const validation = validateOrderInput(input);
  if (validation) return { success: false, error: validation };

  const supabase = await createServerClient();

  const priced = await priceOrderLines(businessId, input.items);
  if ('error' in priced) return { success: false, error: priced.error };

  const customerId =
    input.customer_id ||
    (await findOrCreateCustomer(businessId, {
      contact_name: input.contact_name,
      phone: input.phone,
      email: input.email,
      address: input.address,
    }));

  const status: OrderStatus = input.status || 'pending';

  const { data: order, error } = await supabase
    .from('orders')
    .insert({
      business_id: businessId,
      status,
      customer_id: customerId,
      contact_name: input.contact_name.trim(),
      phone: input.phone?.trim() || null,
      email: input.email?.trim() || null,
      delivery_method: input.delivery_method,
      address: input.address?.trim() || null,
      city: input.city?.trim() || null,
      delivery_date: input.delivery_date,
      delivery_time: input.delivery_time || null,
      subtotal: priced.subtotal,
      production_cost: priced.productionCost > 0 ? priced.productionCost : null,
      deposit_amount: round2(input.deposit_amount || 0),
      payment_method: input.payment_method || null,
      channel,
      observations: input.observations?.trim() || null,
      admin_notes: input.admin_notes?.trim() || null,
      requires_invoice: input.requires_invoice || false,
    })
    .select()
    .single();

  if (error || !order) {
    return { success: false, error: 'No se pudo crear el pedido. Probá de nuevo.' };
  }

  await supabase
    .from('order_items')
    .insert(priced.items.map((item) => ({ ...item, order_id: order.id })));

  await supabase.from('order_status_history').insert({
    order_id: order.id,
    from_status: null,
    to_status: status,
    notes: 'Pedido creado',
  });

  // Confirmar un pedido descuenta stock; si nace confirmado hay que aplicarlo ya.
  if (status !== 'pending' && status !== 'cancelled') {
    await applyStockForOrder(businessId, order.id);
  }

  revalidateOrderViews(order.id);
  return { success: true, order: order as Order };
}

export async function updateOrder(
  id: string,
  input: UpdateOrderInput
): Promise<{ success: boolean; error?: string }> {
  const businessId = await requireBusinessId();
  const supabase = await createServerClient();

  const { data: existing } = await supabase
    .from('orders')
    .select('id')
    .eq('id', id)
    .eq('business_id', businessId)
    .maybeSingle();

  if (!existing) return { success: false, error: 'Pedido no encontrado.' };

  const patch: Record<string, unknown> = {};
  if (input.contact_name !== undefined) patch.contact_name = input.contact_name.trim();
  if (input.customer_id !== undefined) patch.customer_id = input.customer_id || null;
  if (input.phone !== undefined) patch.phone = input.phone?.trim() || null;
  if (input.email !== undefined) patch.email = input.email?.trim() || null;
  if (input.delivery_method !== undefined) patch.delivery_method = input.delivery_method;
  if (input.address !== undefined) patch.address = input.address?.trim() || null;
  if (input.city !== undefined) patch.city = input.city?.trim() || null;
  if (input.delivery_date !== undefined) patch.delivery_date = input.delivery_date;
  if (input.delivery_time !== undefined) patch.delivery_time = input.delivery_time || null;
  if (input.deposit_amount !== undefined) patch.deposit_amount = round2(input.deposit_amount);
  if (input.payment_method !== undefined) patch.payment_method = input.payment_method || null;
  if (input.observations !== undefined) patch.observations = input.observations?.trim() || null;
  if (input.admin_notes !== undefined) patch.admin_notes = input.admin_notes?.trim() || null;
  if (input.requires_invoice !== undefined) patch.requires_invoice = input.requires_invoice;

  // Si cambian los items se recalculan totales y costo, y se reemplaza el detalle.
  if (input.items) {
    const priced = await priceOrderLines(businessId, input.items);
    if ('error' in priced) return { success: false, error: priced.error };

    patch.subtotal = priced.subtotal;
    patch.production_cost = priced.productionCost > 0 ? priced.productionCost : null;

    await supabase.from('order_items').delete().eq('order_id', id);
    await supabase
      .from('order_items')
      .insert(priced.items.map((item) => ({ ...item, order_id: id })));
  }

  const { error } = await supabase.from('orders').update(patch).eq('id', id);
  if (error) return { success: false, error: 'No se pudo actualizar el pedido.' };

  revalidateOrderViews(id);
  return { success: true };
}

export async function updateOrderStatus(
  orderId: string,
  newStatus: OrderStatus,
  notes?: string
): Promise<{ success: boolean; error?: string; warnings?: string[] }> {
  const businessId = await requireBusinessId();
  const supabase = await createServerClient();

  const { data: order } = await supabase
    .from('orders')
    .select('id, status')
    .eq('id', orderId)
    .eq('business_id', businessId)
    .maybeSingle();

  if (!order) return { success: false, error: 'Pedido no encontrado.' };

  const currentStatus = order.status as OrderStatus;
  if (currentStatus === newStatus) return { success: true };

  if (!VALID_TRANSITIONS[currentStatus].includes(newStatus)) {
    return {
      success: false,
      error: `No se puede pasar de "${ORDER_STATUS_LABELS[currentStatus]}" a "${ORDER_STATUS_LABELS[newStatus]}".`,
    };
  }

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { error } = await supabase.from('orders').update({ status: newStatus }).eq('id', orderId);
  if (error) return { success: false, error: 'No se pudo actualizar el estado.' };

  await supabase.from('order_status_history').insert({
    order_id: orderId,
    from_status: currentStatus,
    to_status: newStatus,
    changed_by: user?.id || null,
    notes: notes || null,
  });

  // El stock se descuenta una sola vez, al salir de "pendiente".
  let warnings: string[] | undefined;
  if (currentStatus === 'pending' && newStatus !== 'cancelled') {
    const result = await applyStockForOrder(businessId, orderId);
    warnings = result.warnings;
  }

  revalidateOrderViews(orderId);
  return { success: true, warnings };
}

export async function deleteOrder(id: string): Promise<{ success: boolean; error?: string }> {
  const businessId = await requireBusinessId();
  const supabase = await createServerClient();

  const { error } = await supabase
    .from('orders')
    .delete()
    .eq('id', id)
    .eq('business_id', businessId);

  if (error) return { success: false, error: 'No se pudo eliminar el pedido.' };

  revalidateOrderViews(id);
  return { success: true };
}

// ============================================
// Helpers internos
// ============================================

function validateOrderInput(input: CreateOrderInput): string | null {
  if (!input.contact_name?.trim()) return 'El nombre del cliente es obligatorio.';
  if (!input.delivery_date) return 'La fecha de entrega es obligatoria.';
  if (!input.items?.length) return 'Agregá al menos un producto al pedido.';
  if (input.delivery_method === 'delivery' && !input.address?.trim()) {
    return 'La dirección es obligatoria para envíos a domicilio.';
  }
  if (input.items.some((item) => item.quantity <= 0)) {
    return 'Las cantidades tienen que ser mayores a cero.';
  }
  return null;
}

interface PricedOrder {
  items: Omit<OrderItem, 'id' | 'order_id'>[];
  subtotal: number;
  productionCost: number;
}

/**
 * Convierte las líneas del pedido en items con precio y costo congelados.
 * El snapshot es a propósito: si mañana sube el precio de un producto, los
 * pedidos viejos siguen valiendo lo que valían.
 */
async function priceOrderLines(
  businessId: string,
  lines: OrderLineInput[]
): Promise<PricedOrder | { error: string }> {
  const supabase = await createServerClient();

  const productIds = lines.filter((l) => l.product_id).map((l) => l.product_id!);
  const packageIds = lines.filter((l) => l.package_id).map((l) => l.package_id!);

  const [{ data: products }, { data: packages }, productCosts, packageCosts] = await Promise.all([
    productIds.length
      ? supabase
          .from('products')
          .select('id, name, price')
          .eq('business_id', businessId)
          .in('id', productIds)
      : Promise.resolve({ data: [] }),
    packageIds.length
      ? supabase
          .from('packages')
          .select('id, name, price')
          .eq('business_id', businessId)
          .in('id', packageIds)
      : Promise.resolve({ data: [] }),
    getProductUnitCosts(productIds),
    getPackageUnitCosts(packageIds),
  ]);

  const catalog = new Map<string, { name: string; price: number }>();
  [...(products || []), ...(packages || [])].forEach((entry) =>
    catalog.set(entry.id, { name: entry.name, price: Number(entry.price) })
  );

  const items: Omit<OrderItem, 'id' | 'order_id'>[] = [];

  for (const line of lines) {
    const key = line.product_id || line.package_id;
    if (!key) return { error: 'Cada línea del pedido tiene que referenciar un producto o combo.' };

    const info = catalog.get(key);
    if (!info) return { error: 'Alguno de los productos del pedido ya no está disponible.' };

    const unitCost = line.product_id
      ? productCosts.get(line.product_id) ?? 0
      : packageCosts.get(line.package_id!) ?? 0;
    const costSubtotal = round2(unitCost * line.quantity);

    items.push({
      product_id: line.product_id || null,
      package_id: line.package_id || null,
      item_name: info.name,
      unit_price: info.price,
      quantity: line.quantity,
      subtotal: round2(info.price * line.quantity),
      unit_cost: unitCost > 0 ? round2(unitCost) : null,
      cost_subtotal: costSubtotal > 0 ? costSubtotal : null,
      notes: line.notes?.trim() || null,
    });
  }

  return {
    items,
    subtotal: round2(items.reduce((sum, item) => sum + item.subtotal, 0)),
    productionCost: round2(items.reduce((sum, item) => sum + (item.cost_subtotal ?? 0), 0)),
  };
}

function revalidateOrderViews(orderId: string) {
  revalidatePath('/admin');
  revalidatePath('/admin/pedidos');
  revalidatePath(`/admin/pedidos/${orderId}`);
  revalidatePath('/admin/calendario');
  revalidatePath('/admin/estadisticas');
}
