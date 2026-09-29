'use server';

import { revalidatePath } from 'next/cache';
import { createServerClient, requireAdmin } from '@/lib/supabase/server';

type Result = { success: boolean; error?: string };

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

  revalidatePath('/contrataciones');
  revalidatePath(`/contrataciones/${id}`);
  return { success: true };
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

  const { data: client, error: insertError } = await supabase
    .from('clients')
    .insert({
      business_name: signup.business_name,
      contact_name: signup.contact_name,
      whatsapp: signup.whatsapp,
      email: signup.email,
      industry: signup.industry,
      city: signup.city,
      status: 'implementacion',
      source: 'Contratación desde la página',
      started_at: new Date().toISOString().slice(0, 10),
      plan: plan?.label || signup.plan,
      monthly_amount: plan?.monthly ?? null,
      setup_amount: plan?.setup ?? null,
      currency: signup.currency,
      notes: buildNotes(signup),
    })
    .select('id')
    .single();

  if (insertError || !client) {
    console.error('[convertSignupToClient] no se pudo crear el cliente:', insertError);
    return { success: false, error: 'No se pudo crear el cliente.' };
  }

  await supabase.from('signups').update({ client_id: client.id }).eq('id', id);

  revalidatePath('/contrataciones');
  revalidatePath(`/contrataciones/${id}`);
  revalidatePath('/clientes');
  return { success: true, clientId: client.id };
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
