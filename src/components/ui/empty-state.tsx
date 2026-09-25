import Link from 'next/link';
import { cn } from '@/lib/utils';

/**
 * Estado vacío. Siempre explica qué se vería acá y ofrece la acción que lo
 * llena: una pantalla en blanco sin salida es la peor primera impresión.
 */
export function EmptyState({
  icon: Icon,
  title,
  description,
  actionLabel,
  actionHref,
  onAction,
  className,
}: {
  icon?: React.ComponentType<{ className?: string }>;
  title: string;
  description?: string;
  actionLabel?: string;
  actionHref?: string;
  onAction?: () => void;
  className?: string;
}) {
  return (
    <div className={cn('flex flex-col items-center px-6 py-14 text-center', className)}>
      {Icon && (
        <span className="mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-stone-100">
          <Icon className="h-5 w-5 text-stone-400" />
        </span>
      )}
      <p className="text-sm font-medium text-stone-900">{title}</p>
      {description && <p className="mt-1 max-w-sm text-sm text-stone-500">{description}</p>}
      {actionLabel && actionHref && (
        <Link
          href={actionHref}
          className="mt-4 inline-flex h-9 items-center rounded-lg bg-stone-900 px-4 text-sm font-medium text-white transition-colors hover:bg-stone-800"
        >
          {actionLabel}
        </Link>
      )}
      {actionLabel && !actionHref && onAction && (
        <button
          onClick={onAction}
          className="mt-4 inline-flex h-9 items-center rounded-lg bg-stone-900 px-4 text-sm font-medium text-white transition-colors hover:bg-stone-800"
        >
          {actionLabel}
        </button>
      )}
    </div>
  );
}
