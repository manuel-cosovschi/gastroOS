'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { toast } from 'sonner';
import { ArrowRight, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { startSignup } from '@/actions/signups';
import { signupFormSchema, type SignupFormValues } from '@/lib/validations/signup';
import { cn } from '@/lib/utils';
import type { PlanAmount } from '@/lib/signups';

const INDUSTRIES = [
  'Pastelería',
  'Panadería',
  'Rotisería',
  'Catering',
  'Cafetería',
  'Viandas',
  'Otro',
];

const money = (value: number) =>
  new Intl.NumberFormat('es-AR', {
    style: 'currency',
    currency: 'ARS',
    maximumFractionDigits: 0,
  }).format(value);

/**
 * Paso uno de la contratación: qué plan y quién.
 *
 * El monto que se ve acá lo calculó el servidor a partir de `sovare.plans`; el
 * formulario manda sólo el código del plan. Que el total esté a la vista antes
 * de completar nada es a propósito: nadie debería descubrir cuánto tiene que
 * transferir después de dejar sus datos.
 */
export function SignupForm({ plans, initialPlan }: { plans: PlanAmount[]; initialPlan?: string }) {
  const router = useRouter();
  const [pending, setPending] = useState(false);

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    formState: { errors },
  } = useForm<SignupFormValues>({
    resolver: zodResolver(signupFormSchema),
    defaultValues: {
      plan: plans.some((plan) => plan.code === initialPlan)
        ? initialPlan
        : plans.find((plan) => plan.code === 'negocio')?.code || plans[0]?.code || '',
      business_name: '',
      contact_name: '',
      email: '',
      whatsapp: '',
      city: '',
      industry: '',
    },
  });

  const selectedCode = watch('plan');
  const selected = plans.find((plan) => plan.code === selectedCode) || null;
  const total = selected ? selected.setup + selected.monthly : 0;

  const onSubmit = async (values: SignupFormValues) => {
    setPending(true);
    const result = await startSignup(values);
    setPending(false);

    if (!result.success) {
      toast.error(result.error);
      return;
    }
    router.push(`/contratar/${result.data.token}`);
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-8">
      {/* ---------- Plan ---------- */}
      <fieldset>
        <legend className="text-sm font-semibold text-stone-900">1. Elegí el plan</legend>
        <div className="mt-3 grid gap-3 sm:grid-cols-3">
          {plans.map((plan) => {
            const active = plan.code === selectedCode;
            return (
              <button
                key={plan.code}
                type="button"
                onClick={() => setValue('plan', plan.code, { shouldValidate: true })}
                aria-pressed={active}
                className={cn(
                  'rounded-xl border p-4 text-left transition-colors',
                  active
                    ? 'border-brand-600 bg-brand-50 ring-1 ring-brand-600'
                    : 'border-stone-200 bg-white hover:border-stone-300'
                )}
              >
                <p className="text-sm font-semibold text-stone-900">{plan.label}</p>
                <p className="mt-1 text-lg font-semibold tracking-tight text-stone-900">
                  {money(plan.monthly)}
                </p>
                <p className="text-xs text-stone-500">por mes</p>
              </button>
            );
          })}
        </div>
        {errors.plan && <p className="mt-2 text-sm text-rose-600">{errors.plan.message}</p>}
      </fieldset>

      {/* ---------- Datos ---------- */}
      <fieldset className="space-y-4">
        <legend className="text-sm font-semibold text-stone-900">2. Contanos de tu negocio</legend>

        <Field label="Nombre del negocio" error={errors.business_name?.message}>
          <Input {...register('business_name')} placeholder="Como lo conocen tus clientes" />
        </Field>

        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Tu nombre" error={errors.contact_name?.message}>
            <Input {...register('contact_name')} placeholder="Nombre y apellido" />
          </Field>
          <Field label="WhatsApp" error={errors.whatsapp?.message}>
            <Input {...register('whatsapp')} placeholder="11 5555 0134" inputMode="tel" />
          </Field>
        </div>

        <Field label="Email" error={errors.email?.message} hint="Acá te mandamos la confirmación y los próximos pasos.">
          <Input {...register('email')} type="email" placeholder="vos@tunegocio.com" />
        </Field>

        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Ciudad" error={errors.city?.message} optional>
            <Input {...register('city')} placeholder="CABA" />
          </Field>
          <Field label="Rubro" error={errors.industry?.message} optional>
            <select
              {...register('industry')}
              className="h-10 w-full rounded-md border border-stone-300 bg-white px-3 text-sm text-stone-900 focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
            >
              <option value="">Elegir…</option>
              {INDUSTRIES.map((industry) => (
                <option key={industry} value={industry}>
                  {industry}
                </option>
              ))}
            </select>
          </Field>
        </div>
      </fieldset>

      {/* ---------- Total ---------- */}
      {selected && (
        <div className="rounded-xl border border-stone-200 bg-stone-50 p-5">
          <p className="text-sm font-semibold text-stone-900">Tu primer pago</p>
          <dl className="mt-3 space-y-1.5 text-sm">
            {/* El plan Taller no lleva puesta a punto. Mostrar "$0" al lado de
                un concepto que no existe hace dudar de si falta algo; mejor no
                mostrar la línea y decir en una frase por qué no está. */}
            {selected.setup > 0 && (
              <Row label="Puesta a punto (una sola vez)" value={money(selected.setup)} />
            )}
            <Row label={`Primer mes · plan ${selected.label}`} value={money(selected.monthly)} />
            <div className="mt-2 flex items-center justify-between border-t border-stone-200 pt-2">
              <dt className="font-semibold text-stone-900">Total a transferir</dt>
              <dd className="text-lg font-semibold tabular text-stone-900">{money(total)}</dd>
            </div>
          </dl>
          <p className="mt-3 text-xs leading-relaxed text-stone-500">
            {selected.setup > 0
              ? 'Después del primer pago se abona sólo la mensualidad, mes a mes y sin permanencia. En el paso siguiente te damos los datos para transferir.'
              : 'El plan Taller no lleva puesta a punto: el catálogo lo cargás vos con una guía que te damos. Se abona la mensualidad, mes a mes y sin permanencia. En el paso siguiente te damos los datos para transferir.'}
          </p>
        </div>
      )}

      <Button type="submit" size="lg" disabled={pending} className="w-full sm:w-auto">
        {pending ? (
          <>
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            Registrando…
          </>
        ) : (
          <>
            Continuar
            <ArrowRight className="ml-2 h-4 w-4" />
          </>
        )}
      </Button>
    </form>
  );
}

function Field({
  label,
  error,
  hint,
  optional,
  children,
}: {
  label: string;
  error?: string;
  hint?: string;
  optional?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <Label>
        {label}
        {optional && <span className="ml-1.5 font-normal text-stone-400">(opcional)</span>}
      </Label>
      {children}
      {hint && !error && <p className="text-xs text-stone-500">{hint}</p>}
      {error && <p className="text-sm text-rose-600">{error}</p>}
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between">
      <dt className="text-stone-600">{label}</dt>
      <dd className="tabular text-stone-900">{value}</dd>
    </div>
  );
}
