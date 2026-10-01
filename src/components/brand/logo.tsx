import { cn } from '@/lib/utils';
import { APP_NAME } from '@/lib/constants';

/**
 * Identidad de GastroOS — dirección "Gastronómico cálido".
 *
 * El isotipo es una cloche: la cúpula y la bandeja en oliva, y el pomo en
 * terracota. Dice "comida servida" sin caer en el cupcake ni en el chef con
 * gorro, y sirve igual para una pastelería que para un catering o una rotisería.
 *
 * No va dentro de un cuadrado de color. La marca es el dibujo, y sobre la
 * crema de la página se sostiene solo; encerrarlo en una pastilla verde era
 * de la paleta anterior.
 *
 * Abajo de 24px el cuello desaparece: a ese tamaño el trazo que une la cúpula
 * con el pomo se empasta y ensucia la silueta, así que queda la cúpula con el
 * punto flotando, que es lo que se reconoce. Eso lo decide `compact`, no un
 * media query, porque el tamaño lo elige quien usa el componente.
 */

const SIZES = {
  sm: 'h-7 w-7',
  md: 'h-9 w-9',
  lg: 'h-12 w-12',
} as const;

export function LogoMark({
  size = 'md',
  tone = 'default',
  className,
}: {
  size?: keyof typeof SIZES;
  /** `onDark` sube la terracota un escalón: sobre oliva, la de marca se apaga. */
  tone?: 'default' | 'onDark';
  className?: string;
}) {
  const compact = size === 'sm';

  return (
    <svg
      aria-hidden
      viewBox="0 0 24 24"
      fill="none"
      className={cn('shrink-0', SIZES[size], className)}
    >
      {/* Bandeja y cúpula: un solo trazo continuo de grosor parejo. */}
      <g
        className={tone === 'onDark' ? 'stroke-stone-50' : 'stroke-stone-900'}
        strokeWidth={2}
        strokeLinecap="round"
      >
        <path d="M4.6 18.4a7.4 7.4 0 0 1 14.8 0" />
        <path d="M2.6 18.4h18.8" />
        {!compact && <path d="M12 11v-2.4" />}
      </g>

      <circle
        cx="12"
        cy={compact ? 8.4 : 6.4}
        r={compact ? 2.3 : 2.1}
        className={tone === 'onDark' ? 'fill-brand-400' : 'fill-brand-600'}
      />
    </svg>
  );
}

export function Wordmark({
  tone = 'default',
  className,
}: {
  tone?: 'default' | 'onDark';
  className?: string;
}) {
  return (
    <span
      className={cn(
        'font-display text-[19px] font-bold leading-none tracking-[-0.01em]',
        tone === 'onDark' ? 'text-stone-50' : 'text-stone-900',
        className
      )}
    >
      Gastro
      <span className={tone === 'onDark' ? 'text-brand-400' : 'text-brand-600'}>OS</span>
    </span>
  );
}

export function Logo({
  size = 'md',
  tone = 'default',
  className,
}: {
  size?: keyof typeof SIZES;
  tone?: 'default' | 'onDark';
  className?: string;
}) {
  return (
    <span className={cn('inline-flex items-center gap-2.5', className)}>
      <LogoMark size={size} tone={tone} />
      <Wordmark tone={tone} />
      <span className="sr-only">{APP_NAME}</span>
    </span>
  );
}
