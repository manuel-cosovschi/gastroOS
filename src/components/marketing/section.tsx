import { cn } from '@/lib/utils';

/** Encabezado de sección: mismo ritmo tipográfico en toda la landing. */
export function SectionHeading({
  eyebrow,
  title,
  subtitle,
  align = 'center',
  className,
}: {
  eyebrow?: string;
  title: string;
  subtitle?: string;
  align?: 'center' | 'left';
  className?: string;
}) {
  return (
    <div
      className={cn(
        'max-w-2xl',
        align === 'center' ? 'mx-auto text-center' : 'text-left',
        className
      )}
    >
      {eyebrow && (
        <p className="text-xs font-semibold uppercase tracking-wider text-brand-700">{eyebrow}</p>
      )}
      <h2 className="mt-2 text-3xl font-semibold tracking-tight text-stone-900 sm:text-4xl">
        {title}
      </h2>
      {subtitle && <p className="mt-4 text-lg leading-relaxed text-stone-600">{subtitle}</p>}
    </div>
  );
}

/** Marco de navegador para las capturas de producto. */
export function BrowserFrame({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        'overflow-hidden rounded-xl border border-stone-200 bg-white shadow-lift',
        className
      )}
    >
      <div className="flex items-center gap-1.5 border-b border-stone-200 bg-stone-50 px-3 py-2.5">
        <span className="h-2.5 w-2.5 rounded-full bg-stone-300" />
        <span className="h-2.5 w-2.5 rounded-full bg-stone-300" />
        <span className="h-2.5 w-2.5 rounded-full bg-stone-300" />
      </div>
      {children}
    </div>
  );
}
