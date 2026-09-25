import Link from 'next/link';
import {
  AlertTriangle,
  ArrowRight,
  CalendarClock,
  ClipboardList,
  Info,
  PiggyBank,
  Receipt,
  TrendingUp,
  Truck,
  Wallet,
} from 'lucide-react';
import { getDashboardData } from '@/actions/dashboard';
import { getCurrentBusiness } from '@/lib/business';
import { StatCard } from '@/components/ui/stat-card';
import { EmptyState } from '@/components/ui/empty-state';
import { OrderStatusBadge } from '@/components/admin/orders/order-status-badge';
import { TimeBars } from '@/components/charts/time-bars';
import { RankingBars } from '@/components/charts/ranking-bars';
import { cn, formatDateLong, formatPrice, todayISO } from '@/lib/utils';
import type { DashboardAlert } from '@/types';

export const metadata = { title: 'Dashboard' };

export default async function DashboardPage() {
  const [business, data] = await Promise.all([getCurrentBusiness(), getDashboardData()]);

  const money = (value: number) =>
    formatPrice(value, { currency: business?.currency, locale: business?.locale });

  const today = todayISO();

  return (
    <div className="space-y-8">
      <div>
        <p className="text-sm text-stone-500">{capitalize(formatDateLong(today, business?.locale))}</p>
        <h1 className="mt-0.5 text-2xl font-semibold tracking-tight text-stone-900">
          {business ? `Hola, ${business.name}` : 'Dashboard'}
        </h1>
        <p className="mt-1 text-sm text-stone-500">
          Todo lo que está pasando hoy en tu negocio, en una pantalla.
        </p>
      </div>

      {/* ---------- Hoy ---------- */}
      <section className="space-y-3">
        <SectionTitle>Resumen de hoy</SectionTitle>
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-3 xl:grid-cols-6">
          <StatCard
            label="Pedidos de hoy"
            value={String(data.today.orders_count)}
            icon={ClipboardList}
            href="/admin/pedidos"
          />
          <StatCard
            label="Facturación"
            value={money(data.today.revenue)}
            icon={Wallet}
            accent="positive"
          />
          <StatCard label="Gastos del día" value={money(data.today.expenses)} icon={Receipt} />
          <StatCard
            label="Ganancia estimada"
            value={money(data.today.profit)}
            icon={PiggyBank}
            accent={data.today.profit >= 0 ? 'positive' : 'negative'}
            hint={`${money(data.today.revenue)} − ${money(data.today.expenses)}`}
          />
          <StatCard
            label="Pedidos pendientes"
            value={String(data.today.pending_orders)}
            icon={CalendarClock}
            accent={data.today.pending_orders > 0 ? 'warning' : 'default'}
            href="/admin/pedidos?estado=pending"
          />
          <StatCard
            label="A entregar hoy"
            value={String(data.today.deliveries_today)}
            icon={Truck}
            href="/admin/calendario"
          />
        </div>
      </section>

      {/* ---------- Alertas ---------- */}
      {data.alerts.length > 0 && (
        <section className="space-y-3">
          <SectionTitle>Necesita tu atención</SectionTitle>
          <div className="grid gap-2 sm:grid-cols-2">
            {data.alerts.map((alert, index) => (
              <AlertRow key={`${alert.kind}-${index}`} alert={alert} />
            ))}
          </div>
        </section>
      )}

      <div className="grid gap-6 lg:grid-cols-3">
        {/* ---------- Próximas entregas ---------- */}
        <section className="surface lg:col-span-2">
          <header className="flex items-center justify-between border-b border-stone-200 px-5 py-4">
            <h2 className="text-sm font-semibold text-stone-900">Próximas entregas</h2>
            <Link
              href="/admin/calendario"
              className="inline-flex items-center gap-1 text-sm text-stone-500 transition-colors hover:text-stone-900"
            >
              Ver calendario <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </header>

          {data.upcoming.length === 0 ? (
            <EmptyState
              icon={CalendarClock}
              title="No hay entregas programadas"
              description="Cuando cargues un pedido con fecha de entrega va a aparecer acá."
              actionLabel="Cargar un pedido"
              actionHref="/admin/pedidos/nuevo"
            />
          ) : (
            <ul className="divide-y divide-stone-100">
              {data.upcoming.map((delivery) => (
                <li key={delivery.id}>
                  <Link
                    href={`/admin/pedidos/${delivery.id}`}
                    className="flex items-center gap-4 px-5 py-3 transition-colors hover:bg-stone-50"
                  >
                    <div className="w-16 shrink-0 text-center">
                      <p className="text-sm font-semibold tabular text-stone-900">
                        {delivery.delivery_time || '—'}
                      </p>
                      <p className="text-[11px] uppercase tracking-wide text-stone-400">
                        {delivery.delivery_date === today
                          ? 'hoy'
                          : shortDate(delivery.delivery_date, business?.locale)}
                      </p>
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium text-stone-900">
                        {delivery.summary}
                      </p>
                      <p className="truncate text-xs text-stone-500">{delivery.customer_name}</p>
                    </div>
                    <div className="hidden shrink-0 text-right sm:block">
                      <p className="text-sm font-semibold tabular text-stone-900">
                        {money(delivery.total)}
                      </p>
                    </div>
                    <OrderStatusBadge status={delivery.status} className="shrink-0" />
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>

        {/* ---------- Mes ---------- */}
        <section className="surface self-start">
          <header className="border-b border-stone-200 px-5 py-4">
            <h2 className="text-sm font-semibold text-stone-900">Resumen del mes</h2>
          </header>
          <dl className="divide-y divide-stone-100">
            <MonthRow label="Facturación" value={money(data.month.revenue)} strong />
            <MonthRow label="Gastos" value={money(data.month.expenses)} />
            <MonthRow
              label="Ganancia estimada"
              value={money(data.month.profit)}
              accent={data.month.profit >= 0 ? 'positive' : 'negative'}
              strong
            />
            <MonthRow label="Margen" value={`${data.month.margin_pct}%`} />
            <MonthRow label="Pedidos" value={String(data.month.orders_count)} />
            <MonthRow label="Ticket promedio" value={money(data.month.average_ticket)} />
          </dl>
          <p className="px-5 pb-3 pt-3 text-xs leading-snug text-stone-400">
            Ganancia estimada = facturación − gastos registrados. El costo de producción se mide
            aparte, en Estadísticas, para no contarlo dos veces.
          </p>
          <div className="border-t border-stone-200 px-5 py-3">
            <Link
              href="/admin/estadisticas"
              className="inline-flex items-center gap-1 text-sm text-stone-500 transition-colors hover:text-stone-900"
            >
              Ver estadísticas completas <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </div>
        </section>
      </div>

      {/* ---------- Gráficos ---------- */}
      <div className="grid gap-6 lg:grid-cols-3">
        <section className="surface p-5 lg:col-span-2">
          <header className="mb-4 flex items-center gap-2">
            <TrendingUp className="h-4 w-4 text-stone-400" />
            <h2 className="text-sm font-semibold text-stone-900">
              Facturación y gastos · últimos 30 días
            </h2>
          </header>
          <TimeBars data={data.revenue_series} showExpenses height={190} />
        </section>

        <section className="surface p-5">
          <h2 className="mb-4 text-sm font-semibold text-stone-900">
            Más vendidos · últimos 30 días
          </h2>
          <RankingBars
            items={data.top_products}
            secondaryLabel="u."
            emptyMessage="Todavía no hay ventas registradas."
          />
        </section>
      </div>
    </div>
  );
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <h2 className="text-[11px] font-semibold uppercase tracking-wider text-stone-400">{children}</h2>
  );
}

function MonthRow({
  label,
  value,
  accent,
  strong,
}: {
  label: string;
  value: string;
  accent?: 'positive' | 'negative';
  strong?: boolean;
}) {
  return (
    <div className="flex items-center justify-between px-5 py-2.5">
      <dt className="text-sm text-stone-500">{label}</dt>
      <dd
        className={cn(
          'text-sm tabular',
          strong ? 'font-semibold' : 'font-medium',
          accent === 'positive' && 'text-brand-700',
          accent === 'negative' && 'text-rose-600',
          !accent && 'text-stone-900'
        )}
      >
        {value}
      </dd>
    </div>
  );
}

const ALERT_STYLES = {
  critical: { box: 'border-rose-200 bg-rose-50', icon: 'text-rose-600', Icon: AlertTriangle },
  warning: { box: 'border-amber-200 bg-amber-50', icon: 'text-amber-600', Icon: AlertTriangle },
  info: { box: 'border-sky-200 bg-sky-50', icon: 'text-sky-600', Icon: Info },
} as const;

function AlertRow({ alert }: { alert: DashboardAlert }) {
  const style = ALERT_STYLES[alert.severity];
  return (
    <Link
      href={alert.href}
      className={cn(
        'flex items-center gap-3 rounded-xl border px-4 py-3 transition-shadow hover:shadow-card',
        style.box
      )}
    >
      <style.Icon className={cn('h-4 w-4 shrink-0', style.icon)} />
      <span className="min-w-0 flex-1 truncate text-sm text-stone-800">{alert.message}</span>
      <ArrowRight className="h-3.5 w-3.5 shrink-0 text-stone-400" />
    </Link>
  );
}

function capitalize(value: string): string {
  return value.charAt(0).toUpperCase() + value.slice(1);
}

function shortDate(date: string, locale?: string): string {
  const [, month, day] = date.split('-');
  return new Intl.DateTimeFormat(locale || 'es-AR', { day: 'numeric', month: 'short' })
    .format(new Date(Number(date.slice(0, 4)), Number(month) - 1, Number(day), 12))
    .replace('.', '');
}
