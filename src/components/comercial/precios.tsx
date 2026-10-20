import Link from 'next/link';
import { Check } from 'lucide-react';
import { PRICING } from '@/lib/marketing';
import { getPlanAmounts, signupsEnabled } from '@/lib/signups';
import { cn } from '@/lib/utils';
import { BOTON, TARJETA } from '@/lib/comercial/tema';
import { Bajada, Rotulo, Seccion, Tarjeta, Titulo } from './piezas';

/**
 * Los planes.
 *
 * Los números salen de `sovare.plans`, que es lo que se le va a pedir
 * transferir a alguien. Los de `PRICING` quedan de respaldo si la base no
 * contesta: es mejor mostrar el precio de la última versión desplegada que
 * dejar la sección vacía. Si se desfasan, el que manda en la contratación es el
 * de la base.
 *
 * Lo que antes eran cuatro cajas de texto —el medidor, la puesta a punto, lo
 * que no entra, el cierre— quedó en un renglón cada una. El detalle largo sigue
 * existiendo: está en las preguntas, que es donde lo busca quien lo quiere.
 */

const plata = (n: number) =>
  new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS', maximumFractionDigits: 0 }).format(n);

/** Las tres primeras de cada plan: la cuarta en adelante es detalle para la charla. */
const CUANTAS = 4;

export async function Precios({ id = 'precios' }: { id?: string } = {}) {
  const contratar = signupsEnabled();
  const montos = contratar ? await getPlanAmounts() : [];
  // Por código, no por posición: la puesta a punto es distinta en cada plan y
  // leer la del primero de la lista fue lo que una vez puso «$0» en la página.
  const mensual = (code: string, respaldo: number) => montos.find((p) => p.code === code)?.monthly ?? respaldo;
  const puesta = (code: string, respaldo: number) => montos.find((p) => p.code === code)?.setup ?? respaldo;

  return (
    <Seccion id={id}>
      <div data-revelar="pendiente">
        <Rotulo centrado>Precios</Rotulo>
        <div className="mt-4">
          <Titulo centrado acento="no por lo que vendés">
            Se paga por los pedidos que entran,
          </Titulo>
        </div>
        <Bajada centrado className="mt-5 max-w-2xl">
          Todos los planes traen el sistema entero. Sin porcentaje sobre tus ventas y
          sin permanencia: si un mes no va más, avisás y te llevás tus datos.
        </Bajada>
      </div>

      <div className="mt-12 grid gap-5 sm:grid-cols-2 xl:grid-cols-4">
        {PRICING.plans.map((plan, i) => {
          const setup = puesta(plan.code, plan.setup);
          return (
            <div key={plan.code} data-revelar="pendiente" style={{ transitionDelay: `${i * 70}ms` }}>
              <div
                className={cn(
                  TARJETA,
                  'flex h-full flex-col p-6',
                  plan.highlight && 'border-brand-400/50 bg-brand-400/[0.06]'
                )}
              >
                {/* El hueco del distintivo existe en las cuatro tarjetas, tenga o
                    no distintivo: si sólo lo tuviera la destacada, sus precios
                    quedarían a otra altura que los de las demás. */}
                <div className="mb-3 h-[22px]">
                  {plan.highlight && (
                    <span className="rounded-full bg-brand-400/15 px-2.5 py-0.5 text-[11px] font-bold uppercase tracking-[0.18em] text-brand-300">
                      El que recomendamos
                    </span>
                  )}
                </div>
                <h3 className="font-display text-xl font-black italic uppercase tracking-[-0.02em] text-stone-50">
                  {plan.name}
                </h3>
                <p className="mt-1 text-sm font-semibold text-brand-300">{plan.limit}</p>

                <p className="mt-4 flex flex-wrap items-baseline gap-x-1.5">
                  {'priceFrom' in plan && plan.priceFrom && <span className="text-sm text-stone-300">desde</span>}
                  <span className="text-3xl font-black tabular-nums tracking-tight text-stone-50">
                    {plata(mensual(plan.code, plan.price))}
                  </span>
                  <span className="text-sm text-stone-300">{plan.unit}</span>
                </p>
                {/* El pago único al lado de la mensualidad, no veinte líneas más
                    abajo: enterarse recién en la contratación se siente como
                    letra chica aunque esté escrito. */}
                <p className="mt-1 text-sm text-stone-300 sm:min-h-[2.5rem]">
                  {setup > 0 ? `+ ${plata(setup)} de puesta a punto, una sola vez` : 'Sin puesta a punto'}
                </p>

                <ul className="mt-5 flex-1 space-y-2.5">
                  {plan.features.slice(0, CUANTAS).map((f) => (
                    <li key={f} className="flex gap-2.5 text-sm leading-relaxed text-stone-300">
                      <Check className="mt-0.5 h-4 w-4 shrink-0 text-brand-400" aria-hidden />
                      {f}
                    </li>
                  ))}
                </ul>

                {contratar && (
                  <Link
                    href={`/contratar?plan=${plan.code}`}
                    // Lo lee `Rastreo` en la página de conversión: tocar
                    // «Contratar» es el inicio del pago.
                    data-conv-evento="InitiateCheckout"
                    data-conv-plan={plan.code}
                    data-conv-valor={mensual(plan.code, plan.price)}
                    className={cn(
                      'mt-6 inline-flex h-11 items-center justify-center rounded-xl text-sm font-bold transition-colors',
                      plan.highlight ? BOTON.principal : BOTON.secundario
                    )}
                  >
                    Contratar {plan.name}
                  </Link>
                )}
              </div>
            </div>
          );
        })}
      </div>

      <div className="mt-6 grid gap-4 lg:grid-cols-3" data-revelar="pendiente">
        <Tarjeta>
          <p className="text-sm font-bold text-stone-50">{PRICING.meter.title}</p>
          <p className="mt-2 text-sm leading-relaxed text-stone-300">
            Porque mide a la vez cuánto trabajo te saca y qué tamaño tiene tu negocio. Si un
            mes te pasás del escalón no se corta nada: el mes siguiente pasás al que te toca.
          </p>
        </Tarjeta>
        <Tarjeta>
          <p className="text-sm font-bold text-stone-50">{PRICING.setup.name}</p>
          <p className="mt-2 text-sm leading-relaxed text-stone-300">
            Es el trabajo de dejarte el sistema andando con tu negocio adentro: tu marca, tu
            catálogo, tus recetas y una capacitación. Se paga una vez y el Taller no la lleva.
          </p>
        </Tarjeta>
        <Tarjeta>
          <p className="text-sm font-bold text-stone-50">Lo que no entra</p>
          <p className="mt-2 text-sm leading-relaxed text-stone-300">
            El dominio: se registra a tu nombre en NIC Argentina para que, si un día te vas,
            se vaya con vos. Hora de soporte en el Taller: {plata(PRICING.hourly.price)}.
          </p>
        </Tarjeta>
      </div>

      <p className="mt-6 text-center text-sm leading-relaxed text-stone-300" data-revelar="pendiente">
        {PRICING.context} {PRICING.asOf}
      </p>
    </Seccion>
  );
}
