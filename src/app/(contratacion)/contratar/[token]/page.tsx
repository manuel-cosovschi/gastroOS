import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { CheckCircle2, Clock, Landmark, MessageCircle, XCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { getSignup } from '@/actions/signups';
import { getTransferDetails } from '@/lib/signups';
import { whatsappUrl } from '@/lib/marketing';
import { CopyField } from '@/components/contratar/copy-field';
import { ReceiptUpload } from '@/components/contratar/receipt-upload';
import type { SignupPublicView } from '@/types/signup';

export const metadata: Metadata = { title: 'Tu contratación' };

// El estado cambia con la subida del comprobante; no hay nada que cachear.
export const dynamic = 'force-dynamic';

interface Props {
  params: Promise<{ token: string }>;
}

const money = (value: number) =>
  new Intl.NumberFormat('es-AR', {
    style: 'currency',
    currency: 'ARS',
    maximumFractionDigits: 0,
  }).format(value);

export default async function ContratacionPage({ params }: Props) {
  const { token } = await params;
  const signup = await getSignup(token);
  const transfer = getTransferDetails();

  if (!signup || !transfer) notFound();

  const help = whatsappUrl(
    `Hola, soy ${signup.contact_name || signup.business_name} y estoy contratando GastroOS (${signup.plan_label}).`
  );

  return (
    <>
      <header>
        <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-brand-700">
          Contratación de {signup.business_name}
        </p>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight text-stone-900 sm:text-4xl">
          {TITLES[signup.status]}
        </h1>
      </header>

      <div className="mt-8 space-y-6">
        {signup.status === 'esperando_comprobante' && (
          <Waiting signup={signup} transfer={transfer} />
        )}
        {signup.status === 'en_revision' && <UnderReview signup={signup} help={help} />}
        {signup.status === 'aprobado' && <Approved signup={signup} />}
        {signup.status === 'rechazado' && <Rejected help={help} />}

        <p className="text-center text-xs leading-relaxed text-stone-500">
          Guardá este link: es el único lugar donde podés ver cómo va tu contratación.
          {help && (
            <>
              {' '}
              Cualquier duda,{' '}
              <a href={help} target="_blank" rel="noreferrer" className="text-brand-700 underline">
                escribinos por WhatsApp
              </a>
              .
            </>
          )}
        </p>
      </div>
    </>
  );
}

const TITLES: Record<SignupPublicView['status'], string> = {
  esperando_comprobante: 'Transferí y subí el comprobante',
  en_revision: 'Estamos revisando tu comprobante',
  aprobado: '¡Pago confirmado!',
  rechazado: 'No pudimos confirmar el pago',
};

function Waiting({
  signup,
  transfer,
}: {
  signup: SignupPublicView;
  transfer: NonNullable<ReturnType<typeof getTransferDetails>>;
}) {
  return (
    <>
      <section className="rounded-2xl border border-stone-200 bg-white p-6 shadow-card sm:p-8">
        <div className="flex items-center gap-2">
          <Landmark className="h-5 w-5 shrink-0 text-stone-400" />
          <h2 className="text-lg font-semibold text-stone-900">Datos para transferir</h2>
        </div>

        <div className="mt-4 rounded-xl bg-brand-50 px-5 py-4 text-center">
          <p className="text-xs uppercase tracking-wider text-brand-800">Importe exacto</p>
          <p className="mt-1 text-3xl font-semibold tracking-tight text-stone-900">
            {money(signup.amount)}
          </p>
          <p className="mt-1 text-xs text-stone-600">
            Puesta a punto + primer mes del plan {signup.plan_label}
          </p>
        </div>

        <div className="mt-5">
          <CopyField label="Alias" value={transfer.alias} mono />
          {/*
            "CBU / CVU" y no "CBU" a secas: una billetera virtual da un CVU, y
            quien lo copia para pegarlo en su banco necesita reconocer el
            número que tiene enfrente. Sirve para los dos casos.
          */}
          <CopyField label="CBU / CVU" value={transfer.cbu} mono />
          <CopyField label="Titular" value={transfer.holder} />
          {transfer.bank && <CopyField label="Banco" value={transfer.bank} />}
          {transfer.cuit && <CopyField label="CUIT" value={transfer.cuit} mono />}
        </div>

        <p className="mt-4 text-xs leading-relaxed text-stone-500">
          Transferí el importe exacto: así lo podemos verificar solo. Si transferís otro monto no se
          pierde nada, pero lo tenemos que revisar a mano.
        </p>
      </section>

      <section className="rounded-2xl border border-stone-200 bg-white p-6 shadow-card sm:p-8">
        <h2 className="text-lg font-semibold text-stone-900">Subí el comprobante</h2>
        <p className="mt-1.5 text-sm leading-relaxed text-stone-600">
          Con la captura que te da el banco o la billetera alcanza.
        </p>
        <div className="mt-5">
          <ReceiptUpload token={signup.token} />
        </div>
      </section>
    </>
  );
}

function UnderReview({ signup, help }: { signup: SignupPublicView; help: string }) {
  return (
    <>
      <section className="rounded-2xl border border-amber-200 bg-amber-50 p-6 sm:p-8">
        <div className="flex gap-4">
          <Clock className="mt-0.5 h-6 w-6 shrink-0 text-amber-600" />
          <div>
            <h2 className="text-lg font-semibold text-stone-900">Recibimos tu comprobante</h2>
            <p className="mt-1.5 text-sm leading-relaxed text-stone-700">
              No pudimos confirmarlo automáticamente, así que lo está mirando una persona. Te
              escribimos en cuanto esté — normalmente el mismo día.
            </p>
            {help && (
              <Button asChild variant="outline" className="mt-4 bg-white">
                <a href={help} target="_blank" rel="noreferrer">
                  <MessageCircle className="mr-2 h-4 w-4" />
                  Apurarlo por WhatsApp
                </a>
              </Button>
            )}
          </div>
        </div>
      </section>

      <section className="rounded-2xl border border-stone-200 bg-white p-6 shadow-card sm:p-8">
        <h2 className="text-base font-semibold text-stone-900">¿Subiste el archivo equivocado?</h2>
        <p className="mt-1.5 text-sm leading-relaxed text-stone-600">
          Podés subir otro y reemplaza al anterior.
        </p>
        <div className="mt-5">
          <ReceiptUpload token={signup.token} replacing />
        </div>
      </section>
    </>
  );
}

function Approved({ signup }: { signup: SignupPublicView }) {
  return (
    <section className="rounded-2xl border border-brand-200 bg-white p-6 shadow-card sm:p-8">
      <div className="flex gap-4">
        <CheckCircle2 className="mt-0.5 h-6 w-6 shrink-0 text-brand-600" />
        <div className="min-w-0">
          <h2 className="text-lg font-semibold text-stone-900">
            Tu plan {signup.plan_label} está activo
          </h2>
          <p className="mt-1.5 text-sm leading-relaxed text-stone-600">
            Te mandamos un mail a <strong>{signup.email}</strong> con todo lo que sigue. Si no
            llegó, revisá el correo no deseado.
          </p>

          {signup.onboarding_done ? (
            <div className="mt-5 rounded-xl border border-stone-200 bg-stone-50 p-4">
              <p className="text-sm font-medium text-stone-900">Ya tenemos tus datos</p>
              <p className="mt-1 text-sm leading-relaxed text-stone-600">
                Estamos armando tu instalación. Te avisamos en cuanto esté lista para que la veas.
              </p>
            </div>
          ) : (
            <>
              <p className="mt-4 text-sm leading-relaxed text-stone-600">
                El próximo paso es el formulario de alta: son los datos con los que armamos tu
                sistema. Tarda unos diez minutos.
              </p>
              <Button asChild size="lg" className="mt-4">
                <Link href={`/alta/${signup.token}`}>Completar el formulario de alta</Link>
              </Button>
            </>
          )}
        </div>
      </div>
    </section>
  );
}

function Rejected({ help }: { help: string }) {
  return (
    <section className="rounded-2xl border border-rose-200 bg-rose-50 p-6 sm:p-8">
      <div className="flex gap-4">
        <XCircle className="mt-0.5 h-6 w-6 shrink-0 text-rose-600" />
        <div>
          <h2 className="text-lg font-semibold text-stone-900">Revisemos esto juntos</h2>
          <p className="mt-1.5 text-sm leading-relaxed text-stone-700">
            No pudimos confirmar el pago de esta contratación. Puede ser un comprobante que no
            corresponde, un monto distinto o una transferencia que no llegó. Escribinos y lo
            resolvemos — si el pago salió de tu cuenta, no se pierde.
          </p>
          {help && (
            <Button asChild className="mt-4">
              <a href={help} target="_blank" rel="noreferrer">
                <MessageCircle className="mr-2 h-4 w-4" />
                Escribinos por WhatsApp
              </a>
            </Button>
          )}
        </div>
      </div>
    </section>
  );
}
