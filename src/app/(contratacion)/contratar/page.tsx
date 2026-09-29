import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { ShieldCheck } from 'lucide-react';
import { getPlanAmounts } from '@/lib/signups';
import { SignupForm } from '@/components/contratar/signup-form';

export const metadata: Metadata = { title: 'Contratar' };

interface Props {
  searchParams: Promise<{ plan?: string }>;
}

export default async function ContratarPage({ searchParams }: Props) {
  const [{ plan }, plans] = await Promise.all([searchParams, getPlanAmounts()]);

  // Sin planes cargados no hay nada que contratar, y mostrar un formulario que
  // no puede terminar en nada es peor que no mostrarlo.
  if (plans.length === 0) notFound();

  return (
    <>
      <header>
        <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-brand-700">
          Contratación
        </p>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight text-stone-900 sm:text-4xl">
          Empecemos con tu sistema
        </h1>
        <p className="mt-3 text-base leading-relaxed text-stone-600">
          Dejanos los datos, transferí y subí el comprobante. Lo verificamos en el momento y te
          mandamos por mail todo lo que sigue.
        </p>
      </header>

      <div className="mt-8 rounded-2xl border border-stone-200 bg-white p-6 shadow-card sm:p-8">
        <SignupForm plans={plans} initialPlan={plan} />
      </div>

      <div className="mt-6 flex gap-3 rounded-xl border border-stone-200 bg-white p-4">
        <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-brand-600" />
        <p className="text-sm leading-relaxed text-stone-600">
          Sin contrato de permanencia y sin porcentaje sobre tus ventas. Si en algún momento
          decidís que no va más, avisás y te llevás tu información exportada.
        </p>
      </div>
    </>
  );
}
