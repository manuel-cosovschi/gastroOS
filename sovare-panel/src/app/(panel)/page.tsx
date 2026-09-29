import Link from 'next/link';
import {
  AlertTriangle,
  ArrowRight,
  CalendarClock,
  CircleDollarSign,
  Clock,
  FileSignature,
  Repeat,
  Users,
  Wallet,
} from 'lucide-react';
import { getDashboardData } from '@/lib/analytics';
import { Badge, EmptyState, SectionCard, StatCard } from '@/components/ui';
import { GenerateChargesButton } from '@/components/generate-charges';
import { CLIENT_STATUS_META, PAYMENT_STATUS_META } from '@/types';
import { cn, money, monthLabel, shortDate, todayISO } from '@/lib/utils';

export const metadata = { title: 'Resumen' };
export const dynamic = 'force-dynamic';

export default async function DashboardPage() {
  const data = await getDashboardData();
  const today = todayISO();
  const peak = Math.max(...data.series.map((point) => point.charged), 1);

  return (
    <div className="space-y-8">
      <div>
        <p className="text-sm text-stone-500">{monthLabel(data.month.period)}</p>
        <h1 className="mt-0.5 text-2xl font-semibold tracking-tight text-stone-900">
          Cómo viene el negocio
        </h1>
      </div>

      {/* ---------- Números ---------- */}
      <section className="grid grid-cols-2 gap-3 lg:grid-cols-3 xl:grid-cols-6">
        <StatCard
          label="Ingreso recurrente"
          value={money(data.mrr)}
          icon={Repeat}
          accent="positive"
          hint="Suma de las mensualidades de los clientes activos"
        />
        <StatCard
          label="Clientes activos"
          value={String(data.counts.activo ?? 0)}
          icon={Users}
          href="/clientes?estado=activo"
        />
        <StatCard
          label="En implementación"
          value={String(data.counts.implementacion ?? 0)}
          icon={Clock}
          accent={data.counts.implementacion ? 'warning' : 'default'}
          href="/clientes?estado=implementacion"
        />
        <StatCard
          label="Prospectos"
          value={String(data.counts.prospecto ?? 0)}
          icon={Users}
          href="/clientes?estado=prospecto"
        />
        <StatCard
          label="Cobrado este mes"
          value={money(data.month.collected)}
          icon={Wallet}
          accent="positive"
          hint={`de ${money(data.month.charged)} emitidos`}
        />
        <StatCard
          label="Vencido sin cobrar"
          value={money(data.month.overdue)}
          icon={AlertTriangle}
          accent={data.month.overdue > 0 ? 'negative' : 'default'}
          hint={
            data.month.overdueCount
              ? `${data.month.overdueCount} ${data.month.overdueCount === 1 ? 'cobro' : 'cobros'}`
              : 'Nada vencido'
          }
          href="/cobros?estado=vencido"
        />
      </section>

      {/* ---------- Contrataciones esperando ---------- */}
      {data.signupsToReview > 0 && (
        <Link
          href="/contrataciones?estado=en_revision"
          className="flex items-center gap-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 transition-shadow hover:shadow-card"
        >
          <FileSignature className="h-4 w-4 shrink-0 text-amber-600" />
          <span className="min-w-0 flex-1 text-sm text-stone-800">
            {data.signupsToReview === 1
              ? 'Entró una contratación desde la página y el comprobante espera que lo mires.'
              : `Entraron ${data.signupsToReview} contrataciones desde la página con el comprobante sin revisar.`}
          </span>
          <ArrowRight className="h-3.5 w-3.5 shrink-0 text-stone-400" />
        </Link>
      )}

      {/* ---------- Vencidos ---------- */}
      {data.overdue.length > 0 && (
        <SectionCard title="Vencidos" className="border-rose-200">
          <ul className="divide-y divide-stone-100">
            {data.overdue.map((payment) => (
              <li key={payment.id}>
                <Link
                  href={`/clientes/${payment.client_id}`}
                  className="flex items-center gap-4 px-5 py-3 transition-colors hover:bg-stone-50"
                >
                  <AlertTriangle className="h-4 w-4 shrink-0 text-rose-500" />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-stone-900">
                      {payment.client?.business_name ?? 'Cliente eliminado'}
                    </p>
                    <p className="truncate text-xs text-stone-500">
                      {payment.concept} · venció el {shortDate(payment.due_date)}
                    </p>
                  </div>
                  <p className="shrink-0 text-sm font-semibold tabular text-rose-600">
                    {money(Number(payment.amount), payment.currency)}
                  </p>
                </Link>
              </li>
            ))}
          </ul>
        </SectionCard>
      )}

      <div className="grid gap-6 lg:grid-cols-3">
        {/* ---------- Próximos cobros ---------- */}
        <SectionCard
          title="Próximos cobros"
          className="lg:col-span-2"
          action={
            <Link
              href="/cobros"
              className="inline-flex items-center gap-1 text-sm text-stone-500 transition-colors hover:text-stone-900"
            >
              Ver todos <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          }
        >
          {data.upcoming.length === 0 ? (
            <EmptyState
              title="No hay cobros pendientes"
              description="Generá los del mes para los clientes activos y aparecen acá con su vencimiento."
              action={<GenerateChargesButton />}
            />
          ) : (
            <ul className="divide-y divide-stone-100">
              {data.upcoming.map((payment) => (
                <li key={payment.id}>
                  <Link
                    href={`/clientes/${payment.client_id}`}
                    className="flex items-center gap-4 px-5 py-3 transition-colors hover:bg-stone-50"
                  >
                    <div className="w-14 shrink-0 text-center">
                      <p className="text-sm font-semibold tabular text-stone-900">
                        {shortDate(payment.due_date)}
                      </p>
                      <p className="text-[11px] uppercase tracking-wide text-stone-400">
                        {payment.due_date === today ? 'hoy' : 'vence'}
                      </p>
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium text-stone-900">
                        {payment.client?.business_name ?? 'Cliente eliminado'}
                      </p>
                      <p className="truncate text-xs text-stone-500">{payment.concept}</p>
                    </div>
                    <p className="shrink-0 text-sm font-semibold tabular text-stone-900">
                      {money(Number(payment.amount), payment.currency)}
                    </p>
                    <Badge className={PAYMENT_STATUS_META[payment.status].badge}>
                      {PAYMENT_STATUS_META[payment.status].label}
                    </Badge>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </SectionCard>

        {/* ---------- Cobranza por mes ---------- */}
        <SectionCard title="Cobranza, últimos 6 meses" className="self-start">
          <div className="space-y-3 p-5">
            {data.series.map((point) => (
              <div key={point.period}>
                <div className="flex items-baseline justify-between gap-2 text-xs">
                  <span className="capitalize text-stone-500">{point.label}</span>
                  <span className="tabular font-medium text-stone-900">
                    {money(point.collected)}
                  </span>
                </div>
                {/* Dos barras superpuestas: lo emitido en gris y lo cobrado
                    encima. El hueco entre las dos es lo que falta entrar. */}
                <div className="mt-1.5 h-2 w-full overflow-hidden rounded-full bg-stone-100">
                  <div
                    className="h-full rounded-full bg-stone-300"
                    style={{ width: `${(point.charged / peak) * 100}%` }}
                  >
                    <div
                      className="h-full rounded-full bg-emerald-500"
                      style={{
                        width: point.charged ? `${(point.collected / point.charged) * 100}%` : '0%',
                      }}
                    />
                  </div>
                </div>
              </div>
            ))}
            <p className="border-t border-stone-100 pt-3 text-xs leading-relaxed text-stone-500">
              En verde lo cobrado, en gris lo emitido. Cuenta por período, no por fecha de pago.
            </p>
          </div>
        </SectionCard>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* ---------- Próximos pasos ---------- */}
        <SectionCard title="Próximos pasos">
          {data.steps.length === 0 ? (
            <EmptyState
              title="Nada agendado"
              description="Cuando cargues una nota con próximo paso y fecha en la ficha de un cliente, aparece acá."
            />
          ) : (
            <ul className="divide-y divide-stone-100">
              {data.steps.map((step) => (
                <li key={step.id}>
                  <Link
                    href={`/clientes/${step.client_id}`}
                    className="flex items-start gap-3 px-5 py-3 transition-colors hover:bg-stone-50"
                  >
                    <CalendarClock
                      className={cn(
                        'mt-0.5 h-4 w-4 shrink-0',
                        step.next_step_at && step.next_step_at < today
                          ? 'text-rose-500'
                          : 'text-stone-400'
                      )}
                    />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium text-stone-900">
                        {step.next_step}
                      </p>
                      <p className="truncate text-xs text-stone-500">
                        {step.client?.business_name} · {shortDate(step.next_step_at)}
                      </p>
                    </div>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </SectionCard>

        {/* ---------- Últimas altas ---------- */}
        <SectionCard
          title="Últimos clientes"
          action={
            <Link
              href="/clientes"
              className="inline-flex items-center gap-1 text-sm text-stone-500 transition-colors hover:text-stone-900"
            >
              Ver todos <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          }
        >
          {data.recent.length === 0 ? (
            <EmptyState
              title="Todavía no hay clientes"
              description="Cargá el primero y el panel empieza a mostrar tus números."
              action={
                <Link
                  href="/clientes/nuevo"
                  className="inline-flex h-9 items-center rounded-lg bg-brand-800 px-4 text-sm font-medium text-white"
                >
                  Nuevo cliente
                </Link>
              }
            />
          ) : (
            <ul className="divide-y divide-stone-100">
              {data.recent.map((client) => (
                <li key={client.id}>
                  <Link
                    href={`/clientes/${client.id}`}
                    className="flex items-center gap-3 px-5 py-3 transition-colors hover:bg-stone-50"
                  >
                    <CircleDollarSign className="h-4 w-4 shrink-0 text-stone-300" />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium text-stone-900">
                        {client.business_name}
                      </p>
                      <p className="truncate text-xs text-stone-500">
                        {client.industry || 'Sin rubro'}
                        {client.city ? ` · ${client.city}` : ''}
                      </p>
                    </div>
                    <Badge className={CLIENT_STATUS_META[client.status].badge}>
                      {CLIENT_STATUS_META[client.status].label}
                    </Badge>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </SectionCard>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-stone-200 bg-white px-5 py-4">
        <div>
          <p className="text-sm font-medium text-stone-900">
            Cobros de {monthLabel(data.month.period)}
          </p>
          <p className="mt-0.5 text-xs text-stone-500">
            Genera la mensualidad de cada cliente activo. Correrlo dos veces no duplica nada.
          </p>
        </div>
        <GenerateChargesButton />
      </div>
    </div>
  );
}
