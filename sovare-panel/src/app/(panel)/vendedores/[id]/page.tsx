import Link from 'next/link';
import { notFound } from 'next/navigation';
import { AlertTriangle, ArrowLeft, ChevronRight } from 'lucide-react';
import { createServerClient } from '@/lib/supabase/server';
import { Badge, EmptyState, SectionCard, StatCard } from '@/components/ui';
import { DeleteVendor } from '@/components/vendedores/delete-vendor';
import { VendorForm } from '@/components/vendedores/vendor-form';
import { VendorLink } from '@/components/vendedores/vendor-link';
import { SettleButton, SettlementActions } from '@/components/vendedores/settle-controls';
import { resumir } from '@/lib/vendedores';
import { cn, longDate, money, monthLabel } from '@/lib/utils';
import {
  SETTLEMENT_STATUS_META,
  VENDOR_SALE_STATUS_META,
  type Vendor,
  type VendorBalance,
  type VendorSale,
  type VendorSettlement,
} from '@/types';

export const metadata = { title: 'Vendedor' };
export const dynamic = 'force-dynamic';

export default async function VendorDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createServerClient();

  const { data } = await supabase.from('vendors').select('*').eq('id', id).maybeSingle();
  if (!data) notFound();
  const vendor = data as Vendor;

  const [salesRes, settlementsRes, balancesRes] = await Promise.all([
    supabase
      .from('vendor_sales')
      .select('*')
      .eq('vendor_id', id)
      .order('submitted_at', { ascending: false })
      .limit(300),
    supabase
      .from('vendor_settlements')
      .select('*')
      .eq('vendor_id', id)
      .order('settled_at', { ascending: false }),
    supabase
      .from('vendor_period_balances')
      .select('*')
      .eq('vendor_id', id)
      .order('period', { ascending: false }),
  ]);

  const sales = (salesRes.data ?? []) as VendorSale[];
  const settlements = (settlementsRes.data ?? []) as VendorSettlement[];
  const balances = (balancesRes.data ?? []) as VendorBalance[];

  const summary = resumir(balances, settlements);
  const toSettle = balances.filter((balance) => Number(balance.unsettled) > 0);
  const pending = sales.filter((sale) => sale.status === 'pendiente');

  return (
    <div className="space-y-6">
      <Link
        href="/vendedores"
        className="inline-flex items-center gap-1.5 text-sm text-stone-500 transition-colors hover:text-stone-900"
      >
        <ArrowLeft className="h-4 w-4" />
        Mis vendedores
      </Link>

      <header className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <h1 className="text-2xl font-semibold tracking-tight text-stone-900">{vendor.name}</h1>
          <p className="mt-1 text-sm text-stone-500">
            {Number(vendor.commission_pct)}% de la cuota del primer mes
            {vendor.city ? ` · ${vendor.city}` : ''} · desde {longDate(vendor.created_at)}
          </p>
        </div>
        {!vendor.is_active && (
          <Badge className="border-stone-200 bg-stone-100 text-stone-600">Pausado</Badge>
        )}
      </header>

      {pending.length > 0 && (
        <Link
          href={`/vendedores/ventas/${pending[pending.length - 1].id}`}
          className="flex items-center gap-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 transition-shadow hover:shadow-card"
        >
          <AlertTriangle className="h-4 w-4 shrink-0 text-amber-600" />
          <span className="min-w-0 flex-1 text-sm text-stone-800">
            {pending.length === 1
              ? 'Cargó 1 cliente que espera tu aprobación.'
              : `Cargó ${pending.length} clientes que esperan tu aprobación.`}
          </span>
          <ChevronRight className="h-4 w-4 shrink-0 text-amber-600" />
        </Link>
      )}

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard label="Sin liquidar" value={money(summary.sinLiquidar)} hint="Aprobado, sin cerrar el mes" />
        <StatCard label="Este mes" value={money(summary.delMes)} hint="Del mes en curso" />
        <StatCard
          label="A transferir"
          value={money(summary.porTransferir)}
          hint="Liquidado, falta pagar"
          accent={summary.porTransferir > 0 ? 'warning' : 'default'}
        />
        <StatCard label="Ya pagado" value={money(summary.pagado)} accent="positive" />
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          {/* ---------- Saldo por mes ---------- */}
          <SectionCard title="Saldo para liquidar">
            {toSettle.length === 0 ? (
              <EmptyState
                title="No tiene saldo para liquidar"
                description="Cuando apruebes un cliente suyo, la comisión aparece acá, agrupada por el mes en que la aprobaste."
              />
            ) : (
              <ul className="divide-y divide-stone-100">
                {toSettle.map((balance) => (
                  <li
                    key={balance.period}
                    className="flex flex-wrap items-center justify-between gap-3 px-5 py-3.5"
                  >
                    <div className="min-w-0">
                      <p className="flex items-center gap-2 text-sm font-medium text-stone-900">
                        {monthLabel(balance.period)}
                        {balance.is_current && (
                          <Badge className="border-sky-200 bg-sky-50 text-sky-800">En curso</Badge>
                        )}
                      </p>
                      <p className="text-xs text-stone-500">
                        {balance.unsettled_count === 1
                          ? '1 cliente'
                          : `${balance.unsettled_count} clientes`}
                      </p>
                    </div>
                    <div className="flex flex-wrap items-center justify-end gap-3">
                      <p className="text-lg font-semibold tabular text-stone-900">
                        {money(Number(balance.unsettled))}
                      </p>
                      <SettleButton
                        vendorId={vendor.id}
                        period={balance.period}
                        monthLabel={monthLabel(balance.period)}
                        amount={Number(balance.unsettled)}
                        count={balance.unsettled_count}
                        isCurrent={balance.is_current}
                      />
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </SectionCard>

          {/* ---------- Liquidaciones ---------- */}
          <SectionCard title="Liquidaciones">
            {settlements.length === 0 ? (
              <EmptyState
                title="Todavía no hay liquidaciones"
                description="Al liquidar un mes se junta su saldo en una sola cifra, que es la que le transferís."
              />
            ) : (
              <ul className="divide-y divide-stone-100">
                {settlements.map((settlement) => {
                  const meta = SETTLEMENT_STATUS_META[settlement.status];
                  const undone = settlement.status === 'anulada';
                  return (
                    <li
                      key={settlement.id}
                      className={cn(
                        'flex flex-wrap items-center justify-between gap-3 px-5 py-3.5',
                        undone && 'opacity-60'
                      )}
                    >
                      <div className="min-w-0">
                        <p className="flex flex-wrap items-center gap-2 text-sm font-medium text-stone-900">
                          {monthLabel(settlement.period)}
                          <Badge className={meta.badge}>{meta.label}</Badge>
                        </p>
                        <p className="text-xs text-stone-500">
                          {settlement.sales_count === 1
                            ? '1 cliente'
                            : `${settlement.sales_count} clientes`}{' '}
                          · liquidada el {longDate(settlement.settled_at)}
                          {settlement.paid_at && ` · pagada el ${longDate(settlement.paid_at)}`}
                          {settlement.paid_reference && ` · op. ${settlement.paid_reference}`}
                        </p>
                      </div>
                      <div className="flex flex-wrap items-center justify-end gap-3">
                        <p
                          className={cn(
                            'text-base font-semibold tabular text-stone-900',
                            undone && 'line-through'
                          )}
                        >
                          {money(Number(settlement.total))}
                        </p>
                        <SettlementActions settlement={settlement} vendorId={vendor.id} />
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </SectionCard>

          {/* ---------- Clientes cargados ---------- */}
          <SectionCard title={`Clientes cargados (${sales.length})`}>
            {sales.length === 0 ? (
              <EmptyState
                title="Todavía no cargó ninguno"
                description="Cuando cargue un cliente desde su página, aparece acá y te llega un mail."
              />
            ) : (
              <ul className="divide-y divide-stone-100">
                {sales.map((sale) => {
                  const meta = VENDOR_SALE_STATUS_META[sale.status];
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
                            {sale.plan ?? 'Sin plan'} · cargado el {longDate(sale.submitted_at)}
                          </p>
                        </div>
                        {sale.status === 'aprobada' && sale.commission_amount !== null && (
                          <p className="hidden shrink-0 text-sm font-semibold tabular text-stone-900 sm:block">
                            {money(Number(sale.commission_amount))}
                          </p>
                        )}
                        <Badge className={meta.badge}>{meta.label}</Badge>
                      </Link>
                    </li>
                  );
                })}
              </ul>
            )}
          </SectionCard>
        </div>

        {/* ---------- Columna lateral ---------- */}
        <div className="space-y-6">
          <SectionCard title="Su página">
            <div className="px-5 py-4">
              <VendorLink vendor={vendor} />
            </div>
          </SectionCard>

          <SectionCard title="Cómo se le paga">
            <div className="space-y-2 px-5 py-4">
              {vendor.payout_alias ? (
                <>
                  <p className="break-all rounded-md bg-stone-50 px-3 py-2 font-mono text-sm text-stone-800">
                    {vendor.payout_alias}
                  </p>
                  <p className="text-xs text-stone-500">
                    {vendor.payout_holder ? `Titular: ${vendor.payout_holder}` : 'Sin titular cargado.'}
                  </p>
                </>
              ) : (
                <p className="text-sm leading-relaxed text-stone-500">
                  Todavía no cargaste a dónde transferirle. Pedile el alias y completalo más abajo,
                  en sus datos, para tenerlo a mano el día de liquidar.
                </p>
              )}
            </div>
          </SectionCard>
        </div>
      </div>

      <SectionCard title="Datos del vendedor">
        <div className="px-5 py-5">
          <VendorForm vendor={vendor} />
        </div>
      </SectionCard>

      {/* Sólo si no hizo nada: con clientes o liquidaciones hay plata de por medio
          y el camino es pausarlo, no borrarlo. */}
      {sales.length === 0 && settlements.length === 0 && (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-stone-200 bg-white px-5 py-4">
          <p className="max-w-md text-sm leading-relaxed text-stone-500">
            Todavía no cargó nada, así que se puede eliminar, por ejemplo si lo creaste por error.
            Cuando tenga clientes, lo único que queda es pausarlo.
          </p>
          <DeleteVendor vendorId={vendor.id} name={vendor.name} />
        </div>
      )}
    </div>
  );
}
