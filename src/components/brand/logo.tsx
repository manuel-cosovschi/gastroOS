import { cn } from '@/lib/utils';
import { APP_NAME } from '@/lib/constants';

/**
 * Identidad de GastroOS.
 *
 * El isotipo son tres barras apiladas dentro de un cuadrado redondeado: se lee
 * como una agenda del día y como un plato servido, sin caer en el cupcake.
 * Funciona en 16px (favicon) y en grande sin perder legibilidad.
 */

const SIZES = {
  sm: 'h-7 w-7',
  md: 'h-9 w-9',
  lg: 'h-12 w-12',
} as const;

export function LogoMark({
  size = 'md',
  className,
}: {
  size?: keyof typeof SIZES;
  className?: string;
}) {
  return (
    <span
      aria-hidden
      className={cn(
        'inline-flex shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-brand-500 to-brand-700 text-white shadow-sm',
        SIZES[size],
        className
      )}
    >
      <svg viewBox="0 0 24 24" fill="none" className="h-[60%] w-[60%]">
        <rect x="4" y="6" width="16" height="2.6" rx="1.3" fill="currentColor" />
        <rect x="4" y="11" width="11" height="2.6" rx="1.3" fill="currentColor" opacity="0.8" />
        <rect x="4" y="16" width="6" height="2.6" rx="1.3" fill="currentColor" opacity="0.6" />
      </svg>
    </span>
  );
}

export function Wordmark({ className }: { className?: string }) {
  return (
    <span className={cn('text-[15px] font-semibold tracking-tight text-stone-900', className)}>
      Gastro<span className="text-brand-600">OS</span>
    </span>
  );
}

export function Logo({
  size = 'md',
  className,
}: {
  size?: keyof typeof SIZES;
  className?: string;
}) {
  return (
    <span className={cn('inline-flex items-center gap-2.5', className)}>
      <LogoMark size={size} />
      <Wordmark />
      <span className="sr-only">{APP_NAME}</span>
    </span>
  );
}
