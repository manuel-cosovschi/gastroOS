'use server';

import { revalidatePath } from 'next/cache';
import { createServerClient, requireAdmin } from '@/lib/supabase/server';
import { callLanding, type ProvisionSummary } from '@/lib/landing';
import { todayISO } from '@/lib/utils';

/**
 * `notice` es lo que salió bien y vale la pena contar; `warning`, lo que quedó a
 * medias y hay que mirar. Una acción puede devolver las dos: aprobar un pago
 * puede crear la cuenta y no poder mandar el mail.
 */
type Result = { success: boolean; error?: string; notice?: string; warning?: string };

const DENIED: Result = { success: false, error: 'No tenés permiso.' };

/**
 * Decidir a mano una contratación.
 *
 * La lectura automática del comprobante deja en `en_revision` todo lo que no
 * fue un sí redondo, y esto es el otro lado: la persona mira el comprobante y
 * resuelve. Aprobar desde acá no vuelve a llamar a la IA — el veredicto que
 * quedó guardado es el de la máquina, y este es el de una persona, que pesa
 * más y se anota aparte.
 */
export async function decideSignup(
  id: string,
  decision: 'aprobado' | 'rechazado',
  notes?: string
): Promise<Result> {
  const admin = await requireAdmin();
  if (!admin) return DENIED;

  const supabase = await createServerClient();

  // Qué había antes de decidir. Importa al rechazar: una contratación que ya
  // tiene tienda creada no se "desaprueba" sola.
  const { data: antes } = await supabase
    .from('signups')
    .select('provisioned_at, store_slug, business_id')
    .eq('id', id)
    .maybeSingle();

  const { error } = await supabase
    .from('signups')
    .update({
      status: decision,
      decided_by: admin.id,
      decided_at: new Date().toISOString(),
      decision_notes: notes?.trim() || null,
    })
    .eq('id', id);

  if (error) {
    console.error('[decideSignup] no se pudo guardar la decisión:', error);
    return { success: false, error: 'No se pudo guardar la decisión.' };
  }

  // Aprobar a mano tiene que dejar lo mismo que aprobar con la IA: la cuenta del
  // cliente (si el plan es de autoservicio) y el mail. Eso lo hace la landing, que
  // es la que tiene la clave de servicio y la de Resend. Si no responde, el pago
  // queda aprobado igual y la pantalla ofrece reenviar.
  const follow = decision === 'aprobado' ? await followApproval(id, 'aprobada') : {};

  // Rechazar lo que ya tiene tienda cambia una etiqueta y nada más: la cuenta
  // sigue abierta y la tienda sigue en línea. No la apagamos desde acá a
  // propósito —un clic no debería dejar sin tienda a un negocio que ya está
  // vendiendo, y el caso normal de un rechazo es un comprobante que no era—,
  // pero tampoco puede pasar en silencio.
  const rechazoConTienda =
    decision === 'rechazado' && (antes?.provisioned_at || antes?.business_id);

  revalidatePath('/contrataciones');
  revalidatePath(`/contrataciones/${id}`);
  return {
    success: true,
    ...follow,
    ...(rechazoConTienda
      ? {
          warning:
            `Ojo: a esta contratación ya se le había creado la tienda` +
            `${antes?.store_slug ? ` (${antes.store_slug})` : ''}` +
            `. Queda rechazada, pero la cuenta y la tienda siguen funcionando. ` +
            `Si hay que darlas de baja, hacelo en la ficha del cliente.`,
        }
      : {}),
  };
}

/** Le pide a la landing lo que sigue a una aprobación y traduce la respuesta. */
async function followApproval(
  id: string,
  accion: 'aprobada' | 'reenviar_mail'
): Promise<{ notice?: string; warning?: string }> {
  const reply = await callLanding<{
    mail: 'sent' | 'failed' | 'already' | 'skipped';
    mailReason: string | null;
    provision: ProvisionSummary | null;
  }>({ accion, signupId: id });

  if (!reply.ok) {
    return {
      warning: `Quedó aprobada, pero la landing no respondió (${reply.error}) y no salió el mail ni se creó la cuenta. Probá de nuevo con "Reenviar el mail".`,
    };
  }

  const { mail, mailReason, provision } = reply.data;
  const notice: string[] = [];
  const warning: string[] = [];

  if (provision?.ok) {
    notice.push(
      provision.created
        ? `Se creó su negocio y su cuenta (${provision.slug}).`
        : `Su negocio ya estaba creado (${provision.slug}).`
    );
  } else if (provision) {
    warning.push(`No se pudo crear su cuenta: ${provision.message}`);
  }

  if (mail === 'sent') notice.push('Le mandamos el mail de confirmación.');
  else if (mail === 'already') notice.push('El mail de confirmación ya se había mandado.');
  else if (mail === 'failed') warning.push(`El mail no salió${mailReason ? `: ${mailReason}` : '.'}`);

  return {
    ...(notice.length ? { notice: notice.join(' ') } : {}),
    ...(warning.length ? { warning: warning.join(' ') } : {}),
  };
}

/** Manda de nuevo el mail de confirmación (y completa la cuenta si faltaba). */
export async function resendApprovalMail(id: string): Promise<Result> {
  if (!(await requireAdmin())) return DENIED;

  const follow = await followApproval(id, 'reenviar_mail');
  revalidatePath(`/contrataciones/${id}`);
  return { success: true, ...follow };
}

/**
 * Crea el negocio y la cuenta del cliente ahora. Para el plan de autoservicio es
 * lo que no salió solo; para los otros planes, un adelanto: el negocio vacío ya
 * existe y se le puede ir cargando el catálogo antes de avisarle.
 */
export async function createStoreNow(id: string): Promise<Result> {
  if (!(await requireAdmin())) return DENIED;

  const reply = await callLanding<{ ok: boolean; provision: ProvisionSummary | null }>({
    accion: 'crear_tienda',
    signupId: id,
  });
  revalidatePath(`/contrataciones/${id}`);
  revalidatePath('/contrataciones');
  revalidatePath('/clientes');

  if (!reply.ok) return { success: false, error: reply.error };
  const provision = reply.data.provision;
  if (!provision?.ok) {
    return { success: false, error: provision?.message || 'No se pudo crear la cuenta.' };
  }
  return {
    success: true,
    notice: provision.created
      ? `Listo: se creó el negocio (${provision.slug}) y la cuenta del dueño.`
      : `El negocio ya existía (${provision.slug}).`,
  };
}

/**
 * Avisa que el sistema está listo. Hasta ahora esto era un WhatsApp que había que
 * acordarse de mandar. `entryUrl` y `note` son opcionales.
 */
export async function notifyReady(
  id: string,
  entryUrl?: string,
  note?: string
): Promise<Result> {
  if (!(await requireAdmin())) return DENIED;

  const reply = await callLanding<{ ok: boolean; message?: string }>({
    accion: 'lista',
    signupId: id,
    ...(entryUrl?.trim() ? { entryUrl: entryUrl.trim() } : {}),
    ...(note?.trim() ? { note: note.trim() } : {}),
  });
  revalidatePath(`/contrataciones/${id}`);

  if (!reply.ok) return { success: false, error: reply.error };
  if (!reply.data.ok) return { success: false, error: reply.data.message || 'No se pudo avisar.' };
  return { success: true, notice: 'Le avisamos que su sistema está listo.' };
}

/** Reabre la elección de contraseña y le manda el link (por si perdió la suya). */
export async function resendAccess(id: string): Promise<Result> {
  if (!(await requireAdmin())) return DENIED;

  const reply = await callLanding<{ ok: boolean; message?: string }>({
    accion: 'reenviar_acceso',
    signupId: id,
  });
  revalidatePath(`/contrataciones/${id}`);

  if (!reply.ok) return { success: false, error: reply.error };
  if (!reply.data.ok) return { success: false, error: reply.data.message || 'No se pudo reenviar.' };
  return { success: true, notice: 'Le mandamos el link para elegir una contraseña nueva.' };
}

/**
 * Convierte una contratación en ficha de cliente.
 *
 * Lo que sabemos de la contratación se copia; lo que no, queda para completar
 * a mano. El alta —si la completó— se vuelca en las notas en vez de perderse:
 * es el material con el que se arma la instalación.
 */
export async function convertSignupToClient(id: string): Promise<Result & { clientId?: string }> {
  const admin = await requireAdmin();
  if (!admin) return DENIED;

  const supabase = await createServerClient();
  const { data: signup, error: readError } = await supabase
    .from('signups')
    .select('*')
    .eq('id', id)
    .maybeSingle();

  if (readError || !signup) return { success: false, error: 'No encontramos la contratación.' };
  if (signup.client_id) return { success: false, error: 'Esta contratación ya tiene su cliente.' };
  if (signup.status !== 'aprobado') {
    return { success: false, error: 'Primero aprobá el pago.' };
  }

  const { data: plan } = await supabase
    .from('plans')
    .select('label, monthly, setup')
    .eq('code', signup.plan)
    .maybeSingle();

  const hoy = todayISO();

  const { data: client, error: insertError } = await supabase
    .from('clients')
    .insert({
      business_name: signup.business_name,
      contact_name: signup.contact_name,
      whatsapp: signup.whatsapp,
      email: signup.email,
      industry: signup.industry,
      city: signup.city,
      // Igual que `sovare.provision_business()`: sin puesta a punto no hay nada
      // que implementar, el cliente ya está andando. Y el estado no es cosmético
      // —`generateMonthlyCharges()` sólo le cobra a los activos—, así que un
      // cliente de autoservicio que quedaba en "implementación" no se le cobraba
      // nunca.
      status: (plan?.setup ?? 0) > 0 ? 'implementacion' : 'activo',
      source: 'Contratación desde la página',
      started_at: hoy,
      plan: plan?.label || signup.plan,
      monthly_amount: plan?.monthly ?? null,
      setup_amount: plan?.setup ?? null,
      currency: signup.currency,
      // El día que contrató, que es el que le toca pagar todos los meses. Hasta
      // el 28, que existe en todos. Sin esto quedaba en null y el cobro salía
      // con la fecha de vencimiento por defecto, que no es la que acordó.
      billing_day: Math.min(Number(hoy.slice(8, 10)), 28),
      // Si la tienda ya existe, la ficha nace enlazada: es el mismo enlace que
      // hace `provision_business()` cuando la ficha llega después.
      ...(signup.business_id ? { business_id: signup.business_id } : {}),
      notes: buildNotes(signup),
    })
    .select('id')
    .single();

  if (insertError || !client) {
    console.error('[convertSignupToClient] no se pudo crear el cliente:', insertError);
    return { success: false, error: 'No se pudo crear el cliente.' };
  }

  await supabase.from('signups').update({ client_id: client.id }).eq('id', id);
  await recordFirstPayment(supabase, client.id, signup, plan);

  revalidatePath('/contrataciones');
  revalidatePath(`/contrataciones/${id}`);
  revalidatePath('/clientes');
  revalidatePath('/cobros');
  return { success: true, clientId: client.id };
}

/**
 * Anota como cobrado lo que el cliente ya transfirió al contratar.
 *
 * Sin esto, una ficha creada desde acá nacía sin ningún cobro: el cliente
 * figuraba debiendo el mes que ya había pagado, y la generación de cobros del mes
 * siguiente le sumaba uno de más.
 *
 * Es idempotente por la unicidad de (client_id, period, concept), que es la misma
 * que usa `sovare.provision_business()` cuando crea la tienda. Así los dos caminos
 * dejan el mismo resultado y no importa cuál se use primero, ni si se usan los dos.
 *
 * No corta el alta si falla: la ficha ya está creada y un cobro se puede cargar a
 * mano, pero perder la conversión obligaría a rehacer todo.
 */
async function recordFirstPayment(
  supabase: Awaited<ReturnType<typeof createServerClient>>,
  clientId: string,
  signup: { currency: string; includes_setup: boolean },
  plan: { monthly: number; setup: number } | null
) {
  if (!plan) return;

  const hoy = todayISO();
  const period = `${hoy.slice(0, 8)}01`;
  const comun = {
    client_id: clientId,
    period,
    currency: signup.currency,
    due_date: hoy,
    paid_at: hoy,
    status: 'pagado',
    method: 'Transferencia',
  };

  const filas: Record<string, unknown>[] = [
    {
      ...comun,
      concept: 'Mensualidad',
      amount: plan.monthly,
      notes: 'Primer mes, pagado al contratar desde la página.',
    },
  ];

  if (signup.includes_setup && plan.setup > 0) {
    filas.push({
      ...comun,
      concept: 'Puesta a punto',
      amount: plan.setup,
      notes: 'Pagada junto con el primer mes al contratar desde la página.',
    });
  }

  const { error } = await supabase
    .from('payments')
    .upsert(filas, { onConflict: 'client_id,period,concept', ignoreDuplicates: true });

  if (error) console.error('[convertSignupToClient] no se pudieron anotar los cobros:', error);
}

/**
 * URL firmada para mirar el comprobante.
 *
 * El bucket es privado y así se queda: un comprobante tiene el nombre y el
 * banco de una persona. La URL dura diez minutos, que alcanza para abrirlo y
 * no para que quede dando vueltas en un historial.
 */
export async function getReceiptUrl(path: string): Promise<string | null> {
  if (!(await requireAdmin())) return null;

  const supabase = await createServerClient();
  const { data, error } = await supabase.storage
    .from('sovare-comprobantes')
    .createSignedUrl(path, 600);

  if (error) {
    console.error('[getReceiptUrl] no se pudo firmar la URL:', error);
    return null;
  }
  return data?.signedUrl || null;
}

export async function getOnboardingFileUrl(path: string): Promise<string | null> {
  if (!(await requireAdmin())) return null;

  const supabase = await createServerClient();
  const { data } = await supabase.storage.from('sovare-altas').createSignedUrl(path, 600);
  return data?.signedUrl || null;
}

const ONBOARDING_LABELS: Record<string, string> = {
  legal_name: 'Nombre del negocio',
  display_name: 'Cómo se lee en la tienda',
  industry: 'Rubro',
  city: 'Ciudad',
  address: 'Dirección',
  palette: 'Colores',
  typography: 'Tipografía',
  brand_notes: 'Notas de marca',
  public_phone: 'Teléfono público',
  public_email: 'Email público',
  instagram: 'Instagram',
  delivery: 'Envíos',
  delivery_zones: 'Zonas y costo',
  pickup_hours: 'Horarios de retiro',
  advance_notice: 'Anticipación',
  catalog_size: 'Tamaño del catálogo',
  uses_recipes: 'Recetas',
  domain: 'Dominio',
  team: 'Equipo',
  extra: 'Comentarios',
};

function buildNotes(signup: Record<string, unknown>): string {
  const lines = [`Viene de la contratación del ${formatDate(String(signup.created_at))}.`];

  const onboarding = signup.onboarding as Record<string, string | null> | null;
  if (onboarding) {
    lines.push('', 'Respuestas del alta:');
    for (const [key, label] of Object.entries(ONBOARDING_LABELS)) {
      const value = onboarding[key];
      if (value) lines.push(`· ${label}: ${value}`);
    }
    if (onboarding.logo_path) lines.push('· Subió logo.');
  }

  return lines.join('\n');
}

function formatDate(value: string): string {
  return new Intl.DateTimeFormat('es-AR', { dateStyle: 'medium' }).format(new Date(value));
}
