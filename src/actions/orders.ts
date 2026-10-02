'use server';

import { revalidatePath } from 'next/cache';
import { createServerClient } from '@/lib/supabase/server';
import { getCurrentBusiness, publicStoreUrl, requireBusinessId } from '@/lib/business';
import { getProductUnitCosts, getPackageUnitCosts } from '@/lib/production-cost';
import { round2, todayISO } from '@/lib/utils';
import { findOrCreateCustomer } from '@/actions/customers';
import { sendOrderStatusUpdate } from '@/lib/order-emails';
import { applyStockForOrder, reverseStockForOrder } from '@/actions/inventory';
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

/**
 * Alta de pedido desde el panel. La tienda pública no pasa por acá: no tiene
 * sesión, y sus pedidos los escribe `create_storefront_order` en la base (ver
 * `submitStorefrontOrder`).
 */
export async function createOrder(
  input: CreateOrderInput
): Promise<{ success: boolean; order?: Order; error?: string }> {
  const businessId = await requireBusinessId();
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
      channel: 'manual',
      observations: input.observations?.trim() || null,
      admin_notes: input.admin_notes?.trim() || null,
      requires_invoice: input.requires_invoice || false,
    })
    .select()
    .single();

  if (error || !order) {
    // El detalle va al log del servidor: a quien usa el panel no le sirve y a
    // quien depura le ahorra media hora. Sin esto, un fallo de RLS o una
    // constraint rota se ven exactamente igual desde afuera.
    console.error('[createOrder] no se pudo insertar el pedido:', error);
    return { success: false, error: 'No se pudo crear el pedido. Probá de nuevo.' };
  }

  const { error: itemsError } = await supabase
    .from('order_items')
    .insert(priced.items.map((item) => ({ ...item, order_id: order.id })));

  // Un pedido sin líneas no es un pedido: si las líneas no entraron, se
  // deshace la cabecera en vez de dejar un fantasma de $0 en la lista.
  if (itemsError) {
    console.error('[createOrder] no se pudieron insertar las líneas:', itemsError);
    await supabase.from('orders').delete().eq('id', order.id);
    return { success: false, error: 'No se pudo crear el pedido. Probá de nuevo.' };
  }

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
): Promise<{ success: boolean; error?: string; warnings?: string[] }> {
  const businessId = await requireBusinessId();
  const supabase = await createServerClient();

  const { data: existing } = await supabase
    .from('orders')
    .select('id, status')
    .eq('id', id)
    .eq('business_id', businessId)
    .maybeSingle();

  if (!existing) return { success: false, error: 'Pedido no encontrado.' };

  // Un pedido que ya salió de "pendiente" tiene el stock descontado. Si le
  // cambian las cantidades, el descuento viejo no sirve más.
  const stockYaDescontado = existing.status !== 'pending' && existing.status !== 'cancelled';

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

    // Reemplazar el detalle son dos pasos, y entre uno y otro el pedido queda
    // sin líneas. Si el segundo falla hay que volver a dejar las de antes: un
    // pedido con total pero sin nada adentro no se puede ni preparar ni
    // facturar, y en la pantalla parece un pedido de $0.
    const { data: anteriores } = await supabase
      .from('order_items')
      .select(
        'product_id, package_id, item_name, unit_price, quantity, subtotal, unit_cost, cost_subtotal, notes'
      )
      .eq('order_id', id);

    await supabase.from('order_items').delete().eq('order_id', id);
    const { error: itemsError } = await supabase
      .from('order_items')
      .insert(priced.items.map((item) => ({ ...item, order_id: id })));

    if (itemsError) {
      console.error('[updateOrder] no se pudieron reemplazar las líneas:', itemsError);
      if (anteriores?.length) {
        await supabase
          .from('order_items')
          .insert(anteriores.map((item) => ({ ...item, order_id: id })));
      }
      return { success: false, error: 'No se pudo actualizar el detalle del pedido.' };
    }
  }

  const { error } = await supabase.from('orders').update(patch).eq('id', id);
  if (error) return { success: false, error: 'No se pudo actualizar el pedido.' };

  // El stock se rehace entero en vez de calcular la diferencia: se devuelve lo
  // que este pedido había sacado y se descuenta de nuevo con las cantidades
  // nuevas. El neto es la diferencia, y de paso vuelve a decidir qué sale de
  // producto terminado y qué hay que producir, que con las cantidades nuevas
  // puede no ser lo mismo.
  let warnings: string[] | undefined;
  if (input.items && stockYaDescontado) {
    await reverseStockForOrder(businessId, id, { incluirInsumos: true });
    const result = await applyStockForOrder(businessId, id);
    warnings = result.warnings;
  }

  revalidateOrderViews(id);
  return { success: true, warnings };
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
    .select('id, status, order_number, contact_name, email')
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

  // El stock se descuenta una sola vez, al salir de "pendiente", y vuelve si el
  // pedido se cancela después de eso.
  //
  // Qué vuelve depende de cuándo se cancela. El producto terminado vuelve
  // siempre: sigue en la heladera. Los insumos se descuentan al confirmar,
  // contando la producción que va a hacer falta, así que vuelven sólo si el
  // pedido se cancela antes de empezar a producir. Cancelado desde "en
  // preparación" o "listo", la torta ya está hecha y la harina no vuelve.
  let warnings: string[] | undefined;
  if (currentStatus === 'pending' && newStatus !== 'cancelled') {
    const result = await applyStockForOrder(businessId, orderId);
    warnings = result.warnings;
  } else if (newStatus === 'cancelled' && currentStatus !== 'pending') {
    await reverseStockForOrder(businessId, orderId, {
      incluirInsumos: currentStatus === 'confirmed',
    });
  }

  // El aviso al cliente. Sin `await`: quien está en el panel cambiando estados
  // no tiene que esperar a que salga un mail, y si no sale, el estado ya
  // cambió igual. No todos los estados avisan — eso lo decide el módulo.
  notifyStatusChange(order, newStatus, notes).catch((error) =>
    console.error('[updateOrderStatus] no se pudo avisar al cliente:', error)
  );

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

/**
 * Avisa al cliente que su pedido cambió de estado.
 *
 * Va aparte de `updateOrderStatus` para que esa función se siga leyendo como
 * lo que hace —validar la transición, mover el estado, tocar el stock— y no
 * quede mezclada con el armado de un mail.
 */
async function notifyStatusChange(
  order: { order_number: number; contact_name: string; email: string | null },
  status: OrderStatus,
  notes?: string
) {
  if (!order.email) return;

  // `getCurrentBusiness` está memoizada por request, así que pedirla de nuevo
  // acá no cuesta una consulta más: ya la resolvió `requireBusinessId`.
  const business = await getCurrentBusiness();
  if (!business) return;

  // El seguimiento vive en la tienda del negocio, no en el sitio de GastroOS: un
  // link al dominio principal le mostraría al cliente la tienda equivocada.
  const storeUrl = publicStoreUrl(business.slug);

  await sendOrderStatusUpdate({
    business,
    order,
    status,
    notes: notes || null,
    trackingUrl: storeUrl ? `${storeUrl}/pedido/seguimiento/${order.order_number}` : undefined,
  });
}

function revalidateOrderViews(orderId: string) {
  revalidatePath('/admin');
  revalidatePath('/admin/pedidos');
  revalidatePath(`/admin/pedidos/${orderId}`);
  revalidatePath('/admin/calendario');
  revalidatePath('/admin/estadisticas');
}
