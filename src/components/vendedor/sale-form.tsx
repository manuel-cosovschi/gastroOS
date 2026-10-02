'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { toast } from 'sonner';
import { CheckCircle2, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { submitVendorSale } from '@/actions/vendors';
import { vendorSaleSchema, type VendorSaleValues } from '@/lib/validations/vendor';
import type { VendorPlanOption } from '@/types/vendor';

const money = (value: number) =>
  new Intl.NumberFormat('es-AR', {
    style: 'currency',
    currency: 'ARS',
    maximumFractionDigits: 0,
  }).format(value);

const INDUSTRIES = ['Pastelería', 'Panadería', 'Rotisería', 'Catering', 'Cafetería', 'Viandas', 'Otro'];

/**
 * Cargar un cliente que el vendedor cerró.
 *
 * Después de enviar no aparece solo en su saldo: queda "en revisión" hasta que lo
 * apruebe el dueño. Eso se dice en el momento, con las mismas palabras que usa el
 * resto de la página, para que nadie espere ver la plata antes de tiempo.
 */
export function VendorSaleForm({
  token,
  plans,
  commissionPct,
}: {
  token: string;
  plans: VendorPlanOption[];
  commissionPct: number;
}) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [sent, setSent] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<VendorSaleValues>({
    resolver: zodResolver(vendorSaleSchema),
    defaultValues: {
      business_name: '',
      contact_name: '',
      whatsapp: '',
      email: '',
      city: '',
      industry: '',
      plan: '',
      notes: '',
    },
  });

  const onSubmit = async (values: VendorSaleValues) => {
    setPending(true);
    const result = await submitVendorSale(token, values);
    setPending(false);

    if (!result.success) {
      toast.error(result.error);
      return;
    }

    setSent(result.data.business);
    reset();
    router.refresh();
  };

  if (sent) {
    return (
      <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-5">
        <div className="flex gap-3">
          <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-emerald-600" />
          <div className="min-w-0">
            <p className="text-sm font-semibold text-stone-900">Recibimos a {sent}</p>
            <p className="mt-1 text-sm leading-relaxed text-stone-700">
              Queda en revisión. Cuando lo aprobemos, el {commissionPct}% de la cuota del primer
              mes se suma a tu saldo, y lo ves acá abajo.
            </p>
            <Button type="button" variant="outline" size="sm" className="mt-3" onClick={() => setSent(null)}>
              Cargar otro cliente
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-5" noValidate>
      <Field label="Nombre del negocio" error={errors.business_name?.message}>
        <Input {...register('business_name')} placeholder="Como lo conocen sus clientes" />
      </Field>

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Con quién hablaste" error={errors.contact_name?.message} optional>
          <Input {...register('contact_name')} placeholder="Nombre y apellido" />
        </Field>
        <Field label="WhatsApp del cliente" error={errors.whatsapp?.message}>
          <Input {...register('whatsapp')} placeholder="223 538-3082" inputMode="tel" />
        </Field>
      </div>

      <Field
        label="Mail del cliente"
        error={errors.email?.message}
        hint="Alcanza con el WhatsApp o el mail. Con los dos es mejor."
        optional
      >
        <Input {...register('email')} type="email" placeholder="cliente@negocio.com" />
      </Field>

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Ciudad" error={errors.city?.message} optional>
          <Input {...register('city')} placeholder="Mar del Plata" />
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

      <Field
        label="Plan que contrató"
        error={errors.plan?.message}
        hint="Si no estás seguro, elegí el que más se parezca: lo confirmo yo al revisar."
      >
        <select
          {...register('plan')}
          className="h-10 w-full rounded-md border border-stone-300 bg-white px-3 text-sm text-stone-900 focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
        >
          <option value="">Elegir…</option>
          {plans.map((plan) => (
            <option key={plan.code} value={plan.code}>
              {plan.label} · {money(plan.monthly)} por mes · comisión {money(plan.commission)}
            </option>
          ))}
        </select>
      </Field>

      <Field
        label="Algo que tenga que saber"
        error={errors.notes?.message}
        hint="Cuándo lo cerraste, si ya pagó, si pidió algo especial."
        optional
      >
        <textarea
          {...register('notes')}
          rows={3}
          className="w-full rounded-md border border-stone-300 bg-white px-3 py-2 text-sm text-stone-900 placeholder:text-stone-400 focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
        />
      </Field>

      <Button type="submit" size="lg" disabled={pending} className="w-full sm:w-auto">
        {pending ? (
          <>
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            Enviando…
          </>
        ) : (
          'Cargar el cliente'
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
