import { cn } from '@/lib/utils';

export function Spinner({ className }: { className?: string }) {
  return (
    <span
      role="status"
      aria-label="Cargando"
      className={cn(
        'inline-block h-5 w-5 animate-spin rounded-full border-2 border-stone-200 border-t-stone-900',
        className
      )}
    />
  );
}

/** Bloque de carga a pantalla completa para rutas del panel. */
export function LoadingBlock({ label = 'Cargando…' }: { label?: string }) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 py-20">
      <Spinner className="h-6 w-6" />
      <p className="text-sm text-stone-500">{label}</p>
    </div>
  );
}

/** Placeholder de contenido mientras llegan los datos. */
export function Skeleton({ className }: { className?: string }) {
  return <div className={cn('animate-pulse rounded-md bg-stone-200/70', className)} />;
}
