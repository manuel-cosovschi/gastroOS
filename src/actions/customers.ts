'use server';

import { revalidatePath } from 'next/cache';
import { createServerClient } from '@/lib/supabase/server';
import { requireBusinessId } from '@/lib/business';
import { round2 } from '@/lib/utils';
import { REVENUE_ORDER_STATUSES } from '@/types';
import type {
  Customer,
  CustomerWithStats,
  CreateCustomerInput,
  UpdateCustomerInput,
  Order,
} from '@/types';

/**
 * Listado de clientes con sus métricas (pedidos, gastado, ticket promedio).
 *
 * Las métricas se agregan en memoria sobre los pedidos del negocio en lugar de
 * mantener contadores denormalizados: evita que se desincronicen y a esta
 * escala (miles de pedidos) es instantáneo. Si el volumen crece, el reemplazo
 * natural es una vista materializada — el resto de la app no se entera.
 */
export async function listCustomers(search?: string): Promise<CustomerWithStats[]> {
  const businessId = await requireBusinessId();
  const supabase = await createServerClient();

  let query = supabase
    .from('customers')
    .select('*')
    .eq('business_id', businessId)
    .order('full_name');

  if (search?.trim()) {
    const term = `%${search.trim()}%`;
    query = query.or(`full_name.ilike.${term},phone.ilike.${term},email.ilike.${term}`);
  }

  const [{ data: customers }, { data: orders }] = await Promise.all([
    query,
    supabase
      .from('orders')
      .select('customer_id, subtotal, delivery_date, status')
      .eq('business_id', businessId)
      .in('status', REVENUE_ORDER_STATUSES),
  ]);

  const statsByCustomer = new Map<string, { count: number; total: number; last: string | null }>();
  for (const order of orders || []) {
    if (!order.customer_id) continue;
    const current = statsByCustomer.get(order.customer_id) || { count: 0, total: 0, last: null };
    current.count += 1;
    current.total += Number(order.subtotal || 0);
    if (!current.last || order.delivery_date > current.last) current.last = order.delivery_date;
    statsByCustomer.set(order.customer_id, current);
  }

  return (customers || []).map((customer) => {
    const stats = statsByCustomer.get(customer.id);
    const count = stats?.count ?? 0;
    const total = round2(stats?.total ?? 0);
    return {
      ...(customer as Customer),
      orders_count: count,
      total_spent: total,
      average_ticket: count > 0 ? round2(total / count) : 0,
      last_order_date: stats?.last ?? null,
    };
  });
}

export async function getCustomer(
  id: string
): Promise<{ customer: CustomerWithStats; orders: Order[] } | null> {
  const businessId = await requireBusinessId();
  const supabase = await createServerClient();

  const { data: customer } = await supabase
    .from('customers')
    .select('*')
    .eq('id', id)
    .eq('business_id', businessId)
    .maybeSingle();

  if (!customer) return null;

  const { data: orders } = await supabase
    .from('orders')
    .select('*')
    .eq('business_id', businessId)
    .eq('customer_id', id)
    .order('delivery_date', { ascending: false });

  const billable = (orders || []).filter((o) =>
    REVENUE_ORDER_STATUSES.includes(o.status)
  );
  const total = round2(billable.reduce((sum, o) => sum + Number(o.subtotal || 0), 0));

  return {
    customer: {
      ...(customer as Customer),
      orders_count: billable.length,
      total_spent: total,
      average_ticket: billable.length ? round2(total / billable.length) : 0,
      last_order_date: billable[0]?.delivery_date ?? null,
    },
    orders: (orders as Order[]) || [],
  };
}

export async function createCustomer(
  input: CreateCustomerInput
): Promise<{ success: boolean; customer?: Customer; error?: string }> {
  if (!input.first_name?.trim()) {
    return { success: false, error: 'El nombre es obligatorio.' };
  }

  const businessId = await requireBusinessId();
  const supabase = await createServerClient();

  const { data, error } = await supabase
    .from('customers')
    .insert({
      business_id: businessId,
      first_name: input.first_name.trim(),
      last_name: input.last_name?.trim() || null,
      phone: input.phone?.trim() || null,
      email: input.email?.trim() || null,
      instagram: normalizeInstagram(input.instagram),
      address: input.address?.trim() || null,
      notes: input.notes?.trim() || null,
    })
    .select()
    .single();

  if (error || !data) return { success: false, error: 'No se pudo crear el cliente.' };

  revalidatePath('/admin/clientes');
  return { success: true, customer: data as Customer };
}

export async function updateCustomer(
  id: string,
  input: UpdateCustomerInput
): Promise<{ success: boolean; error?: string }> {
  const businessId = await requireBusinessId();
  const supabase = await createServerClient();

  const { error } = await supabase
    .from('customers')
    .update({
      ...input,
      instagram: input.instagram !== undefined ? normalizeInstagram(input.instagram) : undefined,
    })
    .eq('id', id)
    .eq('business_id', businessId);

  if (error) return { success: false, error: 'No se pudo actualizar el cliente.' };

  revalidatePath('/admin/clientes');
  revalidatePath(`/admin/clientes/${id}`);
  return { success: true };
}

export async function deleteCustomer(id: string): Promise<{ success: boolean; error?: string }> {
  const businessId = await requireBusinessId();
  const supabase = await createServerClient();

  const { error } = await supabase
    .from('customers')
    .delete()
    .eq('id', id)
    .eq('business_id', businessId);

  if (error) return { success: false, error: 'No se pudo eliminar el cliente.' };

  revalidatePath('/admin/clientes');
  return { success: true };
}

/**
 * Busca un cliente por teléfono o email y, si no existe, lo crea.
 * Es lo que hace que un pedido cargado a mano quede asociado al CRM sin
 * que el usuario tenga que dar de alta al cliente primero.
 */
export async function findOrCreateCustomer(
  businessId: string,
  data: { contact_name: string; phone?: string | null; email?: string | null; address?: string | null }
): Promise<string | null> {
  const supabase = await createServerClient();
  const name = data.contact_name.trim();
  if (!name) return null;

  const filters: string[] = [];
  if (data.phone?.trim()) filters.push(`phone.eq.${data.phone.trim()}`);
  if (data.email?.trim()) filters.push(`email.eq.${data.email.trim()}`);

  if (filters.length > 0) {
    const { data: existing } = await supabase
      .from('customers')
      .select('id')
      .eq('business_id', businessId)
      .or(filters.join(','))
      .limit(1)
      .maybeSingle();
    if (existing) return existing.id;
  }

  const { data: byName } = await supabase
    .from('customers')
    .select('id')
    .eq('business_id', businessId)
    .ilike('full_name', name)
    .limit(1)
    .maybeSingle();
  if (byName) return byName.id;

  const [firstName, ...rest] = name.split(' ');
  const { data: created } = await supabase
    .from('customers')
    .insert({
      business_id: businessId,
      first_name: firstName,
      last_name: rest.join(' ') || null,
      phone: data.phone?.trim() || null,
      email: data.email?.trim() || null,
      address: data.address?.trim() || null,
    })
    .select('id')
    .single();

  return created?.id ?? null;
}

/** Guarda handles de Instagram de forma consistente: sin @ ni URL. */
function normalizeInstagram(value?: string | null): string | null {
  if (!value?.trim()) return null;
  return value
    .trim()
    .replace(/^https?:\/\/(www\.)?instagram\.com\//i, '')
    .replace(/^@/, '')
    .replace(/\/$/, '');
}
