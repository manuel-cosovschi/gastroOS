import Link from 'next/link';
import { ArrowDownRight, ArrowUpRight, Minus } from 'lucide-react';
import { cn } from '@/lib/utils';

interface StatCardProps {
  label: string;
  value: string;
  /** Variación porcentual contra el período anterior. null = sin base de comparación. */
  change?: number | null;
  /** En gastos, subir es malo: invierte el color de la variación. */
  invertChange?: boolean;
  hint?: string;
  icon?: React.ComponentType<{ className?: string }>;
  href?: string;
  accent?: 'default' | 'positive' | 'negative' | 'warning';
}

const ACCENTS = {
  default: 'text-stone-900',
  positive: 'text-brand-700',
  negative: 'text-rose-600',
  warning: 'text-amber-600',
} as const;

export function StatCard({
  label,
  value,
  change,
  invertChange = false,
  hint,
  icon: Icon,
  href,
  accent = 'default',
}: StatCardProps) {
  const body = (
    <>
      <div className="flex items-start justify-between gap-2">
        <p className="text-sm font-medium text-stone-500">{label}</p>
        {Icon && <Icon className="h-4 w-4 shrink-0 text-stone-400" />}
      </div>
      <p className={cn('mt-2 text-2xl font-semibold tabular tracking-tight', ACCENTS[accent])}>
        {value}
      </p>
      {/* Sin base de comparación no mostramos nada: un "sin comparación" en
          cada tarjeta ensucia más de lo que informa. */}
      {change !== undefined && change !== null && (
        <div className="mt-1.5 text-xs">
          <ChangeBadge change={change} invert={invertChange} />
        </div>
      )}
      {hint && <p className="mt-1.5 text-xs leading-snug text-stone-500">{hint}</p>}
    </>
  );

  const className = cn(
    'surface p-4 transition-shadow',
    href && 'hover:shadow-lift focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500'
  );

  if (href) {
    return (
      <Link href={href} className={cn(className, 'block')}>
        {body}
      </Link>
    );
  }

  return <div className={className}>{body}</div>;
}

function ChangeBadge({ change, invert }: { change: number; invert: boolean }) {
  if (change === 0) {
    return (
      <span className="inline-flex items-center gap-0.5 font-medium text-stone-500">
        <Minus className="h-3 w-3" /> 0%
      </span>
    );
  }

  const isUp = change > 0;
  const isGood = invert ? !isUp : isUp;
  const Icon = isUp ? ArrowUpRight : ArrowDownRight;

  return (
    <span
      className={cn(
        'inline-flex items-center gap-0.5 font-medium',
        isGood ? 'text-brand-700' : 'text-rose-600'
      )}
    >
      <Icon className="h-3 w-3" />
      {Math.abs(change)}%
    </span>
  );
}
