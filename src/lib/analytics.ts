import { createServerClient } from '@/lib/supabase/server';
import { addDays, parseDateOnly, round2, toISODate } from '@/lib/utils';
import { REVENUE_ORDER_STATUSES } from '@/types';
import type { PeriodSummary, RankedItem, TimeSeriesPoint } from '@/types';

/**
 * Motor de métricas. Lo comparten el dashboard y la sección de estadísticas
 * para que los dos muestren siempre el mismo número.
 *
 * Dos convenciones que vale la pena tener presentes:
 *
 * 1. La facturación se imputa a la **fecha de entrega**, no a la fecha de carga.
 *    Un negocio por pedidos cobra cuando entrega, así que "facturación de hoy"
 *    significa lo que se entrega hoy.
 *
 * 2. La ganancia es `facturación − gastos registrados` (plata que entra menos
 *    plata que sale). El costo de producción se muestra aparte como margen
 *    bruto: sumar los dos contaría dos veces la compra de insumos.
 */

export interface DateRange {
  from: string;
  to: string;
}

interface OrderRow {
  id: string;
  subtotal: number;
  production_cost: number | null;
  delivery_date: string;
  status: string;
  customer_id: string | null;
  contact_name: string;
}

export async function fetchOrdersInRange(
  businessId: string,
  range: DateRange
): Promise<OrderRow[]> {
  const supabase = await createServerClient();
  const { data } = await supabase
    .from('orders')
    .select('id, subtotal, production_cost, delivery_date, status, customer_id, contact_name')
    .eq('business_id', businessId)
    .in('status', REVENUE_ORDER_STATUSES)
    .gte('delivery_date', range.from)
    .lte('delivery_date', range.to);
  return (data as OrderRow[]) || [];
}

export async function fetchExpensesInRange(
  businessId: string,
  range: DateRange
): Promise<{ amount: number; expense_date: string; category_id: string | null }[]> {
  const supabase = await createServerClient();
  const { data } = await supabase
    .from('expenses')
    .select('amount, expense_date, category_id')
    .eq('business_id', businessId)
    .gte('expense_date', range.from)
    .lte('expense_date', range.to);
  return data || [];
}

export function summarize(
  orders: { subtotal: number; production_cost: number | null }[],
  expenses: { amount: number }[]
): PeriodSummary {
  const revenue = round2(orders.reduce((sum, o) => sum + Number(o.subtotal || 0), 0));
  const productionCost = round2(
    orders.reduce((sum, o) => sum + Number(o.production_cost || 0), 0)
  );
  const totalExpenses = round2(expenses.reduce((sum, e) => sum + Number(e.amount || 0), 0));
  const profit = round2(revenue - totalExpenses);

  return {
    revenue,
    expenses: totalExpenses,
    production_cost: productionCost,
    profit,
    margin_pct: revenue > 0 ? Math.round((profit / revenue) * 1000) / 10 : 0,
    orders_count: orders.length,
    average_ticket: orders.length > 0 ? round2(revenue / orders.length) : 0,
  };
}

/** Serie diaria de facturación / gastos / pedidos, sin huecos. */
export function buildDailySeries(
  range: DateRange,
  orders: { subtotal: number; delivery_date: string }[],
  expenses: { amount: number; expense_date: string }[],
  locale = 'es-AR'
): TimeSeriesPoint[] {
  const points = new Map<string, TimeSeriesPoint>();
  const formatter = new Intl.DateTimeFormat(locale, { day: '2-digit', month: 'short' });
  // El eje sólo muestra el número de día: con 30 puntos no entra nada más.
  const dayFormatter = new Intl.DateTimeFormat(locale, { day: 'numeric' });

  const start = parseDateOnly(range.from);
  const end = parseDateOnly(range.to);

  for (let day = start; day <= end; day = addDays(day, 1)) {
    const key = toISODate(day);
    points.set(key, {
      date: key,
      label: formatter.format(day).replace('.', ''),
      short: dayFormatter.format(day),
      revenue: 0,
      expenses: 0,
      orders: 0,
    });
  }

  for (const order of orders) {
    const point = points.get(order.delivery_date);
    if (!point) continue;
    point.revenue = round2(point.revenue + Number(order.subtotal || 0));
    point.orders += 1;
  }

  for (const expense of expenses) {
    const point = points.get(expense.expense_date);
    if (!point) continue;
    point.expenses = round2((point.expenses || 0) + Number(expense.amount || 0));
  }

  return Array.from(points.values());
}

/** Productos más vendidos en el período, por facturación. */
export async function topProducts(
  businessId: string,
  range: DateRange,
  limit = 5
): Promise<RankedItem[]> {
  const orders = await fetchOrdersInRange(businessId, range);
  if (orders.length === 0) return [];

  const supabase = await createServerClient();
  const { data: items } = await supabase
    .from('order_items')
    .select('item_name, quantity, subtotal, order_id')
    .in(
      'order_id',
      orders.map((o) => o.id)
    );

  const totals = new Map<string, { revenue: number; units: number }>();
  for (const item of items || []) {
    const current = totals.get(item.item_name) || { revenue: 0, units: 0 };
    current.revenue += Number(item.subtotal || 0);
    current.units += Number(item.quantity || 0);
    totals.set(item.item_name, current);
  }

  return Array.from(totals.entries())
    .map(([label, value]) => ({
      id: label,
      label,
      value: round2(value.revenue),
      secondary: value.units,
    }))
    .sort((a, b) => b.value - a.value)
    .slice(0, limit);
}

/** Facturación agrupada por categoría de producto. */
export async function salesByCategory(
  businessId: string,
  range: DateRange
): Promise<RankedItem[]> {
  const orders = await fetchOrdersInRange(businessId, range);
  if (orders.length === 0) return [];

  const supabase = await createServerClient();
  const [{ data: items }, { data: products }] = await Promise.all([
    supabase
      .from('order_items')
      .select('product_id, subtotal')
      .in(
        'order_id',
        orders.map((o) => o.id)
      ),
    supabase
      .from('products')
      .select('id, category:categories(id, name)')
      .eq('business_id', businessId),
  ]);

  const categoryByProduct = new Map<string, { id: string; name: string }>();
  for (const product of products || []) {
    const category = product.category as unknown as { id: string; name: string } | null;
    if (category) categoryByProduct.set(product.id, category);
  }

  const totals = new Map<string, { label: string; value: number }>();
  for (const item of items || []) {
    const category = item.product_id ? categoryByProduct.get(item.product_id) : null;
    const key = category?.id || 'sin-categoria';
    const label = category?.name || 'Combos y otros';
    const current = totals.get(key) || { label, value: 0 };
    current.value += Number(item.subtotal || 0);
    totals.set(key, current);
  }

  return Array.from(totals.entries())
    .map(([id, value]) => ({ id, label: value.label, value: round2(value.value) }))
    .sort((a, b) => b.value - a.value);
}

/** Clientes que más gastaron en el período. */
export async function topCustomers(
  businessId: string,
  range: DateRange,
  limit = 5
): Promise<RankedItem[]> {
  const orders = await fetchOrdersInRange(businessId, range);

  const totals = new Map<string, { label: string; value: number; orders: number }>();
  for (const order of orders) {
    const key = order.customer_id || order.contact_name;
    const current = totals.get(key) || { label: order.contact_name, value: 0, orders: 0 };
    current.value += Number(order.subtotal || 0);
    current.orders += 1;
    totals.set(key, current);
  }

  return Array.from(totals.entries())
    .map(([id, value]) => ({
      id,
      label: value.label,
      value: round2(value.value),
      secondary: value.orders,
    }))
    .sort((a, b) => b.value - a.value)
    .slice(0, limit);
}

/** Gastos agrupados por categoría. */
export async function expensesByCategory(
  businessId: string,
  range: DateRange
): Promise<RankedItem[]> {
  const supabase = await createServerClient();

  const [{ data: expenses }, { data: categories }] = await Promise.all([
    supabase
      .from('expenses')
      .select('amount, category_id')
      .eq('business_id', businessId)
      .gte('expense_date', range.from)
      .lte('expense_date', range.to),
    supabase.from('expense_categories').select('id, name, color').eq('business_id', businessId),
  ]);

  const nameById = new Map((categories || []).map((c) => [c.id, c.name]));

  const totals = new Map<string, { label: string; value: number }>();
  for (const expense of expenses || []) {
    const key = expense.category_id || 'sin-categoria';
    const label = expense.category_id ? nameById.get(expense.category_id) || 'Sin categoría' : 'Sin categoría';
    const current = totals.get(key) || { label, value: 0 };
    current.value += Number(expense.amount || 0);
    totals.set(key, current);
  }

  return Array.from(totals.entries())
    .map(([id, value]) => ({ id, label: value.label, value: round2(value.value) }))
    .sort((a, b) => b.value - a.value);
}

/** Rango del período inmediatamente anterior, de la misma duración. */
export function previousRange(range: DateRange): DateRange {
  const from = parseDateOnly(range.from);
  const to = parseDateOnly(range.to);
  const days = Math.max(1, Math.round((to.getTime() - from.getTime()) / 86_400_000) + 1);
  return {
    from: toISODate(addDays(from, -days)),
    to: toISODate(addDays(to, -days)),
  };
}
