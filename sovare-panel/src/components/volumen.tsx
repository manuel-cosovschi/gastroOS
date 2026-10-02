import { createServerClient } from '@/lib/supabase/server';
import { SectionCard } from '@/components/ui';
import { cn } from '@/lib/utils';

/**
 * Cuántos pedidos tuvo este cliente cada mes, y en qué escalón cae.
 *
 * Desde que el precio se cobra por pedidos, esta es la pantalla que decide la
 * factura. El escalón sugerido sale de `sovare.plans.max_orders` y no de una
 * constante acá: el día que un corte se mueva, se mueve en un solo lugar y la
 * landing y el panel siguen diciendo lo mismo.
 *
 * El mes en curso se marca aparte porque todavía no terminó: compararlo con los
 * cerrados y concluir que el cliente bajó de volumen es el error fácil.
 */
export async function VolumenDePedidos({
  clientId,
  planActual,
}: {
  clientId: string;
  planActual: string | null;
}) {
  const supabase = await createServerClient();

  const [{ data: meses }, { data: planes }] = await Promise.all([
    supabase.rpc('pedidos_por_mes', { p_meses: 6 }),
    supabase.from('plans').select('code, label, monthly, max_orders, is_active').order('sort_order'),
  ]);

  const mios = ((meses ?? []) as { client_id: string; mes: string; pedidos: number }[])
    .filter((m) => m.client_id === clientId)
    .sort((a, b) => a.mes.localeCompare(b.mes));

  if (mios.length === 0) {
    return (
      <SectionCard title="Pedidos por mes">
        <p className="px-5 py-6 text-sm leading-relaxed text-stone-500">
          Todavía no hay pedidos para medir. Si el cliente ya está funcionando, puede que falte
          enlazar su ficha con el negocio: se hace cargando el campo <code>business_id</code>.
        </p>
      </SectionCard>
    );
  }

  const activos = ((planes ?? []) as {
    code: string;
    label: string;
    monthly: number;
    max_orders: number | null;
    is_active: boolean;
  }[]).filter((p) => p.is_active);

  const mesEnCurso = new Date().toISOString().slice(0, 7);
  const cerrados = mios.filter((m) => !m.mes.startsWith(mesEnCurso));

  // El escalón se decide por el mejor mes cerrado, no por el promedio: lo que
  // tiene que aguantar el sistema es el pico, no el término medio.
  const pico = cerrados.length > 0 ? Math.max(...cerrados.map((m) => m.pedidos)) : 0;
  const sugerido =
    activos.find((p) => p.max_orders !== null && pico <= p.max_orders) ??
    activos[activos.length - 1];

  const maximo = Math.max(...mios.map((m) => m.pedidos), 1);
  const cambia = Boolean(planActual && sugerido && planActual !== sugerido.code);

  return (
    <SectionCard title="Pedidos por mes">
      <div className="space-y-4 px-5 py-4">
        <ul className="space-y-2">
          {mios.map((m) => {
            const enCurso = m.mes.startsWith(mesEnCurso);
            return (
              <li key={m.mes} className="flex items-center gap-3">
                <span className="w-20 shrink-0 text-xs text-stone-500">
                  {new Date(`${m.mes}T12:00:00`).toLocaleDateString('es-AR', {
                    month: 'short',
                    year: '2-digit',
                  })}
                </span>
                <div className="h-5 flex-1 overflow-hidden rounded bg-stone-100">
                  <div
                    className={cn('h-full rounded', enCurso ? 'bg-stone-300' : 'bg-brand-600')}
                    style={{ width: `${Math.max((m.pedidos / maximo) * 100, 3)}%` }}
                  />
                </div>
                <span className="w-16 shrink-0 text-right text-sm font-medium tabular text-stone-900">
                  {m.pedidos}
                </span>
              </li>
            );
          })}
        </ul>

        <p className="text-xs text-stone-400">
          El mes en curso va en gris porque todavía no terminó.
        </p>

        {sugerido && (
          <div
            className={cn(
              'rounded-lg border p-3 text-sm leading-relaxed',
              cambia
                ? 'border-amber-200 bg-amber-50 text-amber-900'
                : 'border-stone-200 bg-stone-50 text-stone-600'
            )}
          >
            {pico === 0 ? (
              <>Todavía no hay un mes cerrado para ubicarlo en un escalón.</>
            ) : cambia ? (
              <>
                Su mejor mes cerrado fueron <strong>{pico} pedidos</strong>, que caen en el plan{' '}
                <strong>{sugerido.label}</strong>. Hoy está en <strong>{planActual}</strong>.
              </>
            ) : (
              <>
                Su mejor mes cerrado fueron <strong>{pico} pedidos</strong>: está en el escalón que
                le corresponde, <strong>{sugerido.label}</strong>.
              </>
            )}
          </div>
        )}
      </div>
    </SectionCard>
  );
}
