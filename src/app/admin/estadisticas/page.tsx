'use client';

import { useEffect, useState } from 'react';
import { BarChart3, PiggyBank, Receipt, ShoppingBag, Wallet } from 'lucide-react';
import { getStats } from '@/actions/stats';
import { PageHeader } from '@/components/ui/page-header';
import { StatCard } from '@/components/ui/stat-card';
import { Skeleton } from '@/components/ui/spinner';
import { Input } from '@/components/ui/input';
import { TimeBars } from '@/components/charts/time-bars';
import { RankingBars } from '@/components/charts/ranking-bars';
import { useMoney } from '@/components/admin/business-provider';
import { cn, percentChange } from '@/lib/utils';
import { STATS_RANGES, STATS_RANGE_LABELS, type StatsData, type StatsRange } from '@/types';

export default function StatsPage() {
  const money = useMoney();
  const [range, setRange] = useState<StatsRange>('last_30');
  const [custom, setCustom] = useState({ from: '', to: '' });
  const [data, setData] = useState<StatsData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Con rango personalizado esperamos a que estén las dos fechas.
    if (range === 'custom' && (!custom.from || !custom.to)) return;

    let active = true;
    setLoading(true);

    getStats(range, range === 'custom' ? custom : undefined).then((result) => {
      if (!active) return;
      setData(result);
      setLoading(false);
    });

    return () => {
      active = false;
    };
  }, [range, custom]);

  const summary = data?.summary;
  const previous = data?.previous;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Estadísticas"
        description="Cómo viene el negocio, comparado contra el período anterior."
      />

      {/* Filtros de período, en una sola fila arriba de todo */}
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
        <div className="scroll-subtle inline-flex overflow-x-auto rounded-lg border border-stone-200 bg-white p-0.5">
          {STATS_RANGES.map((option) => (
            <button
              key={option}
              onClick={() => setRange(option)}
              className={cn(
                'whitespace-nowrap rounded-md px-3 py-1.5 text-sm font-medium transition-colors',
                range === option ? 'bg-stone-900 text-white' : 'text-stone-600 hover:text-stone-900'
              )}
            >
              {STATS_RANGE_LABELS[option]}
            </button>
          ))}
        </div>

        {range === 'custom' && (
          <div className="flex items-center gap-2 animate-fade-in">
            <Input
              type="date"
              value={custom.from}
              onChange={(event) => setCustom({ ...custom, from: event.target.value })}
              aria-label="Desde"
              className="w-auto"
            />
            <span className="text-sm text-stone-400">a</span>
            <Input
              type="date"
              value={custom.to}
              onChange={(event) => setCustom({ ...custom, to: event.target.value })}
              aria-label="Hasta"
              className="w-auto"
            />
          </div>
        )}
      </div>

      {loading || !data || !summary || !previous ? (
        <div className="space-y-6">
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
            {Array.from({ length: 5 }).map((_, index) => (
              <Skeleton key={index} className="h-24" />
            ))}
          </div>
          <Skeleton className="h-64" />
        </div>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
            <StatCard
              label="Facturación"
              value={money(summary.revenue)}
              change={percentChange(summary.revenue, previous.revenue)}
              icon={Wallet}
              accent="positive"
            />
            <StatCard
              label="Gastos"
              value={money(summary.expenses)}
              change={percentChange(summary.expenses, previous.expenses)}
              invertChange
              icon={Receipt}
            />
            <StatCard
              label="Ganancia estimada"
              value={money(summary.profit)}
              change={percentChange(summary.profit, previous.profit)}
              icon={PiggyBank}
              accent={summary.profit >= 0 ? 'positive' : 'negative'}
              hint={`${summary.margin_pct}% de margen`}
            />
            <StatCard
              label="Pedidos"
              value={String(summary.orders_count)}
              change={percentChange(summary.orders_count, previous.orders_count)}
              icon={ShoppingBag}
            />
            <StatCard
              label="Ticket promedio"
              value={money(summary.average_ticket)}
              change={percentChange(summary.average_ticket, previous.average_ticket)}
              icon={BarChart3}
            />
          </div>

          <section className="surface p-5">
            <h2 className="mb-4 text-sm font-semibold text-stone-900">
              Evolución de facturación y gastos
            </h2>
            <TimeBars data={data.revenue_series} showExpenses height={220} />
          </section>

          <div className="grid gap-6 lg:grid-cols-2">
            <Panel title="Productos más vendidos">
              <RankingBars items={data.top_products} secondaryLabel="u." />
            </Panel>

            <Panel title="Mejores clientes">
              <RankingBars items={data.top_customers} secondaryLabel="ped." />
            </Panel>

            <Panel title="Ventas por categoría">
              <RankingBars items={data.sales_by_category} />
            </Panel>

            <Panel title="Distribución de gastos">
              <RankingBars
                items={data.expenses_by_category}
                color="#eb6834"
                emptyMessage="No registraste gastos en este período."
              />
            </Panel>

            <Panel title="Pedidos por estado">
              <RankingBars
                items={data.orders_by_status}
                format="number"
                color="#0f766e"
                emptyMessage="Sin pedidos en este período."
              />
            </Panel>

            <Panel title="Rentabilidad">
              <dl className="space-y-2.5 text-sm">
                <SummaryRow label="Facturación" value={money(summary.revenue)} />
                <SummaryRow
                  label="Costo de producción"
                  value={money(summary.production_cost)}
                  hint="Costo teórico de lo que entregaste, según receta o costo cargado."
                />
                <SummaryRow
                  label="Margen bruto"
                  value={money(summary.revenue - summary.production_cost)}
                  accent="positive"
                />
                <SummaryRow label="Gastos registrados" value={money(summary.expenses)} />
                <SummaryRow
                  label="Ganancia estimada"
                  value={money(summary.profit)}
                  accent={summary.profit >= 0 ? 'positive' : 'negative'}
                  strong
                />
              </dl>
              <p className="mt-4 border-t border-stone-100 pt-3 text-xs text-stone-500">
                La ganancia es facturación menos gastos registrados. El costo de producción se
                muestra aparte para no contar dos veces la compra de insumos. Es un resumen de
                gestión, no una liquidación contable.
              </p>
            </Panel>
          </div>
        </>
      )}
    </div>
  );
}

function Panel({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="surface p-5">
      <h2 className="mb-4 text-sm font-semibold text-stone-900">{title}</h2>
      {children}
    </section>
  );
}

function SummaryRow({
  label,
  value,
  hint,
  accent,
  strong,
}: {
  label: string;
  value: string;
  hint?: string;
  accent?: 'positive' | 'negative';
  strong?: boolean;
}) {
  return (
    <div>
      <div className="flex items-baseline justify-between gap-3">
        <dt className="text-stone-600">{label}</dt>
        <dd
          className={cn(
            'tabular',
            strong ? 'text-base font-semibold' : 'font-medium',
            accent === 'positive' && 'text-brand-700',
            accent === 'negative' && 'text-rose-600',
            !accent && 'text-stone-900'
          )}
        >
          {value}
        </dd>
      </div>
      {hint && <p className="mt-0.5 text-xs text-stone-400">{hint}</p>}
    </div>
  );
}
