import Link from 'next/link';
import { notFound } from 'next/navigation';
import {
  ArrowLeft,
  ExternalLink,
  Mail,
  MessageCircle,
  Pencil,
  Phone,
  Store,
} from 'lucide-react';
import { createServerClient } from '@/lib/supabase/server';
import { Badge, EmptyState, SectionCard } from '@/components/ui';
import {
  ActivityDelete,
  ActivityForm,
  DeleteClient,
  PaymentActions,
  PaymentForm,
  StatusSelect,
} from '@/components/client-detail-actions';
import {
  CLIENT_STATUS_META,
  PAYMENT_STATUS_META,
  type Activity,
  type Client,
  type Payment,
} from '@/types';
import { cn, longDate, money, monthLabel, shortDate, todayISO } from '@/lib/utils';
import { formatearNumero, linkWhatsApp } from '@/lib/whatsapp';
import { VolumenDePedidos } from '@/components/volumen';

export const dynamic = 'force-dynamic';

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createServerClient();
  const { data } = await supabase.from('clients').select('business_name').eq('id', id).maybeSingle();
  return { title: data?.business_name ?? 'Cliente' };
}

export default async function ClientPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createServerClient();

  const [clientResult, paymentsResult, activitiesResult] = await Promise.all([
    supabase.from('clients').select('*').eq('id', id).maybeSingle(),
    supabase.from('payments').select('*').eq('client_id', id).order('period', { ascending: false }),
    supabase
      .from('activities')
      .select('*')
      .eq('client_id', id)
      .order('happened_at', { ascending: false }),
  ]);

  const client = clientResult.data as Client | null;
  if (!client) notFound();

  // El mensaje de prospección viaja precargado en el link: si el cliente todavía
  // es un prospecto al que no le escribimos, el chat se abre listo.
  const waHref = linkWhatsApp(client.whatsapp, client.outreach_message);

  const payments = (paymentsResult.data ?? []) as Payment[];
  const activities = (activitiesResult.data ?? []) as Activity[];
  const today = todayISO();

  const paid = payments.filter((payment) => payment.status === 'pagado');
  const totalPaid = paid.reduce((total, payment) => total + Number(payment.amount), 0);
  const owed = payments
    .filter((payment) => payment.status !== 'pagado' && payment.status !== 'anulado')
    .reduce((total, payment) => total + Number(payment.amount), 0);

  const meta = CLIENT_STATUS_META[client.status];

  return (
    <div className="space-y-6">
      <div>
        <Link
          href="/clientes"
          className="inline-flex items-center gap-1.5 text-sm text-stone-500 transition-colors hover:text-stone-900"
        >
          <ArrowLeft className="h-4 w-4" />
          Clientes
        </Link>

        <div className="mt-2 flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight text-stone-900">
              {client.business_name}
            </h1>
            <p className="mt-1 text-sm text-stone-500">
              {[client.industry, client.city].filter(Boolean).join(' · ') || 'Sin rubro cargado'}
              {client.source ? ` · llegó por ${client.source}` : ''}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <StatusSelect client={client} />
            <Link
              href={`/clientes/${client.id}/editar`}
              className="inline-flex h-9 items-center gap-2 rounded-lg border border-stone-300 bg-white px-3 text-sm font-medium text-stone-700 transition-colors hover:bg-stone-50"
            >
              <Pencil className="h-4 w-4" />
              Editar
            </Link>
          </div>
        </div>

        <p className="mt-2 text-xs text-stone-400">{meta.help}</p>
      </div>

      {/* ---------- Atajos de contacto y accesos ---------- */}
      <div className="flex flex-wrap gap-2">
        {/* El link va por `linkWhatsApp` y no por un replace a mano: un número
            guardado como "2235396261" armaba wa.me/2235396261, que WhatsApp no
            resuelve porque le falta el 54 y el 9. Y si es un fijo, no hay chat:
            el botón se convierte en un "llamar". */}
        {waHref ? (
          <QuickLink
            href={waHref}
            icon={MessageCircle}
            label={client.contact_name ? `WhatsApp a ${client.contact_name}` : 'WhatsApp'}
          />
        ) : (
          client.whatsapp && (
            <QuickLink
              href={`tel:+54${client.whatsapp.replace(/\D/g, '')}`}
              icon={Phone}
              label={`Llamar al ${formatearNumero(client.whatsapp)}`}
            />
          )
        )}
        {client.email && <QuickLink href={`mailto:${client.email}`} icon={Mail} label={client.email} />}
        {client.panel_url && (
          <QuickLink href={client.panel_url} icon={ExternalLink} label="Su panel" />
        )}
        {client.storefront_url && (
          <QuickLink href={client.storefront_url} icon={Store} label="Su tienda" />
        )}
      </div>

      {/* ---------- Números del cliente ---------- */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Metric label="Mensualidad" value={money(client.monthly_amount, client.currency)} />
        <Metric label="Cobrado hasta hoy" value={money(totalPaid, client.currency)} accent="positive" />
        <Metric
          label="Pendiente"
          value={money(owed, client.currency)}
          accent={owed > 0 ? 'warning' : 'default'}
        />
        <Metric
          label="Cliente desde"
          value={client.started_at ? longDate(client.started_at) : '—'}
          small
        />
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          {/* ---------- Volumen, que es lo que define el plan ---------- */}
          <VolumenDePedidos clientId={client.id} planActual={client.plan} />

          {/* ---------- Cobros ---------- */}
          <SectionCard title="Cobros" action={<PaymentForm client={client} />}>
            {payments.length === 0 ? (
              <EmptyState
                title="Sin cobros registrados"
                description="Agregá el primero, o generá la mensualidad del mes desde el resumen."
              />
            ) : (
              <ul className="divide-y divide-stone-100">
                {payments.map((payment) => {
                  const overdue = payment.status !== 'pagado' && payment.due_date < today;
                  return (
                    <li key={payment.id} className="flex items-center gap-4 px-5 py-3">
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium text-stone-900">
                          {payment.concept}{' '}
                          <span className="font-normal text-stone-400">
                            · {monthLabel(payment.period)}
                          </span>
                        </p>
                        <p className="truncate text-xs text-stone-500">
                          {payment.status === 'pagado'
                            ? `Pagado el ${shortDate(payment.paid_at)}${payment.method ? ` · ${payment.method}` : ''}`
                            : `Vence el ${shortDate(payment.due_date)}`}
                        </p>
                      </div>
                      <p className="shrink-0 text-sm font-semibold tabular text-stone-900">
                        {money(Number(payment.amount), payment.currency)}
                      </p>
                      <Badge
                        className={
                          overdue
                            ? PAYMENT_STATUS_META.vencido.badge
                            : PAYMENT_STATUS_META[payment.status].badge
                        }
                      >
                        {overdue ? 'Vencido' : PAYMENT_STATUS_META[payment.status].label}
                      </Badge>
                      <PaymentActions
                        id={payment.id}
                        clientId={client.id}
                        status={payment.status}
                      />
                    </li>
                  );
                })}
              </ul>
            )}
          </SectionCard>

          {/* ---------- Seguimiento ---------- */}
          <SectionCard title="Seguimiento">
            <ActivityForm clientId={client.id} />
            {activities.length === 0 ? (
              <EmptyState
                title="Todavía no hay notas"
                description="Todo lo que pase con este cliente —llamadas, pedidos, acuerdos— queda acá."
              />
            ) : (
              <ul className="divide-y divide-stone-100">
                {activities.map((activity) => (
                  <li key={activity.id} className="flex gap-3 px-5 py-3.5">
                    <div className="min-w-0 flex-1">
                      <p className="text-xs text-stone-400">
                        <span className="capitalize">{activity.kind}</span> ·{' '}
                        {longDate(activity.happened_at)}
                      </p>
                      <p className="mt-1 whitespace-pre-wrap text-sm leading-relaxed text-stone-700">
                        {activity.body}
                      </p>
                      {activity.next_step && (
                        <p
                          className={cn(
                            'mt-2 inline-flex rounded-lg px-2.5 py-1 text-xs',
                            activity.next_step_at && activity.next_step_at < today
                              ? 'bg-rose-50 text-rose-800'
                              : 'bg-amber-50 text-amber-800'
                          )}
                        >
                          {activity.next_step}
                          {activity.next_step_at ? ` · ${shortDate(activity.next_step_at)}` : ''}
                        </p>
                      )}
                    </div>
                    <ActivityDelete id={activity.id} clientId={client.id} />
                  </li>
                ))}
              </ul>
            )}
          </SectionCard>
        </div>

        <div className="space-y-6">
          {/* ---------- Ficha ---------- */}
          <SectionCard title="Ficha" className="self-start">
            <dl className="divide-y divide-stone-100">
              <Row label="Contacto" value={client.contact_name} />
              <Row label="Plan" value={client.plan} />
              <Row
                label="Puesta a punto"
                value={client.setup_amount ? money(client.setup_amount, client.currency) : null}
              />
              <Row label="Día de cobro" value={client.billing_day ? `Día ${client.billing_day}` : null} />
              <Row label="Primer contacto" value={longDate(client.first_contact_at)} />
              {client.churned_at && <Row label="Baja" value={longDate(client.churned_at)} />}
            </dl>
          </SectionCard>

          {/* ---------- Instalación ---------- */}
          <SectionCard title="Su instalación" className="self-start">
            <dl className="divide-y divide-stone-100">
              <Row label="Supabase" value={client.supabase_ref} mono />
              <Row label="Vercel" value={client.vercel_project} mono />
              <Row label="Repositorio" value={client.repo_url} mono />
            </dl>
          </SectionCard>

          {client.notes && (
            <SectionCard title="Notas" className="self-start">
              <p className="whitespace-pre-wrap px-5 py-4 text-sm leading-relaxed text-stone-700">
                {client.notes}
              </p>
            </SectionCard>
          )}

          <DeleteClient client={client} />
        </div>
      </div>
    </div>
  );
}

function QuickLink({
  href,
  icon: Icon,
  label,
}: {
  href: string;
  icon: React.ComponentType<{ className?: string }>;
  label: string;
}) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noreferrer"
      className="inline-flex h-9 items-center gap-2 rounded-lg border border-stone-300 bg-white px-3 text-sm font-medium text-stone-700 transition-colors hover:bg-stone-50"
    >
      <Icon className="h-4 w-4 text-stone-400" />
      {label}
    </a>
  );
}

function Metric({
  label,
  value,
  accent = 'default',
  small = false,
}: {
  label: string;
  value: string;
  accent?: 'default' | 'positive' | 'warning';
  small?: boolean;
}) {
  const tone = {
    default: 'text-stone-900',
    positive: 'text-emerald-700',
    warning: 'text-amber-600',
  }[accent];

  return (
    <div className="surface p-4">
      <p className="text-sm font-medium text-stone-500">{label}</p>
      <p
        className={cn(
          'mt-2 font-semibold tabular tracking-tight',
          small ? 'text-base' : 'text-2xl',
          tone
        )}
      >
        {value}
      </p>
    </div>
  );
}

function Row({
  label,
  value,
  mono = false,
}: {
  label: string;
  value: string | null | undefined;
  mono?: boolean;
}) {
  return (
    <div className="flex items-baseline justify-between gap-3 px-5 py-2.5">
      <dt className="shrink-0 text-sm text-stone-500">{label}</dt>
      <dd
        className={cn(
          'min-w-0 truncate text-right text-sm text-stone-900',
          mono && 'font-mono text-xs'
        )}
      >
        {value || '—'}
      </dd>
    </div>
  );
}
