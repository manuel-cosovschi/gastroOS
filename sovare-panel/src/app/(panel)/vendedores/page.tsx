import Link from 'next/link';
import { AlertTriangle, ChevronRight, Plus } from 'lucide-react';
import { createServerClient } from '@/lib/supabase/server';
import { Badge, EmptyState, SectionCard, StatCard } from '@/components/ui';
import { resumir } from '@/lib/vendedores';
import { longDate, money } from '@/lib/utils';
import type { Vendor, VendorBalance, VendorSettlement } from '@/types';

export const metadata = { title: 'Mis vendedores' };
export const dynamic = 'force-dynamic';

interface PendingSale {
  id: string;
  vendor_id: string;
  business_name: string;
  plan: string | null;
  submitted_at: string;
  vendors: { name: string } | { name: string }[] | null;
}

export default async function VendorsPage() {
  const supabase = await createServerClient();

  const [vendorsRes, pendingRes, balancesRes, settlementsRes] = await Promise.all([
    supabase.from('vendors').select('*').order('is_active', { ascending: false }).order('name'),
    supabase
      .from('vendor_sales')
      .select('id, vendor_id, business_name, plan, submitted_at, vendors(name)')
      .eq('status', 'pendiente')
      .order('submitted_at', { ascending: true })
      .limit(100),
    supabase.from('vendor_period_balances').select('*'),
    supabase.from('vendor_settlements').select('*').neq('status', 'anulada'),
  ]);

  const vendors = (vendorsRes.data ?? []) as Vendor[];
  const pending = (pendingRes.data ?? []) as unknown as PendingSale[];
  const balances = (balancesRes.data ?? []) as VendorBalance[];
  const settlements = (settlementsRes.data ?? []) as VendorSettlement[];

  const loadFailed = Boolean(vendorsRes.error || pendingRes.error);

  const byVendor = (id: string) =>
    resumir(
      balances.filter((b) => b.vendor_id === id),
      settlements.filter((s) => s.vendor_id === id)
    );
  const pendingOf = (id: string) => pending.filter((sale) => sale.vendor_id === id).length;

  const total = resumir(balances, settlements);
  const active = vendors.filter((vendor) => vendor.is_active).length;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-stone-900">Mis vendedores</h1>
          <p className="mt-1 max-w-xl text-sm text-stone-500">
            Cada vendedor carga desde su página los clientes que consiguió. Nada cuenta hasta que
            lo aprobás: ahí la comisión pasa a su saldo del mes, y a fin de mes la liquidás y se la
            transferís.
          </p>
        </div>
        <Link
          href="/vendedores/nuevo"
          className="inline-flex h-9 items-center gap-2 rounded-lg bg-brand-800 px-4 text-sm font-medium text-white shadow-sm transition-colors hover:bg-brand-900"
        >
          <Plus className="h-4 w-4" />
          Agregar vendedor
        </Link>
      </div>

      {loadFailed && (
        <div className="flex gap-3 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-rose-600" />
          <p className="text-sm text-stone-800">
            No se pudo leer la lista de vendedores. Si la base se acaba de actualizar, probá de
            nuevo en un minuto.
          </p>
        </div>
      )}

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard
          label="Para aprobar"
          value={String(pending.length)}
          hint={pending.length === 0 ? 'Todo al día' : 'Clientes cargados que esperan tu OK'}
          accent={pending.length > 0 ? 'warning' : 'default'}
        />
        <StatCard label="Vendedores activos" value={String(active)} hint={`${vendors.length} en total`} />
        <StatCard
          label="Saldo sin liquidar"
          value={money(total.sinLiquidar)}
          hint="Aprobado y todavía sin cerrar el mes"
        />
        <StatCard
          label="A transferir"
          value={money(total.porTransferir)}
          hint="Ya liquidado, falta pagarlo"
          accent={total.porTransferir > 0 ? 'warning' : 'default'}
        />
      </div>

      {pending.length > 0 && (
        <SectionCard title={`Para aprobar (${pending.length})`}>
          <ul className="divide-y divide-stone-100">
            {pending.map((sale) => {
              const vendor = Array.isArray(sale.vendors) ? sale.vendors[0] : sale.vendors;
              return (
                <li key={sale.id}>
                  <Link
                    href={`/vendedores/ventas/${sale.id}`}
                    className="flex min-w-0 items-center gap-4 px-5 py-3 transition-colors hover:bg-stone-50"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium text-stone-900">
                        {sale.business_name}
                      </p>
                      <p className="truncate text-xs text-stone-500">
                        Lo cargó {vendor?.name ?? 'un vendedor'} · {longDate(sale.submitted_at)}
                      </p>
                    </div>
                    {sale.plan && (
                      <Badge className="hidden border-stone-200 bg-stone-100 text-stone-600 sm:inline-flex">
                        {sale.plan}
                      </Badge>
                    )}
                    <span className="inline-flex shrink-0 items-center gap-1 text-sm font-medium text-brand-800">
                      Revisar
                      <ChevronRight className="h-4 w-4" />
                    </span>
                  </Link>
                </li>
              );
            })}
          </ul>
        </SectionCard>
      )}

      <SectionCard title="Vendedores">
        {vendors.length === 0 ? (
          <EmptyState
            title="Todavía no tenés vendedores"
            description="Agregá el primero y te queda su link para mandárselo por WhatsApp. Desde ahí carga los clientes que consiga."
            action={
              <Link
                href="/vendedores/nuevo"
                className="inline-flex h-9 items-center gap-2 rounded-lg bg-brand-800 px-4 text-sm font-medium text-white hover:bg-brand-900"
              >
                <Plus className="h-4 w-4" />
                Agregar vendedor
              </Link>
            }
          />
        ) : (
          <ul className="divide-y divide-stone-100">
            {vendors.map((vendor) => {
              const summary = byVendor(vendor.id);
              const waiting = pendingOf(vendor.id);
              return (
                <li key={vendor.id}>
                  <Link
                    href={`/vendedores/${vendor.id}`}
                    className="flex min-w-0 items-center gap-4 px-5 py-3.5 transition-colors hover:bg-stone-50"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="flex items-center gap-2 truncate text-sm font-medium text-stone-900">
                        <span className="truncate">{vendor.name}</span>
                        {!vendor.is_active && (
                          <Badge className="border-stone-200 bg-stone-100 text-stone-500">
                            Pausado
                          </Badge>
                        )}
                      </p>
                      <p className="truncate text-xs text-stone-500">
                        {summary.aprobadas === 1 ? '1 cliente' : `${summary.aprobadas} clientes`}{' '}
                        aprobados · {Number(vendor.commission_pct)}%
                        {vendor.city ? ` · ${vendor.city}` : ''}
                      </p>
                    </div>

                    {waiting > 0 && (
                      <Badge className="border-amber-200 bg-amber-50 text-amber-800">
                        {waiting} para aprobar
                      </Badge>
                    )}

                    <div className="hidden w-28 shrink-0 text-right sm:block">
                      <p className="text-sm font-semibold tabular text-stone-900">
                        {money(summary.sinLiquidar)}
                      </p>
                      <p className="text-[11px] text-stone-500">sin liquidar</p>
                    </div>
                    <div className="hidden w-28 shrink-0 text-right md:block">
                      <p
                        className={`text-sm font-semibold tabular ${
                          summary.porTransferir > 0 ? 'text-amber-700' : 'text-stone-400'
                        }`}
                      >
                        {money(summary.porTransferir)}
                      </p>
                      <p className="text-[11px] text-stone-500">a transferir</p>
                    </div>
                    <ChevronRight className="h-4 w-4 shrink-0 text-stone-300" />
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </SectionCard>
    </div>
  );
}
