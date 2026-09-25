'use server';

import { createServerClient } from '@/lib/supabase/server';
import { requireBusiness } from '@/lib/business';
import {
  buildDailySeries,
  fetchExpensesInRange,
  fetchOrdersInRange,
  summarize,
  topProducts,
} from '@/lib/analytics';
import { generateStockAlerts } from '@/actions/inventory';
import { addDays, endOfMonth, formatPrice, formatTime, startOfMonth, toISODate, todayISO } from '@/lib/utils';
import { OPEN_ORDER_STATUSES } from '@/types';
import type { DashboardAlert, DashboardData, UpcomingDelivery } from '@/types';

/**
 * Todo lo que se ve en el dashboard, en una sola llamada.
 * Los bloques independientes se piden en paralelo: la pantalla es la primera
 * que se abre cada mañana y no tiene que hacer esperar.
 */
export async function getDashboardData(): Promise<DashboardData> {
  const business = await requireBusiness();
  const supabase = await createServerClient();

  const today = todayISO();
  const monthRange = { from: toISODate(startOfMonth()), to: toISODate(endOfMonth()) };
  const last30 = { from: toISODate(addDays(new Date(), -29)), to: today };
  const nextWeek = toISODate(addDays(new Date(), 7));

  const [
    todayOrders,
    todayExpenses,
    monthOrders,
    monthExpenses,
    seriesOrders,
    seriesExpenses,
    pendingCount,
    upcomingRows,
    stockAlerts,
    depositRows,
    products,
  ] = await Promise.all([
    fetchOrdersInRange(business.id, { from: today, to: today }),
    fetchExpensesInRange(business.id, { from: today, to: today }),
    fetchOrdersInRange(business.id, monthRange),
    fetchExpensesInRange(business.id, monthRange),
    fetchOrdersInRange(business.id, last30),
    fetchExpensesInRange(business.id, last30),
    supabase
      .from('orders')
      .select('id', { count: 'exact', head: true })
      .eq('business_id', business.id)
      .eq('status', 'pending'),
    supabase
      .from('orders')
      .select('id, order_number, delivery_date, delivery_time, contact_name, status, subtotal')
      .eq('business_id', business.id)
      .in('status', OPEN_ORDER_STATUSES)
      .gte('delivery_date', today)
      .order('delivery_date', { ascending: true })
      .order('delivery_time', { ascending: true, nullsFirst: false })
      .limit(8),
    generateStockAlerts(business.id),
    supabase
      .from('orders')
      .select('id', { count: 'exact', head: true })
      .eq('business_id', business.id)
      .in('status', OPEN_ORDER_STATUSES)
      .eq('deposit_amount', 0),
    topProducts(business.id, last30, 5),
  ]);

  const upcomingIds = (upcomingRows.data || []).map((o) => o.id);
  const itemsByOrder = await summarizeItems(upcomingIds);

  const upcoming: UpcomingDelivery[] = (upcomingRows.data || []).map((order) => ({
    id: order.id,
    order_number: order.order_number,
    delivery_date: order.delivery_date,
    delivery_time: formatTime(order.delivery_time) || null,
    customer_name: order.contact_name,
    summary: itemsByOrder.get(order.id) || 'Sin detalle',
    status: order.status,
    total: Number(order.subtotal || 0),
  }));

  const deliveriesToday = upcoming.filter((o) => o.delivery_date === today).length;
  const deliveriesTomorrow = upcoming.filter(
    (o) => o.delivery_date === toISODate(addDays(new Date(), 1))
  ).length;

  // Pedidos abiertos de acá a una semana, para el aviso de carga de trabajo
  const upcomingWeek = upcoming.filter((o) => o.delivery_date <= nextWeek).length;

  return {
    today: {
      ...summarize(todayOrders, todayExpenses),
      pending_orders: pendingCount.count || 0,
      deliveries_today: deliveriesToday,
    },
    month: summarize(monthOrders, monthExpenses),
    upcoming,
    alerts: buildAlerts({
      stockAlerts,
      pendingDeposits: depositRows.count || 0,
      deliveriesTomorrow,
      upcomingWeek,
      currency: business.currency,
      locale: business.locale,
    }),
    revenue_series: buildDailySeries(last30, seriesOrders, seriesExpenses, business.locale),
    top_products: products,
  };
}

/** Resumen textual de los items de cada pedido ("Torta Red Velvet × 1, Cookies × 6"). */
async function summarizeItems(orderIds: string[]): Promise<Map<string, string>> {
  const result = new Map<string, string>();
  if (orderIds.length === 0) return result;

  const supabase = await createServerClient();
  const { data } = await supabase
    .from('order_items')
    .select('order_id, item_name, quantity')
    .in('order_id', orderIds);

  for (const item of data || []) {
    const previous = result.get(item.order_id);
    const label = item.quantity > 1 ? `${item.item_name} × ${item.quantity}` : item.item_name;
    result.set(item.order_id, previous ? `${previous}, ${label}` : label);
  }

  return result;
}

interface AlertContext {
  stockAlerts: { severity: 'warning' | 'critical'; message: string; type: string }[];
  pendingDeposits: number;
  deliveriesTomorrow: number;
  upcomingWeek: number;
  currency: string;
  locale: string;
}

/**
 * Las alertas están ordenadas por lo que hace perder plata primero:
 * stock que frena la producción, después señas sin cobrar, después agenda.
 */
function buildAlerts(context: AlertContext): DashboardAlert[] {
  const alerts: DashboardAlert[] = [];

  const stock = context.stockAlerts
    .filter((alert) => alert.type !== 'missing_recipe')
    .sort((a) => (a.severity === 'critical' ? -1 : 1))
    .slice(0, 4);

  for (const alert of stock) {
    alerts.push({
      kind: 'stock',
      severity: alert.severity,
      message: alert.message,
      href: '/admin/stock',
    });
  }

  if (context.pendingDeposits > 0) {
    alerts.push({
      kind: 'deposit',
      severity: 'warning',
      message: `${context.pendingDeposits} ${context.pendingDeposits === 1 ? 'pedido abierto sin seña' : 'pedidos abiertos sin seña'}`,
      href: '/admin/pedidos',
    });
  }

  if (context.deliveriesTomorrow > 0) {
    alerts.push({
      kind: 'delivery',
      severity: 'info',
      message: `${context.deliveriesTomorrow} ${context.deliveriesTomorrow === 1 ? 'entrega' : 'entregas'} para mañana`,
      href: '/admin/calendario',
    });
  }

  return alerts;
}

/** Usado por el encabezado del dashboard para mostrar el importe del día. */
export async function formatBusinessPrice(value: number): Promise<string> {
  const business = await requireBusiness();
  return formatPrice(value, { currency: business.currency, locale: business.locale });
}
