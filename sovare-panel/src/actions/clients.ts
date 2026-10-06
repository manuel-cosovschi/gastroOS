'use server';

import { revalidatePath } from 'next/cache';
import { createServerClient, requireAdmin } from '@/lib/supabase/server';
import { monthStart, todayISO } from '@/lib/utils';
import type { ClientStatus } from '@/types';

/**
 * Escrituras del panel.
 *
 * Todas empiezan por requireAdmin(). RLS ya rechazaría a cualquier otro, pero
 * el error que devuelve Postgres no sirve para mostrarle nada al usuario, y
 * chequearlo acá deja el mensaje en castellano y el código legible.
 */

type Result = { success: boolean; error?: string; id?: string };

const DENIED: Result = { success: false, error: 'No tenés permiso.' };

/** Campos que el formulario puede tocar. El resto los maneja la base. */
const TEXT_FIELDS = [
  'business_name',
  'contact_name',
  'whatsapp',
  'email',
  'industry',
  'city',
  'source',
  'panel_url',
  'storefront_url',
  'supabase_ref',
  'vercel_project',
  'repo_url',
  'plan',
  'notes',
  'outreach_message',
  'outreach_subject',
  'source_url',
] as const;

const DATE_FIELDS = ['first_contact_at', 'started_at', 'churned_at'] as const;
const NUMBER_FIELDS = ['monthly_amount', 'setup_amount', 'billing_day'] as const;

function readForm(formData: FormData) {
  const payload: Record<string, unknown> = {};

  for (const field of TEXT_FIELDS) {
    const value = (formData.get(field) as string | null)?.trim();
    // Cadena vacía a NULL: así "sin dato" es un solo valor y no dos que se
    // comportan distinto al filtrar o al mostrar.
    payload[field] = value ? value : null;
  }
  for (const field of DATE_FIELDS) {
    const value = (formData.get(field) as string | null)?.trim();
    payload[field] = value ? value : null;
  }
  for (const field of NUMBER_FIELDS) {
    const value = (formData.get(field) as string | null)?.trim();
    payload[field] = value ? Number(value) : null;
  }

  payload.status = (formData.get('status') as ClientStatus) || 'prospecto';
  payload.currency = ((formData.get('currency') as string) || 'ARS').trim() || 'ARS';

  return payload;
}

export async function createClientRecord(formData: FormData): Promise<Result> {
  if (!(await requireAdmin())) return DENIED;

  const payload = readForm(formData);
  if (!payload.business_name) return { success: false, error: 'El nombre del negocio es obligatorio.' };
  if (!payload.first_contact_at) payload.first_contact_at = todayISO();

  const supabase = await createServerClient();
  const { data, error } = await supabase.from('clients').insert(payload).select('id').single();

  if (error) return { success: false, error: 'No se pudo crear el cliente.' };

  revalidatePath('/');
  revalidatePath('/clientes');
  return { success: true, id: data.id };
}

export async function updateClientRecord(id: string, formData: FormData): Promise<Result> {
  if (!(await requireAdmin())) return DENIED;

  const payload = readForm(formData);
  if (!payload.business_name) return { success: false, error: 'El nombre del negocio es obligatorio.' };

  const supabase = await createServerClient();
  const { error } = await supabase.from('clients').update(payload).eq('id', id);

  if (error) return { success: false, error: 'No se pudo guardar.' };

  revalidatePath('/');
  revalidatePath('/clientes');
  revalidatePath(`/clientes/${id}`);
  return { success: true, id };
}

export async function setClientStatus(id: string, status: ClientStatus): Promise<Result> {
  if (!(await requireAdmin())) return DENIED;

  const supabase = await createServerClient();

  // Pasar a activo sin fecha de alta deja al cliente sin antigüedad, y pasar a
  // baja sin fecha de baja rompe cualquier cuenta de permanencia. Se completan
  // solas con hoy, que es lo que el usuario haría a mano un segundo después.
  const patch: Record<string, unknown> = { status };
  const today = todayISO();

  const { data: current } = await supabase
    .from('clients')
    .select('started_at, churned_at')
    .eq('id', id)
    .maybeSingle();

  if (status === 'activo' && !current?.started_at) patch.started_at = today;
  if (status === 'baja' && !current?.churned_at) patch.churned_at = today;
  if (status !== 'baja') patch.churned_at = null;

  const { error } = await supabase.from('clients').update(patch).eq('id', id);
  if (error) return { success: false, error: 'No se pudo cambiar el estado.' };

  revalidatePath('/');
  revalidatePath('/clientes');
  revalidatePath(`/clientes/${id}`);
  return { success: true, id };
}

export async function deleteClientRecord(id: string): Promise<Result> {
  if (!(await requireAdmin())) return DENIED;

  const supabase = await createServerClient();
  const { error } = await supabase.from('clients').delete().eq('id', id);
  if (error) return { success: false, error: 'No se pudo eliminar.' };

  revalidatePath('/');
  revalidatePath('/clientes');
  return { success: true };
}

/**
 * Genera los cobros del mes para los clientes activos.
 *
 * Es idempotente: la clave única (cliente, período, concepto) hace que correrlo
 * dos veces no duplique nada, así que se puede tocar el botón sin miedo.
 */
export async function generateMonthlyCharges(period?: string): Promise<Result & { created?: number }> {
  if (!(await requireAdmin())) return DENIED;

  const supabase = await createServerClient();
  const target = period || monthStart();

  const { data: clients, error } = await supabase
    .from('clients')
    .select('id, monthly_amount, currency, billing_day')
    .eq('status', 'activo')
    .not('monthly_amount', 'is', null);

  if (error) return { success: false, error: 'No se pudo leer la lista de clientes.' };
  if (!clients?.length) return { success: true, created: 0 };

  const { data: existing } = await supabase
    .from('payments')
    .select('client_id')
    .eq('period', target)
    .eq('concept', 'Mensualidad');

  const alreadyCharged = new Set((existing ?? []).map((row) => row.client_id));
  const pending = clients.filter((client) => !alreadyCharged.has(client.id));
  if (!pending.length) return { success: true, created: 0 };

  const rows = pending.map((client) => {
    const day = Math.min(client.billing_day ?? 10, 28);
    const dueDate = `${target.slice(0, 8)}${String(day).padStart(2, '0')}`;
    return {
      client_id: client.id,
      period: target,
      concept: 'Mensualidad',
      amount: client.monthly_amount,
      currency: client.currency || 'ARS',
      due_date: dueDate,
      status: 'pendiente',
    };
  });

  const { error: insertError } = await supabase.from('payments').insert(rows);
  if (insertError) return { success: false, error: 'No se pudieron generar los cobros.' };

  revalidatePath('/');
  revalidatePath('/cobros');
  return { success: true, created: rows.length };
}
