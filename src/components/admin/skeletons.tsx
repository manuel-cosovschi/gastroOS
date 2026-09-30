import { Skeleton } from '@/components/ui/spinner';
import { cn } from '@/lib/utils';

/**
 * Esqueletos de carga del panel.
 *
 * No son decoración: son lo que hace que el panel se sienta instantáneo.
 *
 * Todas las pantallas de acá adentro son dinámicas (dependen de la sesión), y
 * en una ruta dinámica sin `loading.tsx` Next no tiene nada que precargar ni
 * nada que mostrar al hacer clic: el navegador se queda en la pantalla vieja
 * hasta que el servidor termina de responder. Con un `loading.tsx` pasan las
 * dos cosas — el clic cambia de pantalla en el acto, y el `<Link>` puede
 * guardarse esta cáscara de antemano.
 *
 * Por eso cada esqueleto imita la forma de su pantalla en vez de ser un
 * spinner al medio: lo que se ve primero tiene que ser la pantalla a la que
 * se está yendo, no un cartel de espera.
 */

function Line({ className }: { className?: string }) {
  return <Skeleton className={cn('h-4', className)} />;
}

/** Encabezado: título, bajada y el botón de acción de la derecha. */
function HeaderSkeleton({ action = true }: { action?: boolean }) {
  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
      <div className="min-w-0 space-y-2">
        <Skeleton className="h-7 w-44" />
        <Line className="w-64 max-w-full" />
      </div>
      {action && <Skeleton className="h-10 w-full rounded-lg sm:w-36" />}
    </div>
  );
}

/** Pantallas de listado: encabezado, filtros y filas. */
export function ListSkeleton({
  rows = 6,
  filters = true,
  action = true,
}: {
  rows?: number;
  filters?: boolean;
  action?: boolean;
}) {
  return (
    <div className="space-y-6">
      <HeaderSkeleton action={action} />

      {filters && (
        <div className="flex flex-wrap gap-2">
          <Skeleton className="h-10 flex-1 rounded-lg" />
          <Skeleton className="h-10 w-28 rounded-lg" />
          <Skeleton className="h-10 w-28 rounded-lg" />
        </div>
      )}

      <div className="surface divide-y divide-stone-100 overflow-hidden">
        {Array.from({ length: rows }, (_, row) => (
          <div key={row} className="flex items-center gap-4 p-4">
            <Skeleton className="h-10 w-10 shrink-0 rounded-lg" />
            <div className="min-w-0 flex-1 space-y-2">
              <Line className={row % 3 === 0 ? 'w-48' : row % 3 === 1 ? 'w-40' : 'w-56'} />
              <Line className="h-3 w-28" />
            </div>
            <Skeleton className="hidden h-6 w-20 rounded-full sm:block" />
            <Skeleton className="h-4 w-16" />
          </div>
        ))}
      </div>
    </div>
  );
}

/** Rejilla de tarjetas: productos, combos, categorías. */
export function GridSkeleton({ cards = 8 }: { cards?: number }) {
  return (
    <div className="space-y-6">
      <HeaderSkeleton />

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-3 xl:grid-cols-4">
        {Array.from({ length: cards }, (_, card) => (
          <div key={card} className="surface space-y-3 p-4">
            <Skeleton className="aspect-square w-full rounded-lg" />
            <Line className="w-3/4" />
            <Line className="h-3 w-1/2" />
          </div>
        ))}
      </div>
    </div>
  );
}

/** Dashboard: la fila de números de arriba y los dos paneles de abajo. */
export function DashboardSkeleton() {
  return (
    <div className="space-y-8">
      <div className="space-y-2">
        <Line className="h-3 w-40" />
        <Skeleton className="h-8 w-56" />
        <Line className="w-72 max-w-full" />
      </div>

      <section className="space-y-3">
        <Line className="h-3 w-32" />
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-3 xl:grid-cols-6">
          {Array.from({ length: 6 }, (_, card) => (
            <div key={card} className="surface space-y-3 p-4">
              <Skeleton className="h-8 w-8 rounded-lg" />
              <Line className="h-3 w-20" />
              <Skeleton className="h-6 w-24" />
            </div>
          ))}
        </div>
      </section>

      <div className="grid gap-4 lg:grid-cols-2">
        {[0, 1].map((panel) => (
          <div key={panel} className="surface space-y-4 p-5">
            <Line className="w-36" />
            {Array.from({ length: 4 }, (_, row) => (
              <div key={row} className="flex items-center gap-3">
                <Skeleton className="h-9 w-9 shrink-0 rounded-lg" />
                <div className="flex-1 space-y-2">
                  <Line className="w-2/3" />
                  <Line className="h-3 w-1/3" />
                </div>
              </div>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}

/** Calendario: la grilla del mes. */
export function CalendarSkeleton() {
  return (
    <div className="space-y-6">
      <HeaderSkeleton />
      <div className="surface p-4">
        <div className="mb-4 flex items-center justify-between">
          <Skeleton className="h-9 w-9 rounded-lg" />
          <Skeleton className="h-5 w-36" />
          <Skeleton className="h-9 w-9 rounded-lg" />
        </div>
        <div className="grid grid-cols-7 gap-1.5">
          {Array.from({ length: 35 }, (_, day) => (
            <Skeleton key={day} className="aspect-square rounded-lg" />
          ))}
        </div>
      </div>
    </div>
  );
}

/** Estadísticas: tarjetas de números y dos gráficos. */
export function StatsSkeleton() {
  return (
    <div className="space-y-6">
      <HeaderSkeleton action={false} />
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {Array.from({ length: 4 }, (_, card) => (
          <div key={card} className="surface space-y-3 p-4">
            <Line className="h-3 w-20" />
            <Skeleton className="h-7 w-24" />
          </div>
        ))}
      </div>
      {[0, 1].map((chart) => (
        <div key={chart} className="surface space-y-4 p-5">
          <Line className="w-40" />
          <Skeleton className="h-48 w-full rounded-lg" />
        </div>
      ))}
    </div>
  );
}

/** Formularios largos: configuración, alta y edición. */
export function FormSkeleton({ groups = 3 }: { groups?: number }) {
  return (
    <div className="space-y-6">
      <HeaderSkeleton action={false} />
      {Array.from({ length: groups }, (_, group) => (
        <div key={group} className="surface space-y-4 p-5 sm:p-6">
          <Line className="w-40" />
          {Array.from({ length: 3 }, (_, field) => (
            <div key={field} className="space-y-2">
              <Line className="h-3 w-24" />
              <Skeleton className="h-10 w-full rounded-lg" />
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}

/** Ficha de detalle: pedido, cliente, producto. */
export function DetailSkeleton() {
  return (
    <div className="space-y-6">
      <Line className="h-3 w-28" />
      <HeaderSkeleton />
      <div className="grid gap-4 lg:grid-cols-3">
        <div className="space-y-4 lg:col-span-2">
          {[0, 1].map((block) => (
            <div key={block} className="surface space-y-4 p-5">
              <Line className="w-36" />
              {Array.from({ length: 3 }, (_, row) => (
                <div key={row} className="flex items-center justify-between gap-4">
                  <Line className="w-1/2" />
                  <Line className="w-16" />
                </div>
              ))}
            </div>
          ))}
        </div>
        <div className="surface space-y-3 p-5">
          <Line className="w-24" />
          {Array.from({ length: 5 }, (_, row) => (
            <Line key={row} className="h-3 w-full" />
          ))}
        </div>
      </div>
    </div>
  );
}
