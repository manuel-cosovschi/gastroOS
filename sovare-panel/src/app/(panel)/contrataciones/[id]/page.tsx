import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ArrowLeft, Bot, ClipboardList, MailWarning, MessageCircle } from 'lucide-react';
import { createServerClient } from '@/lib/supabase/server';
import { Badge, SectionCard } from '@/components/ui';
import {
  ConvertToClient,
  LogoPreview,
  ReceiptLink,
  SignupDecision,
} from '@/components/signup-actions';
import { SignupStore } from '@/components/signup-store';
import { LANDING_URL } from '@/lib/vendedores';
import {
  AI_VERDICT_META,
  SIGNUP_STATUS_META,
  type Signup,
} from '@/types';
import { longDate, money } from '@/lib/utils';

export const metadata = { title: 'Contratación' };
export const dynamic = 'force-dynamic';

const ONBOARDING_SECTIONS: { title: string; fields: [string, string][] }[] = [
  {
    title: 'El negocio',
    fields: [
      ['legal_name', 'Nombre'],
      ['display_name', 'Cómo se lee en la tienda'],
      ['industry', 'Rubro'],
      ['city', 'Ciudad'],
      ['address', 'Dirección'],
    ],
  },
  {
    title: 'La marca',
    fields: [
      ['palette', 'Colores'],
      ['typography', 'Tipografía'],
      ['brand_notes', 'Notas'],
    ],
  },
  {
    title: 'Contacto público',
    fields: [
      ['public_phone', 'Teléfono'],
      ['public_email', 'Email'],
      ['instagram', 'Instagram'],
    ],
  },
  {
    title: 'Cómo entrega',
    fields: [
      ['delivery', 'Envíos'],
      ['delivery_zones', 'Zonas y costo'],
      ['pickup_hours', 'Horarios de retiro'],
      ['advance_notice', 'Anticipación'],
    ],
  },
  {
    title: 'Catálogo y técnico',
    fields: [
      ['catalog_size', 'Cantidad de productos'],
      ['uses_recipes', 'Recetas'],
      ['domain', 'Dominio'],
      ['team', 'Equipo'],
      ['extra', 'Comentarios'],
    ],
  },
];

export default async function SignupDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createServerClient();

  const { data } = await supabase.from('signups').select('*').eq('id', id).maybeSingle();
  if (!data) notFound();

  const signup = data as Signup;
  const status = SIGNUP_STATUS_META[signup.status];
  const wa = signup.whatsapp?.replace(/\D/g, '');

  // Qué plan es decide qué pasa al aprobar: sin puesta a punto (el Taller) la
  // cuenta se crea sola; con puesta a punto, la armamos nosotros.
  const { data: plan } = await supabase
    .from('plans')
    .select('setup')
    .eq('code', signup.plan)
    .maybeSingle();
  const setup = Number(plan?.setup ?? 0);
  const selfService = setup <= 0;
  const storeAddress = signup.store_slug
    ? `${signup.store_slug}.${new URL(LANDING_URL).host}`
    : null;

  return (
    <div className="space-y-6">
      <Link
        href="/contrataciones"
        className="inline-flex items-center gap-1.5 text-sm text-stone-500 transition-colors hover:text-stone-900"
      >
        <ArrowLeft className="h-4 w-4" />
        Contrataciones
      </Link>

      <header className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <h1 className="text-2xl font-semibold tracking-tight text-stone-900">
            {signup.business_name}
          </h1>
          <p className="mt-1 text-sm text-stone-500">
            {longDate(signup.created_at)} · plan {signup.plan}
          </p>
        </div>
        <Badge className={status.badge}>{status.label}</Badge>
      </header>

      {signup.status === 'aprobado' && !signup.notified_at && (
        <div className="flex gap-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3">
          <MailWarning className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" />
          <div className="min-w-0 text-sm text-stone-800">
            <p className="font-medium">El mail de confirmación no salió.</p>
            <p className="mt-0.5 leading-relaxed text-stone-600">
              El pago está aprobado igual. Podés reenviarlo desde &quot;Tienda y acceso&quot;, más
              abajo, o escribirle a <strong>{signup.email}</strong> por WhatsApp.
            </p>
            {signup.decision_notes && (
              <p className="mt-1 text-xs text-stone-500">{signup.decision_notes}</p>
            )}
          </div>
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          {/* ---------- Comprobante y decisión ---------- */}
          <SectionCard title="El pago">
            <div className="space-y-5 px-5 py-4">
              <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
                <p className="text-2xl font-semibold tabular tracking-tight text-stone-900">
                  {money(Number(signup.amount), signup.currency)}
                </p>
                <p className="text-sm text-stone-500">
                  {signup.includes_setup
                    ? setup > 0
                      ? 'puesta a punto + primer mes'
                      : 'primer mes'
                    : 'mensualidad'}
                </p>
              </div>

              {signup.receipt_path ? (
                <>
                  <ReceiptLink path={signup.receipt_path} />
                  <p className="text-xs text-stone-500">
                    Subido el {longDate(signup.receipt_uploaded_at)}. El link dura diez minutos.
                  </p>
                </>
              ) : (
                <p className="text-sm text-stone-500">Todavía no subió ningún comprobante.</p>
              )}

              <div className="border-t border-stone-100 pt-4">
                <SignupDecision id={signup.id} status={signup.status} />
              </div>

              {signup.decided_at && signup.status !== 'aprobado' && signup.decision_notes && (
                <p className="text-xs leading-relaxed text-stone-500">
                  Motivo: {signup.decision_notes}
                </p>
              )}
            </div>
          </SectionCard>

          {/* ---------- Lo que dijo la IA ---------- */}
          {signup.ai_checked_at && (
            <SectionCard title="Lectura automática del comprobante">
              <div className="space-y-4 px-5 py-4">
                <div className="flex flex-wrap items-center gap-2">
                  <Bot className="h-4 w-4 shrink-0 text-stone-400" />
                  {signup.ai_verdict && (
                    <Badge className={AI_VERDICT_META[signup.ai_verdict].badge}>
                      {AI_VERDICT_META[signup.ai_verdict].label}
                    </Badge>
                  )}
                  {signup.ai_confidence !== null && (
                    <span className="text-xs text-stone-500">
                      confianza {Math.round(Number(signup.ai_confidence) * 100)}%
                    </span>
                  )}
                </div>

                {signup.ai_summary && (
                  <p className="text-sm leading-relaxed text-stone-700">{signup.ai_summary}</p>
                )}

                {signup.ai_extracted && (
                  <dl className="grid gap-x-6 gap-y-1.5 text-sm sm:grid-cols-2">
                    {Object.entries(signup.ai_extracted)
                      .filter(([, value]) => value !== null && value !== '' && value !== false)
                      .map(([key, value]) => (
                        <div key={key} className="flex min-w-0 justify-between gap-3">
                          <dt className="shrink-0 text-stone-500">{key.replace(/_/g, ' ')}</dt>
                          <dd className="min-w-0 truncate text-right text-stone-900">
                            {String(value)}
                          </dd>
                        </div>
                      ))}
                  </dl>
                )}

                <p className="text-xs leading-relaxed text-stone-400">
                  Esto es lo que leyó el modelo, no una decisión. La aprobación automática además
                  compara el monto y la cuenta de destino; todo lo que no cierra llega acá para que
                  lo mires vos.
                </p>
              </div>
            </SectionCard>
          )}

          {/* ---------- Alta ---------- */}
          {signup.onboarding && (
            <SectionCard title="Respuestas del alta">
              <div className="space-y-5 px-5 py-4">
                {ONBOARDING_SECTIONS.map((section) => {
                  const rows = section.fields.filter(([key]) => signup.onboarding?.[key]);
                  if (rows.length === 0) return null;
                  return (
                    <div key={section.title}>
                      <p className="text-[11px] font-semibold uppercase tracking-wider text-stone-400">
                        {section.title}
                      </p>
                      <dl className="mt-2 space-y-1.5">
                        {rows.map(([key, label]) => (
                          <div key={key} className="flex flex-col gap-0.5 sm:flex-row sm:gap-3">
                            <dt className="shrink-0 text-sm text-stone-500 sm:w-48">{label}</dt>
                            <dd className="min-w-0 whitespace-pre-line text-sm text-stone-900">
                              {signup.onboarding?.[key]}
                            </dd>
                          </div>
                        ))}
                      </dl>
                    </div>
                  );
                })}

                {signup.onboarding.logo_path && (
                  <LogoPreview path={signup.onboarding.logo_path} />
                )}
              </div>
            </SectionCard>
          )}
        </div>

        {/* ---------- Columna lateral ---------- */}
        <div className="space-y-6">
          <SectionCard title="Contacto">
            <dl className="divide-y divide-stone-100">
              <Row label="Persona" value={signup.contact_name} />
              <Row label="Email" value={signup.email} />
              <Row label="WhatsApp" value={signup.whatsapp} />
              <Row label="Ciudad" value={signup.city} />
              <Row label="Rubro" value={signup.industry} />
            </dl>
            {wa && (
              <div className="border-t border-stone-200 px-5 py-3">
                <a
                  href={`https://wa.me/${wa}`}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-2 text-sm text-stone-600 transition-colors hover:text-stone-900"
                >
                  <MessageCircle className="h-4 w-4" />
                  Escribirle por WhatsApp
                </a>
              </div>
            )}
          </SectionCard>

          <SectionCard title="Su pantalla">
            <div className="space-y-3 px-5 py-4">
              <p className="text-sm leading-relaxed text-stone-600">
                {selfService
                  ? 'El link con el que sigue su contratación y elige su contraseña.'
                  : 'El link con el que sigue su contratación y completa el alta.'}
              </p>
              <p className="break-all rounded-md bg-stone-50 px-3 py-2 font-mono text-xs text-stone-600">
                /contratar/{signup.token}
              </p>
              {!selfService && (
                <p className="flex items-center gap-1.5 text-xs text-stone-500">
                  <ClipboardList className="h-3.5 w-3.5 shrink-0" />
                  {signup.onboarding_at
                    ? `Completó el alta el ${longDate(signup.onboarding_at)}.`
                    : 'Todavía no completó el alta.'}
                </p>
              )}
            </div>
          </SectionCard>

          {signup.status === 'aprobado' && (
            <SectionCard title="Tienda y acceso">
              <SignupStore
                id={signup.id}
                selfService={selfService}
                slug={signup.store_slug}
                address={storeAddress}
                provisioned={Boolean(signup.provisioned_at)}
                provisionError={signup.provision_error}
                passwordSetAt={signup.password_set_at}
                notifiedAt={signup.notified_at}
                readyNotifiedAt={signup.ready_notified_at}
              />
            </SectionCard>
          )}

          <SectionCard title="Cliente">
            <div className="px-5 py-4">
              {signup.client_id ? (
                <Link
                  href={`/clientes/${signup.client_id}`}
                  className="text-sm text-brand-800 hover:underline"
                >
                  Ver la ficha del cliente
                </Link>
              ) : signup.status === 'aprobado' ? (
                <div className="space-y-3">
                  <p className="text-sm leading-relaxed text-stone-600">
                    Todavía no tiene ficha. Al crearla se copian los datos y las respuestas del
                    alta.
                  </p>
                  <ConvertToClient id={signup.id} />
                </div>
              ) : (
                <p className="text-sm text-stone-500">
                  La ficha se crea cuando el pago está aprobado.
                </p>
              )}
            </div>
          </SectionCard>
        </div>
      </div>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string | null }) {
  return (
    <div className="flex items-start justify-between gap-3 px-5 py-2.5">
      <dt className="shrink-0 text-sm text-stone-500">{label}</dt>
      <dd className="min-w-0 break-words text-right text-sm text-stone-900">{value || '—'}</dd>
    </div>
  );
}
