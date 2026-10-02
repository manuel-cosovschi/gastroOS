import Link from 'next/link';
import { Check, Info, Unlock, Wrench } from 'lucide-react';
import { cn } from '@/lib/utils';
import { PRICING } from '@/lib/marketing';
import { getPlanAmounts, signupsEnabled } from '@/lib/signups';
import { Button } from '@/components/ui/button';
import { SectionHeading } from '@/components/marketing/section';
import { BookMeetingButton, TrySystemButton } from '@/components/marketing/cta-buttons';

/**
 * Planes.
 *
 * La puesta a punto va separada de las mensualidades y no como una cuarta
 * columna: es un pago único y mezclarla con los planes hace que el visitante
 * compare tres números que no son comparables.
 *
 * No se renderiza si `PRICING.enabled` es false: una página de venta con
 * precios que el dueño del negocio no eligió es peor que una sin precios.
 *
 * Los números salen de `sovare.plans`, que es lo que se le va a pedir
 * transferir a alguien. Los de `PRICING` quedan como respaldo para el caso en
 * que la base no esté disponible: es mejor mostrar el precio de la última
 * versión desplegada que dejar la sección sin precios. Si algún día se
 * desfasan, el que manda en la contratación es el de la base.
 */

const money = (value: number) =>
  new Intl.NumberFormat('es-AR', {
    style: 'currency',
    currency: 'ARS',
    maximumFractionDigits: 0,
  }).format(value);

export async function Pricing() {
  if (!PRICING.enabled) return null;

  const canSignUp = signupsEnabled();
  const amounts = canSignUp ? await getPlanAmounts() : [];
  const priceFor = (code: string, fallback: number) =>
    amounts.find((plan) => plan.code === code)?.monthly ?? fallback;
  // Por código, no por posición: la puesta a punto es distinta en cada plan y
  // leer la del primero de la lista fue lo que puso "$0" en la página.
  const setupFor = (code: string, fallback: number) =>
    amounts.find((plan) => plan.code === code)?.setup ?? fallback;

  return (
    <section id="precios" className="scroll-mt-20 border-t border-stone-200 bg-stone-50 py-20 sm:py-24">
      <div className="mx-auto max-w-6xl px-4 sm:px-6">
        <SectionHeading
          eyebrow={PRICING.eyebrow}
          title={PRICING.title}
          subtitle={PRICING.subtitle}
        />

        <p className="mx-auto mt-6 max-w-2xl text-center text-sm leading-relaxed text-stone-500">
          {PRICING.context}
        </p>

        {/* El medidor se explica antes de mostrar los números: si alguien lee
            "hasta 30 pedidos" sin saber qué pasa cuando se pasa, el primer
            reflejo es desconfiar. */}
        <div className="mx-auto mt-8 max-w-2xl rounded-2xl border border-stone-200 bg-stone-50 p-5 sm:p-6">
          <h3 className="text-sm font-semibold text-stone-900">{PRICING.meter.title}</h3>
          <p className="mt-2 text-sm leading-relaxed text-stone-600">{PRICING.meter.body}</p>
        </div>

        {/* ---------- Mensualidades ---------- */}
        <div className="mt-12 grid gap-6 sm:grid-cols-2 xl:grid-cols-4">
          {PRICING.plans.map((plan) => (
            <div
              key={plan.name}
              className={cn(
                'flex flex-col rounded-2xl border bg-white p-6',
                plan.highlight
                  ? 'border-brand-600 shadow-lift ring-1 ring-brand-600'
                  : 'border-stone-200 shadow-card'
              )}
            >
              {/* El espacio del badge se reserva en las cuatro tarjetas: si
                  sólo lo ocupa la destacada, su título baja y los otros tres
                  quedan flotando más arriba. */}
              <span
                aria-hidden={!plan.highlight}
                className={cn(
                  'mb-3 inline-flex w-fit rounded-full px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wider',
                  // El hueco reservado sólo hace falta cuando las tarjetas van
                  // una al lado de la otra. Apiladas en el teléfono es aire de más.
                  plan.highlight ? 'bg-brand-50 text-brand-800' : 'invisible hidden sm:inline-flex'
                )}
              >
                {plan.highlight ? 'El más elegido' : 'placeholder'}
              </span>

              <h3 className="text-lg font-semibold text-stone-900">{plan.name}</h3>
              <p className="mt-1 text-xs font-medium text-brand-700">{plan.limit}</p>
              <p className="mt-2 min-h-[5.5rem] text-sm leading-relaxed text-stone-600">
                {plan.summary}
              </p>

              <p className="mt-5 flex flex-wrap items-baseline gap-x-1.5">
                {'priceFrom' in plan && plan.priceFrom && (
                  <span className="text-sm text-stone-500">desde</span>
                )}
                <span className="text-3xl font-semibold tracking-tight text-stone-900">
                  {money(priceFor(plan.code, plan.price))}
                </span>
                <span className="text-sm text-stone-500">{plan.unit}</span>
              </p>

              {/* El pago único, al lado de la mensualidad y no veinte líneas más
                  abajo. Es el número que decide si alguien sigue leyendo, y
                  enterarse de él recién en la contratación se siente como una
                  letra chica aunque esté escrito. */}
              {/* Alto fijo de dos renglones: "Sin puesta a punto" ocupa uno y
                  los otros tres ocupan dos, y sin esto las listas de abajo
                  arrancan a distinta altura en cada tarjeta. Sólo cuando van
                  una al lado de la otra: apiladas en el teléfono es aire de más,
                  igual que el hueco del badge. */}
              <p className="mt-1.5 text-sm text-stone-500 sm:min-h-[2.5rem]">
                {setupFor(plan.code, plan.setup) > 0
                  ? `+ ${money(setupFor(plan.code, plan.setup))} de puesta a punto, una sola vez`
                  : 'Sin puesta a punto'}
              </p>

              <ul className="mt-6 flex-1 space-y-2.5">
                {plan.features.map((feature) => (
                  <li key={feature} className="flex gap-2.5 text-sm leading-relaxed text-stone-600">
                    <Check className="mt-0.5 h-4 w-4 shrink-0 text-brand-600" />
                    {feature}
                  </li>
                ))}
              </ul>

              {canSignUp && (
                <Button
                  asChild
                  variant={plan.highlight ? 'default' : 'outline'}
                  className="mt-6 w-full"
                >
                  <Link href={`/contratar?plan=${plan.code}`}>Contratar {plan.name}</Link>
                </Button>
              )}
            </div>
          ))}
        </div>

        {/* ---------- Puesta a punto ----------
            Explica qué es, no cuánto sale: el monto ya está en cada tarjeta,
            que es donde se compara. Acá había una caja con un número único y
            terminó mostrando el del plan equivocado. */}
        <div className="mt-6 rounded-2xl border border-stone-200 bg-white p-6 shadow-card sm:p-8">
          <div className="flex flex-col gap-6 lg:flex-row lg:items-start lg:justify-between">
            <div>
              <div className="flex items-center gap-2">
                <Wrench className="h-5 w-5 shrink-0 text-stone-400" />
                <h3 className="text-lg font-semibold text-stone-900">{PRICING.setup.name}</h3>
              </div>
              <p className="mt-2 text-sm leading-relaxed text-stone-600">
                {PRICING.setup.summary}
              </p>
              <ul className="mt-4 grid gap-2 sm:grid-cols-2">
                {PRICING.setup.features.map((feature) => (
                  <li key={feature} className="flex gap-2.5 text-sm leading-relaxed text-stone-600">
                    <Check className="mt-0.5 h-4 w-4 shrink-0 text-brand-600" />
                    {feature}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>

        {/* ---------- Lo que no entra ----------
            Va acá, entre los precios y el cierre, y no escondido en las
            preguntas frecuentes. Un costo que el cliente descubre después se
            siente como letra chica aunque nadie se lo haya ocultado. */}
        <div className="mt-6 rounded-2xl border border-stone-200 bg-stone-50 p-6 sm:p-8">
          <div className="flex items-center gap-2">
            <Info className="h-5 w-5 shrink-0 text-stone-400" />
            <h3 className="text-lg font-semibold text-stone-900">{PRICING.notIncluded.title}</h3>
          </div>
          <dl className="mt-4 grid gap-4 sm:grid-cols-2">
            {PRICING.notIncluded.items.map((item) => (
              <div key={item.name}>
                <dt className="text-sm font-semibold text-stone-900">{item.name}</dt>
                <dd className="mt-1 text-sm leading-relaxed text-stone-600">{item.body}</dd>
              </div>
            ))}
          </dl>
        </div>

        <div className="mt-6 flex flex-wrap items-center justify-between gap-3 text-sm">
          <p className="text-stone-600">
            {PRICING.hourly.label}:{' '}
            <span className="font-semibold text-stone-900">{money(PRICING.hourly.price)}</span>
          </p>
          <p className="text-xs text-stone-500">{PRICING.asOf}</p>
        </div>

        {/* ---------- Cierre ---------- */}
        <div className="mt-10 rounded-2xl border border-brand-200 bg-brand-50 p-6 sm:p-8">
          <div className="flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex gap-4">
              <Unlock className="mt-0.5 h-6 w-6 shrink-0 text-brand-700" />
              <div>
                <h3 className="text-lg font-semibold text-stone-900">{PRICING.closing.title}</h3>
                <p className="mt-1.5 max-w-2xl text-sm leading-relaxed text-stone-700">
                  {PRICING.closing.body}
                </p>
              </div>
            </div>
            <div className="flex shrink-0 flex-wrap gap-2">
              <BookMeetingButton size="md" />
              <TrySystemButton size="md" />
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
