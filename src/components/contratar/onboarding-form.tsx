'use client';

import { useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { toast } from 'sonner';
import { ImageUp, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { submitOnboarding } from '@/actions/signups';
import { onboardingSchema, type OnboardingFormValues } from '@/lib/validations/signup';

const LOGO_ACCEPT = 'image/png,image/jpeg,image/webp,image/svg+xml';

const INDUSTRIES = [
  'Pastelería',
  'Panadería',
  'Rotisería',
  'Catering',
  'Cafetería',
  'Viandas',
  'Otro',
];

/**
 * Formulario de alta: lo que hace falta saber para montar la instalación.
 *
 * Casi todo es opcional a propósito. Se completa una vez, muchas veces desde el
 * teléfono y con la cocina andando: es mejor recibir la mitad y preguntar el
 * resto por WhatsApp que perder el alta entera porque alguien no se acordaba el
 * horario del sábado.
 */
export function OnboardingForm({
  token,
  businessName,
}: {
  token: string;
  businessName: string;
}) {
  const router = useRouter();
  const logoRef = useRef<HTMLInputElement>(null);
  const [logoName, setLogoName] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<OnboardingFormValues>({
    resolver: zodResolver(onboardingSchema),
    defaultValues: { legal_name: businessName, display_name: businessName },
  });

  const onSubmit = async (values: OnboardingFormValues) => {
    const form = new FormData();
    const logo = logoRef.current?.files?.[0];
    if (logo) form.append('logo', logo);

    setPending(true);
    const result = await submitOnboarding(token, values, form);
    setPending(false);

    if (!result.success) {
      toast.error(result.error);
      return;
    }
    toast.success('¡Listo! Ya tenemos todo para empezar.');
    router.push(`/contratar/${token}`);
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-8">
      <Section title="Tu negocio" hint="Cómo va a aparecer en el sistema y en tu tienda.">
        <Field label="Nombre del negocio" error={errors.legal_name?.message}>
          <Input {...register('legal_name')} />
        </Field>
        <Field
          label="Cómo querés que se lea en la tienda"
          optional
          hint="Si es distinto al de arriba. Por ejemplo, con un subtítulo o sin la razón social."
        >
          <Input {...register('display_name')} />
        </Field>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Rubro" optional>
            <Select {...register('industry')}>
              <option value="">Elegir…</option>
              {INDUSTRIES.map((industry) => (
                <option key={industry} value={industry}>
                  {industry}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Ciudad" optional>
            <Input {...register('city')} placeholder="CABA" />
          </Field>
        </div>
        <Field label="Dirección" optional hint="Si tenés local a la calle y querés que figure.">
          <Input {...register('address')} placeholder="Av. Siempre Viva 1234" />
        </Field>
      </Section>

      <Section
        title="Tu marca"
        hint="Esto es lo que hace que el sistema se vea tuyo y no alquilado. Si no tenés nada definido, lo elegimos nosotros y después lo ajustamos con vos."
      >
        <Field label="Logo" optional>
          <label
            htmlFor="logo"
            className="flex cursor-pointer items-center gap-3 rounded-lg border-2 border-dashed border-stone-300 bg-stone-50 px-4 py-4 transition-colors hover:border-brand-400 hover:bg-brand-50/40"
          >
            <ImageUp className="h-5 w-5 shrink-0 text-stone-400" />
            <span className="min-w-0 flex-1 truncate text-sm text-stone-700">
              {logoName || 'Subir el logo (PNG, JPG, WEBP o SVG)'}
            </span>
            <input
              ref={logoRef}
              id="logo"
              type="file"
              accept={LOGO_ACCEPT}
              className="sr-only"
              onChange={(event) => setLogoName(event.target.files?.[0]?.name || null)}
            />
          </label>
        </Field>
        <Field
          label="Colores"
          optional
          hint="Los códigos si los tenés a mano, o describilos: “verde oscuro y crema”, “igual que el packaging”."
        >
          <Input {...register('palette')} placeholder="#1F3D2B, #F5EFE6" />
        </Field>
        <Field
          label="Tipografía"
          optional
          hint="Si usás una en particular. Si no, elegimos una que acompañe al logo."
        >
          <Input {...register('typography')} placeholder="La del logo, o alguna parecida" />
        </Field>
        <Field label="Algo más sobre la estética" optional>
          <Textarea
            {...register('brand_notes')}
            rows={3}
            placeholder="Cuentas de Instagram o marcas que te gustan como referencia, cosas que no querés."
          />
        </Field>
      </Section>

      <Section title="Contacto público" hint="Lo que van a ver tus clientes en la tienda.">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Teléfono o WhatsApp" optional>
            <Input {...register('public_phone')} placeholder="11 5555 0134" inputMode="tel" />
          </Field>
          <Field label="Email de contacto" optional error={errors.public_email?.message}>
            <Input {...register('public_email')} type="email" placeholder="hola@tunegocio.com" />
          </Field>
        </div>
        <Field label="Instagram" optional>
          <Input {...register('instagram')} placeholder="@tunegocio" />
        </Field>
      </Section>

      <Section title="Cómo entregás" hint="Con esto configuramos las opciones del checkout.">
        <Field label="¿Hacés envíos?" optional>
          <Select {...register('delivery')}>
            <option value="">Elegir…</option>
            <option value="si">Sí, hago envíos</option>
            <option value="no">No, sólo retiran</option>
            <option value="ambos">Las dos cosas</option>
          </Select>
        </Field>
        <Field
          label="Zonas de envío y costo"
          optional
          hint="Aunque sea aproximado: “CABA $3.000, zona norte $5.000”."
        >
          <Textarea {...register('delivery_zones')} rows={2} />
        </Field>
        <Field label="Días y horarios de retiro" optional>
          <Textarea
            {...register('pickup_hours')}
            rows={2}
            placeholder="Martes a sábado de 10 a 19, domingos de 10 a 14"
          />
        </Field>
        <Field
          label="Cuánta anticipación necesitás para un pedido"
          optional
          hint="Para que la tienda no acepte pedidos que no llegás a hacer."
        >
          <Input {...register('advance_notice')} placeholder="48 horas, o 24 para lo simple" />
        </Field>
      </Section>

      <Section title="Tu catálogo" hint="Para dimensionar la carga inicial.">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="¿Cuántos productos vendés, más o menos?" optional>
            <Select {...register('catalog_size')}>
              <option value="">Elegir…</option>
              <option value="1-15">Hasta 15</option>
              <option value="16-40">Entre 16 y 40</option>
              <option value="41-100">Entre 41 y 100</option>
              <option value="100+">Más de 100</option>
            </Select>
          </Field>
          <Field label="¿Querés medir el costo de cada receta?" optional>
            <Select {...register('uses_recipes')}>
              <option value="">Elegir…</option>
              <option value="si">Sí, me interesa</option>
              <option value="despues">Más adelante</option>
              <option value="no">No hace falta</option>
            </Select>
          </Field>
        </div>
      </Section>

      <Section title="Lo último">
        <Field
          label="¿Tenés dominio propio?"
          optional
          hint="El dominio no está incluido: se compra a tu nombre y se paga aparte, una vez por año. Si ya tenés uno lo configuramos; si no, arrancás con un subdominio nuestro y lo cambiás cuando quieras."
        >
          <Input {...register('domain')} placeholder="tunegocio.com.ar" />
        </Field>
        <Field
          label="Quiénes van a usar el sistema"
          optional
          hint="Nombre y email de cada uno, para crearles su acceso."
        >
          <Textarea {...register('team')} rows={2} />
        </Field>
        <Field label="Cualquier cosa que quieras contarnos" optional>
          <Textarea
            {...register('extra')}
            rows={4}
            placeholder="Cómo trabajás hoy, qué te gustaría que el sistema resuelva primero, algo que no funcionó en otro sistema que probaste."
          />
        </Field>
      </Section>

      <Button type="submit" size="lg" disabled={pending} className="w-full">
        {pending ? (
          <>
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            Enviando…
          </>
        ) : (
          'Enviar y arrancar'
        )}
      </Button>
    </form>
  );
}

function Section({
  title,
  hint,
  children,
}: {
  title: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <fieldset className="rounded-2xl border border-stone-200 bg-white p-5 shadow-card sm:p-6">
      <legend className="px-1 text-sm font-semibold text-stone-900">{title}</legend>
      {hint && <p className="mb-4 mt-1 text-sm leading-relaxed text-stone-500">{hint}</p>}
      <div className="space-y-4">{children}</div>
    </fieldset>
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
      {hint && !error && <p className="text-xs leading-relaxed text-stone-500">{hint}</p>}
      {error && <p className="text-sm text-rose-600">{error}</p>}
    </div>
  );
}

const Select = (props: React.SelectHTMLAttributes<HTMLSelectElement>) => (
  <select
    {...props}
    className="h-10 w-full min-w-0 rounded-md border border-stone-300 bg-white px-3 text-sm text-stone-900 focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
  />
);
