'use client';

import { useState } from 'react';
import { cn } from '@/lib/utils';
import { useMoney } from '@/components/admin/business-provider';
import type { TimeSeriesPoint } from '@/types';

/**
 * Evolución diaria de facturación y (opcionalmente) gastos.
 *
 * Los dos valores son dinero, así que comparten un único eje: nunca se usa un
 * segundo eje. Las barras se construyen con divs en vez de SVG porque así el
 * gráfico es responsive sin recalcular un viewBox, y cada barra puede ser su
 * propio target de hover con un área táctil cómoda en mobile.
 */

/** Paleta categórica validada para este par (ΔE CVD 8.1, contraste ≥ 3:1). */
const SERIES = {
  revenue: '#047857',
  expenses: '#eb6834',
} as const;

interface TimeBarsProps {
  data: TimeSeriesPoint[];
  showExpenses?: boolean;
  height?: number;
  /** Con muchos días sólo se rotulan algunos para que el eje no se amontone. */
  labelEvery?: number;
}

export function TimeBars({
  data,
  showExpenses = false,
  height = 200,
  labelEvery,
}: TimeBarsProps) {
  const money = useMoney();
  const [hovered, setHovered] = useState<number | null>(null);

  if (data.length === 0) {
    return (
      <p className="py-12 text-center text-sm text-stone-500">
        Todavía no hay datos para este período.
      </p>
    );
  }

  const max = Math.max(
    1,
    ...data.map((point) => Math.max(point.revenue, showExpenses ? point.expenses || 0 : 0))
  );

  const step = labelEvery ?? (data.length > 20 ? 5 : data.length > 10 ? 2 : 1);

  return (
    <div>
      {showExpenses && (
        <div className="mb-3 flex items-center gap-4 text-xs text-stone-600">
          <LegendItem color={SERIES.revenue} label="Facturación" />
          <LegendItem color={SERIES.expenses} label="Gastos" />
        </div>
      )}

      <div className="relative" style={{ height }}>
        {/* Grilla de fondo, deliberadamente tenue */}
        <div className="absolute inset-0 flex flex-col justify-between">
          {[0, 1, 2, 3].map((line) => (
            <div key={line} className="border-t border-dashed border-stone-100" />
          ))}
        </div>

        <div className="relative flex h-full items-end gap-[2px]">
          {data.map((point, index) => {
            const isHovered = hovered === index;
            return (
              <div
                key={point.date}
                className="group relative flex h-full flex-1 items-end justify-center gap-[2px]"
                onMouseEnter={() => setHovered(index)}
                onMouseLeave={() => setHovered(null)}
                onFocus={() => setHovered(index)}
                onBlur={() => setHovered(null)}
                tabIndex={0}
              >
                <Bar value={point.revenue} max={max} color={SERIES.revenue} dim={hovered !== null && !isHovered} />
                {showExpenses && (
                  <Bar
                    value={point.expenses || 0}
                    max={max}
                    color={SERIES.expenses}
                    dim={hovered !== null && !isHovered}
                  />
                )}

                {isHovered && (
                  <div
                    className={cn(
                      'pointer-events-none absolute bottom-full z-20 mb-2 w-max max-w-[180px] rounded-lg',
                      'border border-stone-200 bg-white px-3 py-2 text-left shadow-lift'
                    )}
                  >
                    <p className="text-xs font-medium text-stone-900">{point.label}</p>
                    <p className="mt-1 text-xs text-stone-600">
                      Facturación{' '}
                      <span className="font-semibold tabular text-stone-900">
                        {money(point.revenue)}
                      </span>
                    </p>
                    {showExpenses && (
                      <p className="text-xs text-stone-600">
                        Gastos{' '}
                        <span className="font-semibold tabular text-stone-900">
                          {money(point.expenses || 0)}
                        </span>
                      </p>
                    )}
                    <p className="text-xs text-stone-500">
                      {point.orders} {point.orders === 1 ? 'pedido' : 'pedidos'}
                    </p>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      <div className="mt-2 flex gap-[2px]">
        {data.map((point, index) => (
          <span
            key={point.date}
            className="flex-1 truncate text-center text-[10px] text-stone-400"
          >
            {index % step === 0 ? point.short : ''}
          </span>
        ))}
      </div>

      {/* Alternativa accesible: los mismos datos en texto.
          El wrapper es necesario: una <table> no respeta el height:1px de
          `sr-only` y estira la altura del documento. */}
      <div className="sr-only">
      <table>
        <caption>Facturación por día</caption>
        <thead>
          <tr>
            <th>Fecha</th>
            <th>Facturación</th>
            {showExpenses && <th>Gastos</th>}
            <th>Pedidos</th>
          </tr>
        </thead>
        <tbody>
          {data.map((point) => (
            <tr key={point.date}>
              <td>{point.label}</td>
              <td>{money(point.revenue)}</td>
              {showExpenses && <td>{money(point.expenses || 0)}</td>}
              <td>{point.orders}</td>
            </tr>
          ))}
        </tbody>
      </table>
      </div>
    </div>
  );
}

function Bar({
  value,
  max,
  color,
  dim,
}: {
  value: number;
  max: number;
  color: string;
  dim: boolean;
}) {
  // Un valor mayor a cero nunca desaparece: siempre deja al menos 2px de marca.
  const pct = value > 0 ? Math.max(2, (value / max) * 100) : 0;

  return (
    <span
      className="w-full max-w-[14px] rounded-t transition-opacity"
      style={{
        height: `${pct}%`,
        backgroundColor: color,
        opacity: dim ? 0.35 : 1,
      }}
    />
  );
}

function LegendItem({ color, label }: { color: string; label: string }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <span className="h-2.5 w-2.5 rounded-sm" style={{ backgroundColor: color }} />
      {label}
    </span>
  );
}
