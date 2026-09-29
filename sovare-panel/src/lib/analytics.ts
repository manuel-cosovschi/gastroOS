import { createServerClient } from '@/lib/supabase/server';
import { monthStart } from '@/lib/utils';
import type { Activity, Client, Payment } from '@/types';

/**
 * Números del panel.
 *
 * Se resuelve todo en una sola pasada y en el servidor: el volumen es de
 * decenas de filas, así que traerlas enteras y agrupar en memoria sale más
 * barato —y mucho más legible— que seis consultas agregadas.
 *
 * Dos convenciones que conviene tener presentes al leer los números:
 *
 * - El **ingreso recurrente** sale de la ficha del cliente (lo que debería
 *   facturar), no de los cobros emitidos. Son cosas distintas: si un mes no
 *   generaste los cobros, el recurrente no baja.
 * - Lo **cobrado** cuenta por período, no por fecha de pago. Un cobro de
 *   septiembre pagado en octubre suma a septiembre, que es el mes al que
 *   corresponde.
 */

export interface UpcomingPayment extends Payment {
  client: Pick<Client, 'id' | 'business_name'> | null;
}

export interface PendingStep extends Activity {
  client: Pick<Client, 'id' | 'business_name'> | null;
}

export interface DashboardData {
  mrr: number;
  counts: Record<string, number>;
  month: {
    period: string;
    charged: number;
    collected: number;
    pending: number;
    overdue: number;
    overdueCount: number;
  };
  series: { label: string; period: string; collected: number; charged: number }[];
  upcoming: UpcomingPayment[];
  overdue: UpcomingPayment[];
  steps: PendingStep[];
  recent: Client[];
  /** Contrataciones que entraron por la página y esperan una decisión. */
  signupsToReview: number;
}

const MONTHS_BACK = 6;

export async function getDashboardData(): Promise<DashboardData> {
  const supabase = await createServerClient();
  const today = new Date().toISOString().slice(0, 10);
  const period = monthStart();

  const since = new Date();
  since.setMonth(since.getMonth() - (MONTHS_BACK - 1));
  const seriesFrom = monthStart(since);

  const [clientsResult, paymentsResult, stepsResult, signupsResult] = await Promise.all([
    supabase.from('clients').select('*').order('created_at', { ascending: false }),
    supabase.from('payments').select('*').gte('period', seriesFrom),
    supabase
      .from('activities')
      .select('*, client:clients(id, business_name)')
      .not('next_step_at', 'is', null)
      .order('next_step_at', { ascending: true })
      .limit(8),
    supabase.from('signups').select('id', { count: 'exact', head: true }).eq('status', 'en_revision'),
  ]);

  const clients = (clientsResult.data ?? []) as Client[];
  const payments = (paymentsResult.data ?? []) as Payment[];
  const byClient = new Map(clients.map((client) => [client.id, client]));

  const counts: Record<string, number> = {};
  for (const client of clients) counts[client.status] = (counts[client.status] ?? 0) + 1;

  const mrr = clients
    .filter((client) => client.status === 'activo')
    .reduce((total, client) => total + (client.monthly_amount ?? 0), 0);

  // --- Mes en curso ---
  const live = payments.filter((payment) => payment.status !== 'anulado');
  const thisMonth = live.filter((payment) => payment.period === period);

  const sum = (rows: Payment[]) => rows.reduce((total, row) => total + Number(row.amount), 0);

  const collected = sum(thisMonth.filter((payment) => payment.status === 'pagado'));
  const charged = sum(thisMonth);

  // "Vencido" se calcula por fecha, no por el estado guardado: nadie va a
  // entrar todos los días a marcar los que vencieron.
  const isOverdue = (payment: Payment) => payment.status !== 'pagado' && payment.due_date < today;
  const overdueRows = live.filter(isOverdue);

  // --- Serie por mes ---
  const series: DashboardData['series'] = [];
  for (let index = MONTHS_BACK - 1; index >= 0; index -= 1) {
    const date = new Date();
    date.setMonth(date.getMonth() - index);
    const key = monthStart(date);
    const rows = live.filter((payment) => payment.period === key);
    series.push({
      period: key,
      label: new Intl.DateTimeFormat('es-AR', { month: 'short' }).format(date),
      collected: sum(rows.filter((payment) => payment.status === 'pagado')),
      charged: sum(rows),
    });
  }

  const withClient = (payment: Payment): UpcomingPayment => {
    const client = byClient.get(payment.client_id);
    return {
      ...payment,
      client: client ? { id: client.id, business_name: client.business_name } : null,
    };
  };

  const upcoming = live
    .filter((payment) => payment.status !== 'pagado' && payment.due_date >= today)
    .sort((a, b) => a.due_date.localeCompare(b.due_date))
    .slice(0, 8)
    .map(withClient);

  const overdue = overdueRows
    .sort((a, b) => a.due_date.localeCompare(b.due_date))
    .map(withClient);

  return {
    mrr,
    counts,
    month: {
      period,
      charged,
      collected,
      pending: charged - collected,
      overdue: sum(overdueRows),
      overdueCount: overdueRows.length,
    },
    signupsToReview: signupsResult.count ?? 0,
    series,
    upcoming,
    overdue,
    steps: (stepsResult.data ?? []) as PendingStep[],
    recent: clients.slice(0, 5),
  };
}
