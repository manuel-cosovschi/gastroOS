'use server';

import { createSovareClient } from '@/lib/supabase/service';
import {
  firstPayment,
  getPlanAmount,
  getTransferDetails,
  signupsEnabled,
} from '@/lib/signups';
import { judgeReceipt, AI_READABLE_TYPES } from '@/lib/receipt-ai';
import { mailLayout, mailButton, sendMail } from '@/lib/mailer';
import { signupFormSchema, onboardingSchema } from '@/lib/validations/signup';
import { WHATSAPP_URL, SITE_URL } from '@/lib/marketing';
import type { OnboardingFormValues, SignupFormValues } from '@/lib/validations/signup';
import type { SignupPublicView } from '@/types/signup';

/**
 * Contratación de un plan de GastroOS desde la página.
 *
 * Todo pasa por el cliente con service role: quien contrata no tiene sesión, y
 * si pudiera escribir la tabla con la anon key podría escribir también el
 * veredicto de la IA y aprobarse el pago solo. Acá el servidor es la única
 * validación, así que las reglas que importan están escritas explícitas:
 *
 *   - el monto lo calcula el servidor desde `sovare.plans`, nunca llega del
 *     formulario;
 *   - el estado nunca pasa a `aprobado` desde el navegador;
 *   - un comprobante sólo se reemplaza mientras la contratación no esté
 *     decidida.
 */

const BUCKET = 'sovare-comprobantes';
const ALTAS_BUCKET = 'sovare-altas';
const MAX_BYTES = 8 * 1024 * 1024;
const RECEIPT_TYPES = [...AI_READABLE_TYPES, 'image/heic', 'application/pdf'];
const LOGO_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/svg+xml'];

type Result<T> = { success: true; data: T } | { success: false; error: string };

// ============================================
// Alta de la contratación
// ============================================

export async function startSignup(input: SignupFormValues): Promise<Result<{ token: string }>> {
  if (!signupsEnabled()) return fail('La contratación en línea no está disponible.');

  const parsed = signupFormSchema.safeParse(input);
  if (!parsed.success) {
    return fail(parsed.error.issues[0]?.message || 'Revisá los datos del formulario.');
  }

  const plan = await getPlanAmount(parsed.data.plan);
  if (!plan) return fail('Ese plan no existe. Volvé a elegir uno.');

  const supabase = createSovareClient();
  if (!supabase) return fail('La contratación en línea no está disponible.');

  const { data, error } = await supabase
    .from('signups')
    .insert({
      business_name: parsed.data.business_name,
      contact_name: parsed.data.contact_name,
      email: parsed.data.email.toLowerCase(),
      whatsapp: parsed.data.whatsapp,
      city: parsed.data.city || null,
      industry: parsed.data.industry || null,
      plan: plan.code,
      // Desde la página siempre es el primer pago de alguien nuevo: puesta a
      // punto más el primer mes. Una renovación no pasa por acá.
      includes_setup: true,
      amount: firstPayment(plan, true),
      currency: plan.currency,
    })
    .select('token')
    .single();

  if (error || !data) {
    console.error('[startSignup] no se pudo crear la contratación:', error);
    return fail('No pudimos registrar la contratación. Probá de nuevo.');
  }

  return { success: true, data: { token: data.token } };
}

// ============================================
// Lectura por token
// ============================================

export async function getSignup(token: string): Promise<SignupPublicView | null> {
  if (!signupsEnabled() || !isToken(token)) return null;

  const supabase = createSovareClient();
  if (!supabase) return null;

  const { data, error } = await supabase
    .from('signups')
    .select(
      'token, business_name, contact_name, email, whatsapp, plan, amount, currency, status, receipt_path, onboarding_at, created_at, plans(label)'
    )
    .eq('token', token)
    .maybeSingle();

  if (error) {
    console.error('[getSignup] no se pudo leer la contratación:', error);
    return null;
  }
  if (!data) return null;

  const plans = data.plans as { label: string } | { label: string }[] | null;
  const label = Array.isArray(plans) ? plans[0]?.label : plans?.label;

  return {
    token: data.token,
    business_name: data.business_name,
    contact_name: data.contact_name,
    email: data.email,
    whatsapp: data.whatsapp,
    plan: data.plan,
    plan_label: label || data.plan,
    amount: Number(data.amount),
    currency: data.currency,
    status: data.status,
    has_receipt: Boolean(data.receipt_path),
    onboarding_done: Boolean(data.onboarding_at),
    created_at: data.created_at,
  };
}

// ============================================
// Comprobante
// ============================================

export async function uploadReceipt(
  token: string,
  form: FormData
): Promise<Result<{ status: string; message: string }>> {
  if (!signupsEnabled() || !isToken(token)) return fail('La contratación no está disponible.');

  const transfer = getTransferDetails();
  const supabase = createSovareClient();
  if (!supabase || !transfer) return fail('La contratación no está disponible.');

  const file = form.get('receipt');
  if (!(file instanceof File) || file.size === 0) return fail('Elegí el archivo del comprobante.');
  if (file.size > MAX_BYTES) return fail('El archivo pesa más de 8 MB. Probá con una captura.');
  if (!RECEIPT_TYPES.includes(file.type)) {
    return fail('Subí una imagen (JPG, PNG, WEBP) o un PDF.');
  }

  const { data: signup, error: readError } = await supabase
    .from('signups')
    .select('id, token, amount, status, business_name, contact_name, email, whatsapp, plan, plans(label)')
    .eq('token', token)
    .maybeSingle();

  if (readError || !signup) return fail('No encontramos esa contratación.');
  if (signup.status === 'aprobado') {
    return fail('Esta contratación ya está aprobada: no hace falta subir nada más.');
  }
  if (signup.status === 'rechazado') {
    return fail('Esta contratación fue rechazada. Escribinos por WhatsApp y lo vemos.');
  }

  const bytes = Buffer.from(await file.arrayBuffer());
  const path = `${signup.token}/${Date.now()}-${safeName(file.name)}`;

  const { error: uploadError } = await supabase.storage
    .from(BUCKET)
    .upload(path, bytes, { contentType: file.type, upsert: false });

  if (uploadError) {
    console.error('[uploadReceipt] no se pudo guardar el comprobante:', uploadError);
    return fail('No pudimos guardar el comprobante. Probá de nuevo.');
  }

  // El comprobante ya está a salvo. De acá en adelante, cualquier cosa que
  // falle deja la contratación en revisión manual, nunca sin registro.
  const verdict = await judgeReceipt({
    image: bytes,
    mimeType: file.type,
    expectedAmount: Number(signup.amount),
    transfer,
  });

  const approved = verdict.approve;
  const { error: updateError } = await supabase
    .from('signups')
    .update({
      receipt_path: path,
      receipt_uploaded_at: new Date().toISOString(),
      status: approved ? 'aprobado' : 'en_revision',
      ai_verdict: verdict.verdict,
      ai_confidence: verdict.confidence,
      ai_summary: verdict.summary,
      ai_extracted: verdict.reading,
      ai_checked_at: new Date().toISOString(),
      ...(approved ? { decided_at: new Date().toISOString() } : {}),
    })
    .eq('id', signup.id);

  if (updateError) {
    console.error('[uploadReceipt] no se pudo registrar el veredicto:', updateError);
    return fail('Guardamos el comprobante pero algo falló al registrarlo. Escribinos por WhatsApp.');
  }

  if (approved) {
    const plans = signup.plans as { label: string } | { label: string }[] | null;
    await sendApprovalMail({
      token: signup.token,
      email: signup.email,
      contactName: signup.contact_name,
      businessName: signup.business_name,
      planLabel: (Array.isArray(plans) ? plans[0]?.label : plans?.label) || signup.plan,
      amount: Number(signup.amount),
      supabase,
      signupId: signup.id,
    });

    return {
      success: true,
      data: {
        status: 'aprobado',
        message: 'Comprobante verificado. Ya te mandamos el mail con los próximos pasos.',
      },
    };
  }

  return {
    success: true,
    data: {
      status: 'en_revision',
      message:
        'Recibimos el comprobante. Lo estamos revisando y te escribimos en cuanto esté; si querés apurarlo, mandanos un WhatsApp.',
    },
  };
}

// ============================================
// Encuesta de alta
// ============================================

export async function submitOnboarding(
  token: string,
  input: OnboardingFormValues,
  form?: FormData
): Promise<Result<{ ok: true }>> {
  if (!signupsEnabled() || !isToken(token)) return fail('El alta no está disponible.');

  const parsed = onboardingSchema.safeParse(input);
  if (!parsed.success) {
    return fail(parsed.error.issues[0]?.message || 'Revisá los datos del formulario.');
  }

  const supabase = createSovareClient();
  if (!supabase) return fail('El alta no está disponible.');

  const { data: signup } = await supabase
    .from('signups')
    .select('id, status')
    .eq('token', token)
    .maybeSingle();

  if (!signup) return fail('No encontramos esa contratación.');
  if (signup.status !== 'aprobado') {
    return fail('El alta se completa una vez que el pago está confirmado.');
  }

  let logoPath: string | null = null;
  const logo = form?.get('logo');
  if (logo instanceof File && logo.size > 0) {
    if (logo.size > MAX_BYTES) return fail('El logo pesa más de 8 MB.');
    if (!LOGO_TYPES.includes(logo.type)) return fail('El logo tiene que ser PNG, JPG, WEBP o SVG.');

    const path = `${token}/logo-${Date.now()}-${safeName(logo.name)}`;
    const { error } = await supabase.storage
      .from(ALTAS_BUCKET)
      .upload(path, Buffer.from(await logo.arrayBuffer()), {
        contentType: logo.type,
        upsert: false,
      });

    // Un logo que no sube no puede hacer que se pierdan treinta respuestas: se
    // guarda el resto y el logo se pide por WhatsApp.
    if (error) console.error('[submitOnboarding] no se pudo guardar el logo:', error);
    else logoPath = path;
  }

  const { error } = await supabase
    .from('signups')
    .update({
      onboarding: { ...parsed.data, logo_path: logoPath },
      onboarding_at: new Date().toISOString(),
    })
    .eq('id', signup.id);

  if (error) {
    console.error('[submitOnboarding] no se pudieron guardar las respuestas:', error);
    return fail('No pudimos guardar las respuestas. Probá de nuevo.');
  }

  return { success: true, data: { ok: true } };
}

// ============================================
// Mail de aprobación
// ============================================

async function sendApprovalMail(params: {
  token: string;
  email: string;
  contactName: string | null;
  businessName: string;
  planLabel: string;
  amount: number;
  signupId: string;
  supabase: NonNullable<ReturnType<typeof createSovareClient>>;
}) {
  const { token, email, contactName, businessName, planLabel, amount, signupId, supabase } = params;

  const base = SITE_URL || '';
  const altaUrl = `${base}/alta/${token}`;
  const estadoUrl = `${base}/contratar/${token}`;
  const saludo = contactName ? `Hola ${contactName.split(' ')[0]},` : 'Hola,';

  const body = `
    <p style="margin:0 0 16px;">${saludo}</p>
    <p style="margin:0 0 16px;">Recibimos tu transferencia de <strong>${money(amount)}</strong> y
    quedó confirmada la contratación del plan <strong>${planLabel}</strong> para
    <strong>${businessName}</strong>. Gracias por la confianza.</p>

    <p style="margin:0 0 8px;"><strong>Lo que sigue</strong></p>
    <ol style="margin:0 0 20px;padding-left:20px;">
      <li style="margin-bottom:8px;">Completás el formulario de alta: son los datos con los que
      armamos tu instalación — tu marca, tus colores, tu catálogo, tus horarios.</li>
      <li style="margin-bottom:8px;">Con eso montamos tu sistema y tu tienda. Te avisamos en cuanto
      esté para que lo veas.</li>
      <li style="margin-bottom:8px;">Hacemos una videollamada de capacitación con tu equipo y
      quedás andando.</li>
    </ol>

    <p style="margin:0 0 20px;">${mailButton(altaUrl, 'Completar el formulario de alta')}</p>

    <p style="margin:0 0 16px;">Tarda unos diez minutos y se puede completar desde el teléfono. Si
    preferís pasarnos los datos hablando, escribinos por WhatsApp y lo hacemos juntos:
    <a href="${WHATSAPP_URL || '#'}" style="color:#047857;">mandar un WhatsApp</a>.</p>

    <p style="margin:0;">El estado de tu contratación lo podés ver siempre en
    <a href="${estadoUrl}" style="color:#047857;">este link</a>. Guardalo.</p>
  `;

  const text = `${saludo}

Recibimos tu transferencia de ${money(amount)} y quedó confirmada la contratación del plan ${planLabel} para ${businessName}.

Lo que sigue:
1. Completás el formulario de alta: ${altaUrl}
2. Con eso montamos tu sistema y tu tienda, y te avisamos cuando esté.
3. Hacemos una videollamada de capacitación con tu equipo.

Si preferís pasarnos los datos hablando, escribinos por WhatsApp: ${WHATSAPP_URL || ''}

El estado de tu contratación: ${estadoUrl}`;

  const result = await sendMail({
    to: email,
    subject: `Tu contratación de GastroOS está confirmada`,
    html: mailLayout({ title: '¡Listo! Tu pago está confirmado', body }),
    text,
    replyTo: process.env.NEXT_PUBLIC_CONTACT_EMAIL,
  });

  // Que el mail no salga no cambia que el pago entró. Queda anotado para que el
  // panel lo muestre y se pueda mandar a mano.
  await supabase
    .from('signups')
    .update(
      result.sent
        ? { notified_at: new Date().toISOString() }
        : { decision_notes: `No se pudo enviar el mail de aprobación: ${result.reason}` }
    )
    .eq('id', signupId);
}

// ============================================
// Helpers
// ============================================

function fail(error: string): { success: false; error: string } {
  return { success: false, error };
}

/** El token es hex de 48 caracteres. Se valida antes de tocar la base. */
function isToken(value: string): boolean {
  return /^[0-9a-f]{32,64}$/.test(value);
}

function safeName(name: string): string {
  return (
    name
      .toLowerCase()
      .normalize('NFD')
      .replace(/[̀-ͯ]/g, '')
      .replace(/[^a-z0-9.]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(-60) || 'comprobante'
  );
}

function money(value: number): string {
  return new Intl.NumberFormat('es-AR', {
    style: 'currency',
    currency: 'ARS',
    maximumFractionDigits: 0,
  }).format(value);
}
