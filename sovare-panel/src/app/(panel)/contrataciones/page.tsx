import Link from 'next/link';
import { AlertTriangle, MailWarning } from 'lucide-react';
import { createServerClient } from '@/lib/supabase/server';
import { Badge, EmptyState, SectionCard, StatCard } from '@/components/ui';
import {
  SIGNUP_STATUSES,
  SIGNUP_STATUS_META,
  type Signup,
  type SignupStatus,
} from '@/types';
import { cn, longDate, money } from '@/lib/utils';

export const metadata = { title: 'Contrataciones' };
export const dynamic = 'force-dynamic';

export default async function SignupsPage({
  searchParams,
}: {
  searchParams: Promise<{ estado?: string }>;
}) {
  const { estado } = await searchParams;
  const supabase = await createServerClient();

  const { data } = await supabase
    .from('signups')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(200);

  const all = (data ?? []) as Signup[];
  const rows =
    estado && SIGNUP_STATUSES.includes(estado as SignupStatus)
      ? all.filter((signup) => signup.status === estado)
      : all;

  const pending = all.filter((signup) => signup.status === 'en_revision');
  const approved = all.filter((signup) => signup.status === 'aprobado');
  const cobrado = approved.reduce((total, signup) => total + Number(signup.amount), 0);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-stone-900">Contrataciones</h1>
        <p className="mt-1 text-sm text-stone-500">
          Lo que entra desde la página: quién eligió un plan, qué transfirió y qué dijo la
          verificación del comprobante.
        </p>
      </div>

      {pending.length > 0 && (
        <Link
          href="/contrataciones?estado=en_revision"
          className="flex items-center gap-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 transition-shadow hover:shadow-card"
        >
          <AlertTriangle className="h-4 w-4 shrink-0 text-amber-600" />
          <span className="min-w-0 flex-1 text-sm text-stone-800">
            {pending.length === 1
              ? 'Hay 1 comprobante esperando que lo mires.'
              : `Hay ${pending.length} comprobantes esperando que los mires.`}
          </span>
        </Link>
      )}

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard label="Contrataciones" value={String(all.length)} />
        <StatCard
          label="Para revisar"
          value={String(pending.length)}
          accent={pending.length > 0 ? 'warning' : 'default'}
        />
        <StatCard label="Aprobadas" value={String(approved.length)} accent="positive" />
        <StatCard label="Cobrado" value={money(cobrado)} accent="positive" />
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <Chip href="/contrataciones" label="Todas" active={!estado} />
        {SIGNUP_STATUSES.map((status) => (
          <Chip
            key={status}
            href={`/contrataciones?estado=${status}`}
            label={SIGNUP_STATUS_META[status].label}
            active={estado === status}
          />
        ))}
      </div>

      <SectionCard title="Listado">
        {rows.length === 0 ? (
          <EmptyState
            title="Todavía no hay contrataciones"
            description="Acá van a aparecer las personas que elijan un plan desde la página de GastroOS."
          />
        ) : (
          <ul className="divide-y divide-stone-100">
            {rows.map((signup) => (
              <li key={signup.id}>
                <Link
                  href={`/contrataciones/${signup.id}`}
                  className="flex min-w-0 items-center gap-4 px-5 py-3 transition-colors hover:bg-stone-50"
                >
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-stone-900">
                      {signup.business_name}
                    </p>
                    <p className="truncate text-xs text-stone-500">
                      {signup.contact_name ? `${signup.contact_name} · ` : ''}
                      {longDate(signup.created_at)}
                    </p>
                  </div>

                  {signup.status === 'aprobado' && !signup.notified_at && (
                    <span
                      className="shrink-0 text-amber-600"
                      title="El mail de confirmación no salió"
                    >
                      <MailWarning className="h-4 w-4" />
                    </span>
                  )}

                  {signup.client_id && (
                    <Badge className="hidden border-stone-200 bg-stone-100 text-stone-600 sm:inline-flex">
                      Ya es cliente
                    </Badge>
                  )}

                  <p className="hidden shrink-0 text-sm font-semibold tabular text-stone-900 sm:block">
                    {money(Number(signup.amount), signup.currency)}
                  </p>

                  <Badge className={SIGNUP_STATUS_META[signup.status].badge}>
                    {SIGNUP_STATUS_META[signup.status].label}
                  </Badge>
                </Link>
              </li>
            ))}
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
