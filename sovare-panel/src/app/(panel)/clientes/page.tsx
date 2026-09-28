import Link from 'next/link';
import { ArrowRight, Plus, Search } from 'lucide-react';
import { createServerClient } from '@/lib/supabase/server';
import { Badge, EmptyState, SectionCard } from '@/components/ui';
import { CLIENT_STATUSES, CLIENT_STATUS_META, type Client, type ClientStatus } from '@/types';
import { cn, money, shortDate } from '@/lib/utils';

export const metadata = { title: 'Clientes' };
export const dynamic = 'force-dynamic';

export default async function ClientsPage({
  searchParams,
}: {
  searchParams: Promise<{ estado?: string; q?: string }>;
}) {
  const { estado, q } = await searchParams;
  const supabase = await createServerClient();

  let query = supabase.from('clients').select('*').order('business_name');
  if (estado && CLIENT_STATUSES.includes(estado as ClientStatus)) query = query.eq('status', estado);
  if (q) query = query.ilike('business_name', `%${q}%`);

  const { data } = await query;
  const clients = (data ?? []) as Client[];

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-stone-900">Clientes</h1>
          <p className="mt-1 text-sm text-stone-500">
            {clients.length === 1 ? '1 cliente' : `${clients.length} clientes`}
            {estado ? ` en ${CLIENT_STATUS_META[estado as ClientStatus].label.toLowerCase()}` : ''}
          </p>
        </div>
        <Link
          href="/clientes/nuevo"
          className="inline-flex h-9 items-center gap-2 rounded-lg bg-brand-800 px-4 text-sm font-medium text-white transition-colors hover:bg-brand-900"
        >
          <Plus className="h-4 w-4" />
          Nuevo
        </Link>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <FilterChip href="/clientes" label="Todos" active={!estado} />
        {CLIENT_STATUSES.map((status) => (
          <FilterChip
            key={status}
            href={`/clientes?estado=${status}`}
            label={CLIENT_STATUS_META[status].label}
            active={estado === status}
          />
        ))}

        <form action="/clientes" className="ml-auto flex items-center gap-2">
          {estado && <input type="hidden" name="estado" value={estado} />}
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-stone-400" />
            <input
              name="q"
              defaultValue={q ?? ''}
              placeholder="Buscar negocio"
              className="field h-9 w-48 pl-9"
            />
          </div>
        </form>
      </div>

      <SectionCard title="Listado">
        {clients.length === 0 ? (
          <EmptyState
            title="No hay clientes con ese filtro"
            description="Probá con otro estado, o cargá uno nuevo."
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
            {clients.map((client) => (
              <li key={client.id}>
                <Link
                  href={`/clientes/${client.id}`}
                  className="flex items-center gap-4 px-5 py-3.5 transition-colors hover:bg-stone-50"
                >
                  <span
                    className={cn(
                      'h-2 w-2 shrink-0 rounded-full',
                      CLIENT_STATUS_META[client.status].dot
                    )}
                  />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-stone-900">
                      {client.business_name}
                    </p>
                    <p className="truncate text-xs text-stone-500">
                      {[client.industry, client.city, client.contact_name]
                        .filter(Boolean)
                        .join(' · ') || 'Sin datos de contacto'}
                    </p>
                  </div>
                  <div className="hidden shrink-0 text-right sm:block">
                    <p className="text-sm font-semibold tabular text-stone-900">
                      {money(client.monthly_amount, client.currency)}
                    </p>
                    <p className="text-[11px] text-stone-400">
                      {client.started_at ? `desde ${shortDate(client.started_at)}` : 'sin alta'}
                    </p>
                  </div>
                  <Badge className={CLIENT_STATUS_META[client.status].badge}>
                    {CLIENT_STATUS_META[client.status].label}
                  </Badge>
                  <ArrowRight className="hidden h-4 w-4 shrink-0 text-stone-300 sm:block" />
                </Link>
              </li>
            ))}
          </ul>
        )}
      </SectionCard>
    </div>
  );
}

function FilterChip({ href, label, active }: { href: string; label: string; active: boolean }) {
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
