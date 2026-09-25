'use server';

import { createServerClient } from '@/lib/supabase/server';
import { requireBusiness } from '@/lib/business';
import {
  buildDailySeries,
  expensesByCategory,
  fetchExpensesInRange,
  fetchOrdersInRange,
  previousRange,
  salesByCategory,
  summarize,
  topCustomers,
  topProducts,
  type DateRange,
} from '@/lib/analytics';
import { addDays, endOfMonth, startOfMonth, toISODate, todayISO } from '@/lib/utils';
import { ORDER_STATUS_LABELS, ORDER_STATUSES } from '@/types';
import type { CalendarOrder, RankedItem, StatsData, StatsRange } from '@/types';

/** Traduce el filtro de la UI a un rango de fechas concreto. */
export async function resolveRange(
  range: StatsRange,
  custom?: { from: string; to: string }
): Promise<DateRange> {
  const today = todayISO();

  switch (range) {
    case 'today':
      return { from: today, to: today };
    case 'last_7':
      return { from: toISODate(addDays(new Date(), -6)), to: today };
    case 'last_30':
      return { from: toISODate(addDays(new Date(), -29)), to: today };
    case 'this_month':
      return { from: toISODate(startOfMonth()), to: toISODate(endOfMonth()) };
    case 'last_month': {
      const reference = new Date();
      reference.setMonth(reference.getMonth() - 1);
      return { from: toISODate(startOfMonth(reference)), to: toISODate(endOfMonth(reference)) };
    }
    case 'custom':
      return {
        from: custom?.from || toISODate(addDays(new Date(), -29)),
        to: custom?.to || today,
      };
  }
}

export async function getStats(
  range: StatsRange,
  custom?: { from: string; to: string }
): Promise<StatsData> {
  const business = await requireBusiness();
  const resolved = await resolveRange(range, custom);
  const previous = previousRange(resolved);

  const [
    orders,
    expenses,
    prevOrders,
    prevExpenses,
    products,
    customers,
    byCategory,
    byExpenseCategory,
    statusCounts,
  ] = await Promise.all([
    fetchOrdersInRange(business.id, resolved),
    fetchExpensesInRange(business.id, resolved),
    fetchOrdersInRange(business.id, previous),
    fetchExpensesInRange(business.id, previous),
    topProducts(business.id, resolved, 8),
    topCustomers(business.id, resolved, 8),
    salesByCategory(business.id, resolved),
    expensesByCategory(business.id, resolved),
    countOrdersByStatus(business.id, resolved),
  ]);

  return {
    range: resolved,
    summary: summarize(orders, expenses),
    previous: summarize(prevOrders, prevExpenses),
    revenue_series: buildDailySeries(resolved, orders, expenses, business.locale),
    orders_by_status: statusCounts,
    top_products: products,
    top_customers: customers,
    sales_by_category: byCategory,
    expenses_by_category: byExpenseCategory,
  };
}

async function countOrdersByStatus(businessId: string, range: DateRange): Promise<RankedItem[]> {
  const supabase = await createServerClient();
  const { data } = await supabase
    .from('orders')
    .select('status')
    .eq('business_id', businessId)
    .gte('delivery_date', range.from)
    .lte('delivery_date', range.to);

  const counts = new Map<string, number>();
  for (const row of data || []) {
    counts.set(row.status, (counts.get(row.status) || 0) + 1);
  }

  return ORDER_STATUSES.filter((status) => counts.has(status)).map((status) => ({
    id: status,
    label: ORDER_STATUS_LABELS[status],
    value: counts.get(status) || 0,
  }));
}

/** Pedidos de un mes, para pintar el calendario. */
export async function getCalendarOrders(year: number, month: number): Promise<CalendarOrder[]> {
  const business = await requireBusiness();
  const supabase = await createServerClient();

  const from = toISODate(new Date(year, month, 1));
  const to = toISODate(new Date(year, month + 1, 0));

  const { data } = await supabase
    .from('orders')
    .select('id, order_number, delivery_date, delivery_time, contact_name, status, subtotal')
    .eq('business_id', business.id)
    .gte('delivery_date', from)
    .lte('delivery_date', to)
    .order('delivery_date')
    .order('delivery_time', { ascending: true, nullsFirst: false });

  return (data || []).map((order) => ({
    id: order.id,
    order_number: order.order_number,
    delivery_date: order.delivery_date,
    delivery_time: order.delivery_time ? order.delivery_time.slice(0, 5) : null,
    customer_name: order.contact_name,
    status: order.status,
    total: Number(order.subtotal || 0),
  }));
}
