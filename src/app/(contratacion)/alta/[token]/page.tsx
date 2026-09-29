import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { CheckCircle2, MessageCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { getSignup } from '@/actions/signups';
import { whatsappUrl } from '@/lib/marketing';
import { OnboardingForm } from '@/components/contratar/onboarding-form';

export const metadata: Metadata = { title: 'Formulario de alta' };

export const dynamic = 'force-dynamic';

interface Props {
  params: Promise<{ token: string }>;
}

export default async function AltaPage({ params }: Props) {
  const { token } = await params;
  const signup = await getSignup(token);

  if (!signup) notFound();

  // El alta se completa después del pago. Si alguien llega con el link antes de
  // que esté confirmado, se lo devuelve a su contratación en vez de dejarlo
  // llenando treinta campos que no se van a poder guardar.
  if (signup.status !== 'aprobado') {
    return (
      <>
        <h1 className="text-2xl font-semibold tracking-tight text-stone-900">
          Todavía falta confirmar el pago
        </h1>
        <p className="mt-3 text-base leading-relaxed text-stone-600">
          El formulario de alta se habilita en cuanto el pago queda confirmado. Podés ver cómo va
          desde tu contratación.
        </p>
        <Button asChild size="lg" className="mt-6">
          <Link href={`/contratar/${signup.token}`}>Ver mi contratación</Link>
        </Button>
      </>
    );
  }

  const help = whatsappUrl(
    `Hola, soy ${signup.contact_name || signup.business_name} y quiero completar el alta de GastroOS hablando.`
  );

  if (signup.onboarding_done) {
    return (
      <>
        <div className="flex justify-center">
          <CheckCircle2 className="h-14 w-14 text-brand-600" />
        </div>
        <h1 className="mt-6 text-center text-2xl font-semibold tracking-tight text-stone-900">
          Ya tenemos tus datos
        </h1>
        <p className="mx-auto mt-3 max-w-md text-center text-base leading-relaxed text-stone-600">
          Estamos armando tu instalación con lo que nos contaste. Te avisamos en cuanto esté lista
          para que la veas, y coordinamos la capacitación.
        </p>
        <div className="mt-6 flex flex-col justify-center gap-3 sm:flex-row">
          {help && (
            <Button asChild variant="outline">
              <a href={help} target="_blank" rel="noreferrer">
                <MessageCircle className="mr-2 h-4 w-4" />
                Quiero agregar algo
              </a>
            </Button>
          )}
          <Button asChild variant="outline">
            <Link href={`/contratar/${signup.token}`}>Ver mi contratación</Link>
          </Button>
        </div>
      </>
    );
  }

  return (
    <>
      <header>
        <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-brand-700">
          Alta de {signup.business_name}
        </p>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight text-stone-900 sm:text-4xl">
          Contanos cómo trabajás
        </h1>
        <p className="mt-3 text-base leading-relaxed text-stone-600">
          Con esto armamos tu instalación: tu marca, tu catálogo, tus horarios. Casi todo es
          opcional — lo que no sepas ahora lo completamos después juntos.
        </p>
        {help && (
          <p className="mt-3 text-sm text-stone-500">
            Si preferís contárnoslo hablando,{' '}
            <a href={help} target="_blank" rel="noreferrer" className="text-brand-700 underline">
              mandanos un WhatsApp
            </a>{' '}
            y lo completamos juntos.
          </p>
        )}
      </header>

      <div className="mt-8">
        <OnboardingForm token={signup.token} businessName={signup.business_name} />
      </div>
    </>
  );
}
