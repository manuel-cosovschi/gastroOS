import { randomBytes } from 'node:crypto';
import { createServiceClient, createSovareClient } from '@/lib/supabase/service';
import { sendMail } from '@/lib/mailer';
import { publicStoreUrl } from '@/lib/business';
import { slugFromName } from '@/lib/tenant';
import { CONTACT_EMAIL, SITE_URL, SOVARE_PANEL_URL, WHATSAPP_URL } from '@/lib/marketing';
import {
  buildAccessMail,
  buildOwnerAlert,
  buildReadyMail,
  buildSelfServiceApprovalMail,
  buildSelfServicePendingMail,
  buildSetupApprovalMail,
  type MailContent,
  type OwnerAlertKind,
} from '@/lib/signup-mail';

/**
 * Lo que pasa después de que un pago queda aprobado.
 *
 * Aprobar es una decisión que toma la IA al leer el comprobante o una persona en
 * el panel, y las dos terminan acá. Por eso esto no vive dentro de ninguna de
 * las dos acciones: el resultado tiene que ser el mismo se apruebe como se
 * apruebe.
 *
 *   - Plan de autoservicio (el Taller, sin puesta a punto): se crea el negocio,
 *     la cuenta del dueño y la ficha de cliente, y se le manda el mail con el
 *     acceso. No hay nada que armar a mano.
 *   - Plan con puesta a punto: se le manda el mail con el formulario de alta y el
 *     resto lo hacemos nosotros.
 *
 * Nada de esto puede tirar. El pago ya entró y ya está registrado; que falle un
 * mail o la creación de una cuenta se anota, se le avisa al dueño y se puede
 * repetir, pero nunca deshace una aprobación. Todas las funciones son
 * idempotentes: llamarlas dos veces deja el mismo resultado que una.
 *
 * No es un archivo `'use server'` a propósito: todo lo que exporta uno de esos
 * se convierte en un endpoint al que cualquiera puede llamar desde el navegador,
 * y nada de acá debe poder llamarse así.
 */

type SovareClient = NonNullable<ReturnType<typeof createSovareClient>>;

export interface SignupRecord {
  id: string;
  token: string;
  status: string;
  business_name: string;
  contact_name: string | null;
  email: string;
  whatsapp: string | null;
  city: string | null;
  industry: string | null;
  plan: string;
  amount: number;
  currency: string;
  business_id: string | null;
  owner_user_id: string | null;
  provisioned_at: string | null;
  provision_error: string | null;
  password_set_at: string | null;
  notified_at: string | null;
  ready_notified_at: string | null;
  ai_summary: string | null;
  plan_label: string;
  plan_setup: number;
}

const COLUMNS =
  'id, token, status, business_name, contact_name, email, whatsapp, city, industry, plan, amount, currency, business_id, owner_user_id, provisioned_at, provision_error, password_set_at, notified_at, ready_notified_at, ai_summary, plans(label, setup)';

export async function loadSignup(sovare: SovareClient, id: string): Promise<SignupRecord | null> {
  const { data, error } = await sovare.from('signups').select(COLUMNS).eq('id', id).maybeSingle();
  if (error || !data) {
    if (error) console.error('[signup-flow] no se pudo leer la contratación:', error);
    return null;
  }
  return toRecord(data);
}

export async function loadSignupByToken(
  sovare: SovareClient,
  token: string
): Promise<SignupRecord | null> {
  const { data, error } = await sovare.from('signups').select(COLUMNS).eq('token', token).maybeSingle();
  if (error || !data) {
    if (error) console.error('[signup-flow] no se pudo leer la contratación:', error);
    return null;
  }
  return toRecord(data);
}

function toRecord(row: Record<string, unknown>): SignupRecord {
  const plans = row.plans as { label: string; setup: number } | { label: string; setup: number }[] | null;
  const plan = Array.isArray(plans) ? plans[0] : plans;
  const { plans: _plans, ...rest } = row;
  void _plans;
  return {
    ...(rest as unknown as SignupRecord),
    amount: Number(row.amount),
    plan_label: plan?.label || String(row.plan),
    plan_setup: Number(plan?.setup ?? 0),
  };
}

/**
 * Un plan de autoservicio es el que no lleva puesta a punto: el cliente carga su
 * propio catálogo, así que no hay nada que montar a mano y la cuenta se puede
 * crear sola. Es la misma regla que usa la página para describir los planes.
 */
export function isSelfService(signup: Pick<SignupRecord, 'plan_setup'>): boolean {
  return signup.plan_setup <= 0;
}

function mailContext(signup: SignupRecord) {
  return {
    token: signup.token,
    contactName: signup.contact_name,
    businessName: signup.business_name,
    planLabel: signup.plan_label,
    siteUrl: SITE_URL,
    whatsappUrl: WHATSAPP_URL,
  };
}

// ============================================
// Crear la cuenta del cliente
// ============================================

export type ProvisionResult =
  | { ok: true; created: boolean; slug: string; businessId: string; storeUrl: string | null }
  | {
      ok: false;
      reason: 'not_approved' | 'email_in_use' | 'in_progress' | 'unavailable' | 'failed';
      message: string;
    };

/** Cuánto vale el candado de "ya la estoy creando". Pasado esto se da por colgado. */
const LEASE_MINUTES = 3;

/**
 * Deja al cliente con su negocio, su cuenta de dueño y su ficha de cliente.
 *
 * Va en tres pasos que se pueden repetir por separado, porque el segundo no cabe
 * en una transacción de la base (la cuenta la crea el servicio de autenticación):
 *
 *   1. el negocio, la ficha y el primer cobro, en una función de la base que es
 *      atómica e idempotente;
 *   2. la cuenta del dueño y su membresía;
 *   3. las marcas que dicen que terminó.
 *
 * Si la corrida se corta entre un paso y otro, la siguiente sigue desde donde
 * quedó: no hay que limpiar nada a mano.
 *
 * Si el mail ya tiene una cuenta no se la toca ni se le cuelga el negocio nuevo:
 * quien contrate con el mail de otro cliente no puede, por esa vía, quedarse
 * con su cuenta ni meterse en ella. Eso queda anotado para resolverlo a mano.
 */
export async function provisionStore(signupId: string): Promise<ProvisionResult> {
  const sovare = createSovareClient();
  const service = createServiceClient();
  if (!sovare || !service) {
    return { ok: false, reason: 'unavailable', message: 'Falta configurar la clave de servicio.' };
  }

  const signup = await loadSignup(sovare, signupId);
  if (!signup || signup.status !== 'aprobado') {
    return { ok: false, reason: 'not_approved', message: 'La contratación no está aprobada.' };
  }

  // ---------- 1. El negocio ----------
  let businessId = signup.business_id;
  let slug = '';
  let created = false;

  if (!businessId) {
    const made = await createBusiness(sovare, signup);
    if (!made.ok) {
      await recordError(sovare, signup.id, made.message);
      return { ok: false, reason: 'failed', message: made.message };
    }
    businessId = made.businessId;
    slug = made.slug;
    created = made.created;
  } else {
    slug = (await businessSlug(service, businessId)) || '';
    if (!slug) {
      const message = 'El negocio de esta contratación ya no existe.';
      await recordError(sovare, signup.id, message);
      return { ok: false, reason: 'failed', message };
    }
  }

  // ---------- 2. La cuenta del dueño ----------
  let ownerId = signup.owner_user_id;

  if (!ownerId) {
    // Una corrida anterior pudo crear la cuenta y cortarse antes de anotarla.
    const { data: member } = await service
      .from('business_members')
      .select('user_id')
      .eq('business_id', businessId)
      .eq('role', 'owner')
      .limit(1)
      .maybeSingle();
    ownerId = member?.user_id ?? null;
  }

  if (!ownerId) {
    if (!(await takeLease(sovare, signup.id))) {
      return {
        ok: false,
        reason: 'in_progress',
        message: 'Ya se está creando la cuenta. Probá de nuevo en un momento.',
      };
    }

    const { data: account, error: accountError } = await service.auth.admin.createUser({
      email: signup.email.trim().toLowerCase(),
      // Una contraseña que nadie conoce: quien contrató elige la suya desde el
      // link de su contratación. Mientras tanto la cuenta no se puede abrir.
      password: randomBytes(32).toString('base64url'),
      email_confirm: true,
      app_metadata: { gastroos_tenant: true },
      user_metadata: { business_name: signup.business_name, full_name: signup.contact_name },
    });

    if (accountError || !account?.user) {
      await releaseLease(sovare, signup.id);
      const taken =
        accountError?.code === 'email_exists' ||
        /already (been )?registered|already exists/i.test(accountError?.message || '');
      const message = taken
        ? 'Ese mail ya tiene una cuenta en GastroOS. Hay que resolverlo a mano.'
        : 'No se pudo crear la cuenta del dueño.';
      if (!taken) console.error('[provisionStore] no se pudo crear la cuenta:', accountError);
      await recordError(sovare, signup.id, message);
      return { ok: false, reason: taken ? 'email_in_use' : 'failed', message };
    }

    const { error: memberError } = await service
      .from('business_members')
      .insert({ business_id: businessId, user_id: account.user.id, role: 'owner' });

    if (memberError) {
      console.error('[provisionStore] no se pudo vincular al dueño:', memberError);
      // Una cuenta sin negocio no sirve para nada y trabaría el siguiente intento.
      await service.auth.admin.deleteUser(account.user.id);
      await releaseLease(sovare, signup.id);
      const message = 'No se pudo vincular la cuenta con el negocio.';
      await recordError(sovare, signup.id, message);
      return { ok: false, reason: 'failed', message };
    }

    ownerId = account.user.id;
    created = true;
  }

  // ---------- 3. Cerrar ----------
  const { error: closeError } = await sovare
    .from('signups')
    .update({
      owner_user_id: ownerId,
      store_slug: slug,
      provisioned_at: new Date().toISOString(),
      provision_started_at: null,
      provision_error: null,
    })
    .eq('id', signup.id);

  if (closeError) {
    console.error('[provisionStore] no se pudo anotar el cierre:', closeError);
    return { ok: false, reason: 'failed', message: 'La cuenta quedó creada pero no se pudo anotar.' };
  }

  const storeUrl = publicStoreUrl(slug);
  await linkClientUrls(sovare, signup, storeUrl);

  return { ok: true, created, slug, businessId, storeUrl };
}

/** Crea el negocio probando nombres hasta que la base acepte uno. */
async function createBusiness(
  sovare: SovareClient,
  signup: SignupRecord
): Promise<
  | { ok: true; businessId: string; slug: string; created: boolean }
  | { ok: false; message: string }
> {
  const base = slugFromName(signup.business_name);
  // Un nombre reservado o que no alcanza se reintenta con un sufijo antes de rendirse.
  const candidates = [base, `${base.slice(0, 33).replace(/-+$/, '')}-tienda`, 'mi-tienda'];

  let lastMessage = 'No se pudo crear el negocio.';
  for (const candidate of candidates) {
    const { data, error } = await sovare.rpc('provision_business', {
      p_signup: signup.id,
      p_slug: candidate,
    });

    if (!error && data && typeof data === 'object') {
      const result = data as { business_id: string; slug: string; created: boolean };
      return { ok: true, businessId: result.business_id, slug: result.slug, created: result.created };
    }

    // P0001 son los mensajes pensados para leerse; el resto es un fallo de verdad.
    if (error?.code !== 'P0001') {
      console.error('[provisionStore] falló provision_business:', error);
      return { ok: false, message: 'No se pudo crear el negocio.' };
    }
    lastMessage = error.message;
    if (!/dirección/i.test(error.message)) break;
  }
  return { ok: false, message: lastMessage };
}

async function businessSlug(
  service: NonNullable<ReturnType<typeof createServiceClient>>,
  businessId: string
): Promise<string | null> {
  const { data } = await service.from('businesses').select('slug').eq('id', businessId).maybeSingle();
  return data?.slug ?? null;
}

async function takeLease(sovare: SovareClient, id: string): Promise<boolean> {
  const stale = new Date(Date.now() - LEASE_MINUTES * 60_000).toISOString();
  const { data, error } = await sovare
    .from('signups')
    .update({ provision_started_at: new Date().toISOString() })
    .eq('id', id)
    .is('owner_user_id', null)
    .or(`provision_started_at.is.null,provision_started_at.lt.${stale}`)
    .select('id');
  if (error) console.error('[provisionStore] no se pudo tomar el candado:', error);
  return !error && (data?.length ?? 0) > 0;
}

async function releaseLease(sovare: SovareClient, id: string) {
  await sovare.from('signups').update({ provision_started_at: null }).eq('id', id);
}

async function recordError(sovare: SovareClient, id: string, message: string) {
  await sovare.from('signups').update({ provision_error: message }).eq('id', id);
}

/** Las direcciones en la ficha de cliente, para tenerlas a mano en el panel. */
async function linkClientUrls(sovare: SovareClient, signup: SignupRecord, storeUrl: string | null) {
  const { data: fresh } = await sovare.from('signups').select('client_id').eq('id', signup.id).maybeSingle();
  if (!fresh?.client_id) return;

  const patch: Record<string, string> = {};
  if (SITE_URL) patch.panel_url = `${SITE_URL}/admin`;
  if (storeUrl) patch.storefront_url = storeUrl;
  if (Object.keys(patch).length === 0) return;

  const { error } = await sovare.from('clients').update(patch).eq('id', fresh.client_id);
  if (error) console.error('[provisionStore] no se pudieron anotar las direcciones:', error);
}

// ============================================
// Después de aprobar
// ============================================

export interface ApprovalOutcome {
  mail: 'sent' | 'failed' | 'already' | 'skipped';
  mailReason?: string;
  provision: ProvisionResult | null;
}

/**
 * Todo lo que sigue a un pago aprobado.
 *
 * `source` dice quién aprobó: la IA (nadie se enteró, hay que avisarle al dueño)
 * o una persona desde el panel (ya lo sabe, y el resultado vuelve en la
 * respuesta). El mail al cliente sale una sola vez; `force` lo manda de nuevo.
 */
export async function afterApproval(
  signupId: string,
  source: 'ia' | 'panel',
  options: { force?: boolean } = {}
): Promise<ApprovalOutcome> {
  const sovare = createSovareClient();
  if (!sovare) return { mail: 'skipped', provision: null };

  let signup = await loadSignup(sovare, signupId);
  if (!signup || signup.status !== 'aprobado') return { mail: 'skipped', provision: null };

  let provision: ProvisionResult | null = null;
  if (isSelfService(signup)) {
    try {
      provision = await provisionStore(signup.id);
    } catch (error) {
      console.error('[afterApproval] falló la creación de la cuenta:', error);
      provision = { ok: false, reason: 'failed', message: 'Falló la creación de la cuenta.' };
    }
    signup = (await loadSignup(sovare, signupId)) || signup;
  }

  let mail: ApprovalOutcome['mail'] = 'already';
  let mailReason: string | undefined;
  if (!signup.notified_at || options.force) {
    try {
      const sent = await sendApprovalMail(sovare, signup, provision);
      mail = sent.sent ? 'sent' : 'failed';
      mailReason = sent.reason;
    } catch (error) {
      console.error('[afterApproval] falló el mail de aprobación:', error);
      mail = 'failed';
      mailReason = 'Falló el armado del mail.';
    }
  }

  if (source === 'ia') {
    const detail = provision
      ? provision.ok
        ? `Se creó su tienda (${provision.slug}).`
        : `No se pudo crear la tienda: ${provision.message}`
      : 'Falta que complete el formulario de alta.';
    await alertOwner(
      provision && !provision.ok ? 'tienda_con_problema' : 'pago_aprobado',
      signup,
      detail
    );
  }

  return { mail, mailReason, provision };
}

/**
 * El mail de aprobación, el que corresponda al plan y a cómo salió la cuenta.
 * Si no sale se deja anotado en la contratación para que el panel lo muestre.
 */
export async function sendApprovalMail(
  sovare: SovareClient,
  signup: SignupRecord,
  provision: ProvisionResult | null
): Promise<{ sent: boolean; reason?: string }> {
  let content: MailContent;

  if (!isSelfService(signup)) {
    content = buildSetupApprovalMail({ ...mailContext(signup), amount: signup.amount });
  } else if (provision?.ok || signup.provisioned_at) {
    const slug = provision?.ok ? provision.slug : await slugFromSignup(signup);
    content = buildSelfServiceApprovalMail({
      ...mailContext(signup),
      amount: signup.amount,
      storeUrl: slug ? publicStoreUrl(slug) : null,
      needsPassword: !signup.password_set_at,
    });
  } else {
    content = buildSelfServicePendingMail({ ...mailContext(signup), amount: signup.amount });
  }

  const result = await sendMail({
    to: signup.email,
    ...content,
    replyTo: process.env.NEXT_PUBLIC_CONTACT_EMAIL,
  });

  // Que el mail no salga no cambia que el pago entró. Queda anotado para que el
  // panel lo muestre y se pueda mandar a mano.
  await sovare
    .from('signups')
    .update(
      result.sent
        ? { notified_at: new Date().toISOString() }
        : { decision_notes: `No se pudo enviar el mail de aprobación: ${result.reason}` }
    )
    .eq('id', signup.id);

  return result;
}

async function slugFromSignup(signup: SignupRecord): Promise<string | null> {
  if (!signup.business_id) return null;
  const service = createServiceClient();
  return service ? businessSlug(service, signup.business_id) : null;
}

// ============================================
// "Tu sistema está listo" y reenviar el acceso
// ============================================

export type SimpleResult = { ok: true; detail?: string } | { ok: false; message: string };

/**
 * Le avisa a un cliente de un plan con puesta a punto que su sistema ya está
 * armado. Hasta ahora esto era un WhatsApp que había que acordarse de mandar.
 *
 * `entryUrl` es opcional: si el cliente tiene su cuenta en GastroOS se usa su
 * acceso, y si lo armamos aparte se le pasa la dirección a mano.
 */
export async function sendReadyNotice(
  signupId: string,
  options: { entryUrl?: string | null; note?: string | null } = {}
): Promise<SimpleResult> {
  const sovare = createSovareClient();
  if (!sovare) return { ok: false, message: 'Falta configurar la clave de servicio.' };

  const signup = await loadSignup(sovare, signupId);
  if (!signup || signup.status !== 'aprobado') {
    return { ok: false, message: 'La contratación no está aprobada.' };
  }

  const custom = options.entryUrl?.trim();
  let entryUrl: string;
  let entryLabel = 'Entrar a mi sistema';

  if (custom) {
    if (!isHttpUrl(custom)) return { ok: false, message: 'La dirección tiene que empezar con https://' };
    entryUrl = custom;
  } else if (signup.provisioned_at && signup.owner_user_id) {
    entryUrl = signup.password_set_at ? `${SITE_URL}/login` : `${SITE_URL}/contratar/${signup.token}`;
    entryLabel = signup.password_set_at ? 'Entrar a mi panel' : 'Elegir mi contraseña y entrar';
  } else {
    return {
      ok: false,
      message: 'Todavía no tiene cuenta. Creale la tienda o pasá la dirección donde entra.',
    };
  }

  const slug = await slugFromSignup(signup);
  const content = buildReadyMail({
    ...mailContext(signup),
    entryUrl,
    entryLabel,
    storeUrl: slug ? publicStoreUrl(slug) : null,
    note: options.note?.trim() ? options.note.trim().slice(0, 500) : null,
  });

  const result = await sendMail({
    to: signup.email,
    ...content,
    replyTo: process.env.NEXT_PUBLIC_CONTACT_EMAIL,
  });
  if (!result.sent) return { ok: false, message: result.reason || 'No salió el mail.' };

  await sovare
    .from('signups')
    .update({ ready_notified_at: new Date().toISOString() })
    .eq('id', signup.id);
  return { ok: true };
}

/**
 * Vuelve a abrir la elección de contraseña y manda el link.
 *
 * Es lo que se hace cuando alguien perdió la suya. El acceso sólo se reabre para
 * una cuenta que creó esta misma contratación: una cuenta que ya existía de
 * antes nunca se maneja por acá.
 */
export async function resendAccess(signupId: string): Promise<SimpleResult> {
  const sovare = createSovareClient();
  if (!sovare) return { ok: false, message: 'Falta configurar la clave de servicio.' };

  const signup = await loadSignup(sovare, signupId);
  if (!signup || signup.status !== 'aprobado') {
    return { ok: false, message: 'La contratación no está aprobada.' };
  }
  if (!signup.owner_user_id || !signup.provisioned_at) {
    return { ok: false, message: 'Todavía no tiene cuenta para reabrir.' };
  }

  const { error } = await sovare
    .from('signups')
    .update({ password_set_at: null })
    .eq('id', signup.id);
  if (error) {
    console.error('[resendAccess] no se pudo reabrir la contraseña:', error);
    return { ok: false, message: 'No se pudo reabrir el acceso.' };
  }

  const link = `${SITE_URL}/contratar/${signup.token}`;
  const result = await sendMail({
    to: signup.email,
    ...buildAccessMail(mailContext(signup)),
    replyTo: process.env.NEXT_PUBLIC_CONTACT_EMAIL,
  });

  return result.sent
    ? { ok: true, detail: link }
    : { ok: false, message: `El acceso se reabrió pero el mail no salió. El link es ${link}` };
}

function isHttpUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return url.protocol === 'https:' || url.protocol === 'http:';
  } catch {
    return false;
  }
}

// ============================================
// Elegir la contraseña
// ============================================

export type PasswordResult =
  | { ok: true; email: string }
  | { ok: false; message: string };

/**
 * Fija la contraseña de la cuenta que creó esta contratación.
 *
 * Quien tiene el link de la contratación puede elegirla una sola vez: la marca
 * `password_set_at` se toma antes de tocar nada, así dos pedidos a la vez no
 * pueden pisarse, y si el cambio falla la marca se devuelve. Después de eso el
 * link sirve para ver el estado y nada más, hasta que el panel reabra el acceso.
 */
export async function choosePassword(token: string, password: string): Promise<PasswordResult> {
  const sovare = createSovareClient();
  const service = createServiceClient();
  if (!sovare || !service) return { ok: false, message: 'No está disponible en este momento.' };

  const signup = await loadSignupByToken(sovare, token);
  if (!signup || signup.status !== 'aprobado' || !signup.owner_user_id || !signup.provisioned_at) {
    return { ok: false, message: 'Tu cuenta todavía no está lista. Probá de nuevo en un momento.' };
  }
  if (signup.password_set_at) {
    return {
      ok: false,
      message: 'Ya elegiste tu contraseña. Entrá con tu mail desde la pantalla de acceso.',
    };
  }

  const { data: claimed } = await sovare
    .from('signups')
    .update({ password_set_at: new Date().toISOString() })
    .eq('id', signup.id)
    .is('password_set_at', null)
    .select('id');
  if (!claimed || claimed.length === 0) {
    return { ok: false, message: 'Ya elegiste tu contraseña. Entrá con tu mail desde la pantalla de acceso.' };
  }

  // Cualquier cosa que salga mal devuelve la marca: si no, quien tuvo un problema
  // de red quedaría sin poder elegir su contraseña nunca más.
  let failure: { code?: string } | null = null;
  try {
    const { error } = await service.auth.admin.updateUserById(signup.owner_user_id, { password });
    failure = error;
  } catch (thrown) {
    failure = thrown as { code?: string };
  }

  if (failure) {
    await sovare.from('signups').update({ password_set_at: null }).eq('id', signup.id);
    const weak = failure.code === 'weak_password';
    if (!weak) console.error('[choosePassword] no se pudo guardar la contraseña:', failure);
    return {
      ok: false,
      message: weak
        ? 'Elegí una contraseña más segura: mezclá letras y números.'
        : 'No pudimos guardar tu contraseña. Probá de nuevo.',
    };
  }

  return { ok: true, email: signup.email.trim().toLowerCase() };
}

// ============================================
// Avisos al dueño de SOVARE
// ============================================

/**
 * Le avisa al dueño de SOVARE. Sin esto, un pago que entra a las once de la noche
 * espera hasta la próxima vez que alguien abra el panel.
 *
 * Nunca lanza: el aviso es una comodidad y el pago ya está registrado.
 */
export async function alertOwner(
  kind: OwnerAlertKind,
  signup: Pick<
    SignupRecord,
    'id' | 'business_name' | 'plan_label' | 'amount' | 'contact_name' | 'email' | 'whatsapp'
  >,
  detail: string | null
) {
  if (!CONTACT_EMAIL) return;

  try {
    const panel = SOVARE_PANEL_URL ? SOVARE_PANEL_URL.replace(/\/$/, '') : '';
    const content = buildOwnerAlert({
      kind,
      businessName: signup.business_name,
      planLabel: signup.plan_label,
      amount: signup.amount,
      contactName: signup.contact_name,
      email: signup.email,
      whatsapp: signup.whatsapp,
      detail,
      reviewUrl: panel ? `${panel}/contrataciones/${signup.id}` : '',
    });
    const result = await sendMail({ to: CONTACT_EMAIL, ...content });
    if (!result.sent) console.error('[alertOwner] no salió el aviso al dueño:', result.reason);
  } catch (error) {
    console.error('[alertOwner] falló el aviso al dueño:', error);
  }
}
