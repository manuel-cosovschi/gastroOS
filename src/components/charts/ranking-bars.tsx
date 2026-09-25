'use client';

import { cn } from '@/lib/utils';
import { useMoney } from '@/components/admin/business-provider';
import type { RankedItem } from '@/types';

/**
 * Ranking horizontal (productos más vendidos, mejores clientes, gastos por
 * categoría). Una sola serie: un único color, sin leyenda — el título del
 * bloque ya dice qué se está midiendo.
 */
export function RankingBars({
  items,
  format = 'money',
  color = '#047857',
  secondaryLabel,
  emptyMessage = 'Sin datos en este período.',
  max: maxItems,
}: {
  items: RankedItem[];
  format?: 'money' | 'number';
  color?: string;
  /** Sufijo del dato secundario, p. ej. "u." de unidades o "pedidos". */
  secondaryLabel?: string;
  emptyMessage?: string;
  max?: number;
}) {
  const money = useMoney();
  const visible = maxItems ? items.slice(0, maxItems) : items;

  if (visible.length === 0) {
    return <p className="py-8 text-center text-sm text-stone-500">{emptyMessage}</p>;
  }

  const top = Math.max(...visible.map((item) => item.value), 1);
  const total = visible.reduce((sum, item) => sum + item.value, 0);

  return (
    <ul className="space-y-3">
      {visible.map((item) => {
        const share = total > 0 ? Math.round((item.value / total) * 100) : 0;
        return (
          <li key={item.id}>
            <div className="flex items-baseline justify-between gap-3">
              <span className="truncate text-sm text-stone-700">{item.label}</span>
              <span className="shrink-0 text-sm font-semibold tabular text-stone-900">
                {format === 'money' ? money(item.value) : item.value}
              </span>
            </div>
            <div className="mt-1.5 flex items-center gap-2">
              <span className="h-2 flex-1 overflow-hidden rounded-full bg-stone-100">
                <span
                  className="block h-full rounded-full transition-all"
                  style={{
                    width: `${Math.max(2, (item.value / top) * 100)}%`,
                    backgroundColor: color,
                  }}
                />
              </span>
              <span className={cn('w-16 shrink-0 text-right text-xs text-stone-500')}>
                {item.secondary !== undefined
                  ? `${item.secondary} ${secondaryLabel ?? ''}`.trim()
                  : `${share}%`}
              </span>
            </div>
          </li>
        );
      })}
    </ul>
  );
}
