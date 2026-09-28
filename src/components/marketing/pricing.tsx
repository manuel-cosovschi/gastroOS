import { Check, ShieldCheck, Wrench } from 'lucide-react';
import { cn } from '@/lib/utils';
import { PRICING } from '@/lib/marketing';
import { SectionHeading } from '@/components/marketing/section';
import { BookMeetingButton, TrySystemButton } from '@/components/marketing/cta-buttons';

/**
 * Planes y garantía.
 *
 * La puesta a punto va separada de las mensualidades y no como una cuarta
 * columna: es un pago único y mezclarla con los planes hace que el visitante
 * compare tres números que no son comparables.
 *
 * No se renderiza si `PRICING.enabled` es false: una página de venta con
 * precios que el dueño del negocio no eligió es peor que una sin precios.
 */

const money = (value: number) =>
  new Intl.NumberFormat('es-AR', {
    style: 'currency',
    currency: 'ARS',
    maximumFractionDigits: 0,
  }).format(value);

export function Pricing() {
  if (!PRICING.enabled) return null;

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

        {/* ---------- Mensualidades ---------- */}
        <div className="mt-12 grid gap-6 lg:grid-cols-3">
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
              {plan.highlight && (
                <span className="mb-3 inline-flex w-fit rounded-full bg-brand-50 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wider text-brand-800">
                  El más elegido
                </span>
              )}

              <h3 className="text-lg font-semibold text-stone-900">{plan.name}</h3>
              <p className="mt-1.5 min-h-[3.5rem] text-sm leading-relaxed text-stone-600">
                {plan.summary}
              </p>

              <p className="mt-5 flex flex-wrap items-baseline gap-x-1.5">
                {'priceFrom' in plan && plan.priceFrom && (
                  <span className="text-sm text-stone-500">desde</span>
                )}
                <span className="text-3xl font-semibold tracking-tight text-stone-900">
                  {money(plan.price)}
                </span>
                <span className="text-sm text-stone-500">{plan.unit}</span>
              </p>

              <ul className="mt-6 flex-1 space-y-2.5">
                {plan.features.map((feature) => (
                  <li key={feature} className="flex gap-2.5 text-sm leading-relaxed text-stone-600">
                    <Check className="mt-0.5 h-4 w-4 shrink-0 text-brand-600" />
                    {feature}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        {/* ---------- Puesta a punto ---------- */}
        <div className="mt-6 rounded-2xl border border-stone-200 bg-white p-6 shadow-card sm:p-8">
          <div className="flex flex-col gap-6 lg:flex-row lg:items-start lg:justify-between">
            <div className="max-w-xl">
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

            <div className="shrink-0 rounded-xl bg-stone-50 px-6 py-5 text-center lg:text-right">
              <p className="text-3xl font-semibold tracking-tight text-stone-900">
                {money(PRICING.setup.price)}
              </p>
              <p className="mt-1 text-sm text-stone-500">{PRICING.setup.unit}</p>
            </div>
          </div>
        </div>

        <div className="mt-6 flex flex-wrap items-center justify-between gap-3 text-sm">
          <p className="text-stone-600">
            {PRICING.hourly.label}:{' '}
            <span className="font-semibold text-stone-900">{money(PRICING.hourly.price)}</span>
          </p>
          <p className="text-xs text-stone-500">{PRICING.asOf}</p>
        </div>

        {/* ---------- Garantía ---------- */}
        <div className="mt-10 rounded-2xl border border-brand-200 bg-brand-50 p-6 sm:p-8">
          <div className="flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex gap-4">
              <ShieldCheck className="mt-0.5 h-6 w-6 shrink-0 text-brand-700" />
              <div>
                <h3 className="text-lg font-semibold text-stone-900">{PRICING.guarantee.title}</h3>
                <p className="mt-1.5 max-w-2xl text-sm leading-relaxed text-stone-700">
                  {PRICING.guarantee.body}
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
