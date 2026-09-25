'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { toast } from 'sonner';
import { Loader2 } from 'lucide-react';
import { submitStorefrontOrder } from '@/actions/catalog';
import { useCart } from '@/components/cart/cart-provider';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { storefrontOrderSchema, type StorefrontOrderValues } from '@/lib/validations/order';
import { getMinDeliveryDate } from '@/lib/advance-time';
import { cn, toISODate } from '@/lib/utils';
import { DELIVERY_METHODS, DELIVERY_METHOD_LABELS } from '@/types';

/**
 * Formulario de pedido de la tienda pública.
 *
 * El pedido entra al panel en estado "Pendiente" y con el canal marcado como
 * tienda, así el negocio distingue lo que cargó a mano de lo que le llegó solo.
 */
export function OrderForm() {
  const router = useRouter();
  const { items, clearCart } = useCart();
  const [submitting, setSubmitting] = useState(false);

  const minDate = toISODate(
    getMinDeliveryDate(
      undefined,
      items.map((item) => item.min_advance_hours)
    )
  );

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    formState: { errors },
  } = useForm<StorefrontOrderValues>({
    resolver: zodResolver(storefrontOrderSchema),
    defaultValues: {
      delivery_method: 'pickup',
      delivery_date: minDate,
      items: [],
    },
  });

  const deliveryMethod = watch('delivery_method');

  const onSubmit = async (values: StorefrontOrderValues) => {
    if (items.length === 0) {
      toast.error('Tu pedido está vacío.');
      return;
    }

    setSubmitting(true);
    const result = await submitStorefrontOrder({
      ...values,
      items: items.map((item) => ({
        product_id: item.type === 'product' ? item.id : undefined,
        package_id: item.type === 'package' ? item.id : undefined,
        quantity: item.quantity,
      })),
    });
    setSubmitting(false);

    if (!result.success || !result.order) {
      toast.error(result.error || 'No pudimos registrar tu pedido. Probá de nuevo.');
      return;
    }

    clearCart();
    router.push(`/pedido/confirmacion?numero=${result.order.order_number}`);
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Nombre y apellido *" id="contact_name" error={errors.contact_name?.message}>
          <Input id="contact_name" {...register('contact_name')} />
        </Field>

        <Field label="Teléfono *" id="phone" error={errors.phone?.message}>
          <Input id="phone" inputMode="tel" {...register('phone')} />
        </Field>
      </div>

      <Field label="Email *" id="email" error={errors.email?.message}>
        <Input id="email" type="email" {...register('email')} />
      </Field>

      <div>
        <Label>¿Cómo lo recibís? *</Label>
        <div className="mt-1.5 grid grid-cols-2 gap-2">
          {DELIVERY_METHODS.map((method) => (
            <button
              key={method}
              type="button"
              onClick={() => setValue('delivery_method', method)}
              className={cn(
                'rounded-lg border px-3 py-2 text-sm font-medium transition-colors',
                deliveryMethod === method
                  ? 'border-brand-600 bg-brand-50 text-brand-800'
                  : 'border-stone-200 text-stone-600 hover:border-stone-300'
              )}
            >
              {DELIVERY_METHOD_LABELS[method]}
            </button>
          ))}
        </div>
      </div>

      {deliveryMethod === 'delivery' && (
        <div className="grid gap-4 animate-fade-in sm:grid-cols-2">
          <Field label="Dirección *" id="address" error={errors.address?.message}>
            <Input id="address" {...register('address')} placeholder="Calle, número, piso" />
          </Field>
          <Field label="Localidad" id="city">
            <Input id="city" {...register('city')} />
          </Field>
        </div>
      )}

      <Field
        label="Fecha de entrega *"
        id="delivery_date"
        error={errors.delivery_date?.message}
        hint={`La fecha más cercana disponible es el ${minDate.split('-').reverse().join('/')}.`}
      >
        <Input id="delivery_date" type="date" min={minDate} {...register('delivery_date')} />
      </Field>

      <Field label="Comentarios" id="observations" hint="Alergias, mensajes, referencias de entrega.">
        <Textarea id="observations" rows={3} {...register('observations')} />
      </Field>

      <Button type="submit" className="w-full" size="lg" disabled={submitting || items.length === 0}>
        {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
        Enviar pedido
      </Button>

      {items.length === 0 && (
        <p className="text-center text-sm text-stone-500">
          Agregá productos desde el catálogo para poder enviar el pedido.
        </p>
      )}
    </form>
  );
}

function Field({
  label,
  id,
  error,
  hint,
  children,
}: {
  label: string;
  id: string;
  error?: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <Label htmlFor={id}>{label}</Label>
      <div className="mt-1.5">{children}</div>
      {error && <p className="mt-1 text-sm text-rose-600">{error}</p>}
      {!error && hint && <p className="mt-1 text-xs text-stone-500">{hint}</p>}
    </div>
  );
}
