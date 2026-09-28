import Link from 'next/link';
import { cn } from '@/lib/utils';

/**
 * Primitivas del panel.
 *
 * Van todas en un archivo porque son pocas y chicas: repartirlas en diez
 * archivos de quince líneas sólo agrega saltos de navegación. Cuando alguna
 * crezca, sale de acá.
 */

export function StatCard({
  label,
  value,
  hint,
  icon: Icon,
  href,
  accent = 'default',
}: {
  label: string;
  value: string;
  hint?: string;
  icon?: React.ComponentType<{ className?: string }>;
  href?: string;
  accent?: 'default' | 'positive' | 'negative' | 'warning';
}) {
  const tone = {
    default: 'text-stone-900',
    positive: 'text-emerald-700',
    negative: 'text-rose-600',
    warning: 'text-amber-600',
  }[accent];

  const body = (
    <>
      <div className="flex items-start justify-between gap-2">
        <p className="text-sm font-medium text-stone-500">{label}</p>
        {Icon && <Icon className="h-4 w-4 shrink-0 text-stone-400" />}
      </div>
      <p className={cn('mt-2 text-2xl font-semibold tabular tracking-tight', tone)}>{value}</p>
      {hint && <p className="mt-1.5 text-xs leading-snug text-stone-500">{hint}</p>}
    </>
  );

  const className = cn('surface p-4', href && 'block transition-shadow hover:shadow-lift');

  return href ? (
    <Link href={href} className={className}>
      {body}
    </Link>
  ) : (
    <div className={className}>{body}</div>
  );
}

export function Badge({ className, children }: { className?: string; children: React.ReactNode }) {
  return (
    <span
      className={cn(
        'inline-flex shrink-0 items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-medium',
        className
      )}
    >
      {children}
    </span>
  );
}

export function SectionCard({
  title,
  action,
  children,
  className,
}: {
  title: string;
  action?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <section className={cn('surface', className)}>
      <header className="flex items-center justify-between gap-3 border-b border-stone-200 px-5 py-3.5">
        <h2 className="text-sm font-semibold text-stone-900">{title}</h2>
        {action}
      </header>
      {children}
    </section>
  );
}

export function EmptyState({
  title,
  description,
  action,
}: {
  title: string;
  description: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="px-5 py-10 text-center">
      <p className="text-sm font-medium text-stone-900">{title}</p>
      <p className="mx-auto mt-1.5 max-w-sm text-sm leading-relaxed text-stone-500">{description}</p>
      {action && <div className="mt-4 flex justify-center">{action}</div>}
    </div>
  );
}

export function Field({
  label,
  hint,
  children,
  className,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={className}>
      <span className="field-label">{label}</span>
      {children}
      {hint && <p className="mt-1 text-xs text-stone-500">{hint}</p>}
    </div>
  );
}
