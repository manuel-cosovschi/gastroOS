import Link from 'next/link';
import { createServerClient } from '@/lib/supabase/server';
import { Badge, EmptyState, SectionCard, StatCard } from '@/components/ui';
import { GenerateChargesButton } from '@/components/generate-charges';
import { PaymentActions } from '@/components/client-detail-actions';
import { PAYMENT_STATUSES, PAYMENT_STATUS_META, type Payment, type PaymentStatus } from '@/types';
import { cn, money, monthLabel, shortDate, todayISO } from '@/lib/utils';

export const metadata = { title: 'Cobros' };
export const dynamic = 'force-dynamic';

interface PaymentRow extends Payment {
  client: { id: string; business_name: string } | null;
}

export default async function PaymentsPage({
  searchParams,
}: {
  searchParams: Promise<{ estado?: string }>;
}) {
  const { estado } = await searchParams;
  const supabase = await createServerClient();
  const today = todayISO();

  const { data } = await supabase
    .from('payments')
    .select('*, client:clients(id, business_name)')
    .order('due_date', { ascending: false })
    .limit(300);

  const all = (data ?? []) as PaymentRow[];

  // "Vencido" no es un estado guardado sino una fecha pasada sin cobrar: el
  // filtro lo calcula acá para que nadie tenga que mantenerlo a mano.
  const isOverdue = (payment: PaymentRow) =>
    payment.status !== 'pagado' && payment.status !== 'anulado' && payment.due_date < today;

  const rows =
    estado === 'vencido'
      ? all.filter(isOverdue)
      : estado && PAYMENT_STATUSES.includes(estado as PaymentStatus)
        ? all.filter((payment) => payment.status === estado && !isOverdue(payment))
        : all;

  const live = all.filter((payment) => payment.status !== 'anulado');
  const sum = (items: PaymentRow[]) => items.reduce((total, row) => total + Number(row.amount), 0);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-stone-900">Cobros</h1>
          <p className="mt-1 text-sm text-stone-500">
            {rows.length === 1 ? '1 cobro' : `${rows.length} cobros`}
          </p>
        </div>
        <GenerateChargesButton />
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard label="Cobrado" value={money(sum(live.filter((p) => p.status === 'pagado')))} accent="positive" />
        <StatCard label="Pendiente" value={money(sum(live.filter((p) => p.status !== 'pagado' && !isOverdue(p))))} />
        <StatCard
          label="Vencido"
          value={money(sum(live.filter(isOverdue)))}
          accent={live.some(isOverdue) ? 'negative' : 'default'}
        />
        <StatCard label="Emitido en total" value={money(sum(live))} />
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <Chip href="/cobros" label="Todos" active={!estado} />
        <Chip href="/cobros?estado=vencido" label="Vencidos" active={estado === 'vencido'} />
        {PAYMENT_STATUSES.map((status) => (
          <Chip
            key={status}
            href={`/cobros?estado=${status}`}
            label={PAYMENT_STATUS_META[status].label}
            active={estado === status}
          />
        ))}
      </div>

      <SectionCard title="Listado">
        {rows.length === 0 ? (
          <EmptyState
            title="No hay cobros con ese filtro"
            description="Generá los del mes para los clientes activos, o cargá uno a mano desde la ficha del cliente."
            action={<GenerateChargesButton />}
          />
        ) : (
          <ul className="divide-y divide-stone-100">
            {rows.map((payment) => {
              const overdue = isOverdue(payment);
              return (
                <li key={payment.id} className="flex items-center gap-4 px-5 py-3">
                  <div className="w-14 shrink-0 text-center">
                    <p className="text-sm font-semibold tabular text-stone-900">
                      {shortDate(payment.due_date)}
                    </p>
                    <p className="text-[11px] uppercase tracking-wide text-stone-400">
                      {payment.status === 'pagado' ? 'venció' : 'vence'}
                    </p>
                  </div>

                  <div className="min-w-0 flex-1">
                    {payment.client ? (
                      <Link
                        href={`/clientes/${payment.client.id}`}
                        className="truncate text-sm font-medium text-stone-900 hover:underline"
                      >
                        {payment.client.business_name}
                      </Link>
                    ) : (
                      <p className="truncate text-sm font-medium text-stone-400">Cliente eliminado</p>
                    )}
                    <p className="truncate text-xs text-stone-500">
                      {payment.concept} · {monthLabel(payment.period)}
                    </p>
                  </div>

                  <p className="shrink-0 text-sm font-semibold tabular text-stone-900">
                    {money(Number(payment.amount), payment.currency)}
                  </p>

                  <Badge
                    className={
                      overdue ? PAYMENT_STATUS_META.vencido.badge : PAYMENT_STATUS_META[payment.status].badge
                    }
                  >
                    {overdue ? 'Vencido' : PAYMENT_STATUS_META[payment.status].label}
                  </Badge>

                  <PaymentActions
                    id={payment.id}
                    clientId={payment.client_id}
                    status={payment.status}
                  />
                </li>
              );
            })}
          </ul>
        )}
      </SectionCard>
    </div>
  );
}

function Chip({ href, label, active }: { href: string; label: string; active: boolean }) {
  return (
    <Link
      href={href}
      className={cn(
        'inline-flex h-9 items-center rounded-lg border px-3 text-sm font-medium transition-colors',
        active
          ? 'border-brand-800 bg-brand-800 text-white'
          : 'border-stone-300 bg-white text-stone-600 hover:bg-stone-50'
      )}
    >
      {label}
    </Link>
  );
}
