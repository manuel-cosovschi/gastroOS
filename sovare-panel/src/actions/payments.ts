'use server';

import { revalidatePath } from 'next/cache';
import { createServerClient, requireAdmin } from '@/lib/supabase/server';
import { todayISO } from '@/lib/utils';
import type { PaymentStatus } from '@/types';

type Result = { success: boolean; error?: string };

const DENIED: Result = { success: false, error: 'No tenés permiso.' };

export async function createPayment(formData: FormData): Promise<Result> {
  if (!(await requireAdmin())) return DENIED;

  const clientId = formData.get('client_id') as string;
  const period = (formData.get('period') as string)?.trim();
  const amount = Number(formData.get('amount'));
  const dueDate = (formData.get('due_date') as string)?.trim();

  if (!clientId || !period || !dueDate) return { success: false, error: 'Faltan datos del cobro.' };
  if (!Number.isFinite(amount) || amount < 0) return { success: false, error: 'El importe no es válido.' };

  const supabase = await createServerClient();
  const { error } = await supabase.from('payments').insert({
    client_id: clientId,
    // El período se guarda siempre como el primer día del mes: así dos cobros
    // del mismo mes cargados en días distintos caen en el mismo período.
    period: `${period.slice(0, 8)}01`,
    concept: ((formData.get('concept') as string) || 'Mensualidad').trim(),
    amount,
    currency: ((formData.get('currency') as string) || 'ARS').trim(),
    due_date: dueDate,
    status: (formData.get('status') as PaymentStatus) || 'pendiente',
    method: ((formData.get('method') as string) || '').trim() || null,
    notes: ((formData.get('notes') as string) || '').trim() || null,
    paid_at: (formData.get('status') as string) === 'pagado' ? dueDate : null,
  });

  if (error) {
    return {
      success: false,
      error: error.code === '23505' ? 'Ya existe un cobro de ese concepto para ese mes.' : 'No se pudo registrar el cobro.',
    };
  }

  revalidatePath('/');
  revalidatePath('/cobros');
  revalidatePath(`/clientes/${clientId}`);
  return { success: true };
}

export async function markPaid(id: string, clientId: string): Promise<Result> {
  if (!(await requireAdmin())) return DENIED;

  const supabase = await createServerClient();
  const { error } = await supabase
    .from('payments')
    .update({ status: 'pagado', paid_at: todayISO() })
    .eq('id', id);

  if (error) return { success: false, error: 'No se pudo marcar como pagado.' };

  revalidatePath('/');
  revalidatePath('/cobros');
  revalidatePath(`/clientes/${clientId}`);
  return { success: true };
}

export async function setPaymentStatus(
  id: string,
  clientId: string,
  status: PaymentStatus
): Promise<Result> {
  if (!(await requireAdmin())) return DENIED;

  const supabase = await createServerClient();
  const { error } = await supabase
    .from('payments')
    .update({
      status,
      // Sacar el "pagado" tiene que limpiar la fecha, o queda un cobro pendiente
      // con fecha de pago que después nadie entiende.
      paid_at: status === 'pagado' ? todayISO() : null,
    })
    .eq('id', id);

  if (error) return { success: false, error: 'No se pudo cambiar el estado.' };

  revalidatePath('/');
  revalidatePath('/cobros');
  revalidatePath(`/clientes/${clientId}`);
  return { success: true };
}

export async function deletePayment(id: string, clientId: string): Promise<Result> {
  if (!(await requireAdmin())) return DENIED;

  const supabase = await createServerClient();
  const { error } = await supabase.from('payments').delete().eq('id', id);
  if (error) return { success: false, error: 'No se pudo eliminar el cobro.' };

  revalidatePath('/');
  revalidatePath('/cobros');
  revalidatePath(`/clientes/${clientId}`);
  return { success: true };
}

export async function createActivity(formData: FormData): Promise<Result> {
  if (!(await requireAdmin())) return DENIED;

  const clientId = formData.get('client_id') as string;
  const body = (formData.get('body') as string)?.trim();
  if (!clientId || !body) return { success: false, error: 'Escribí algo antes de guardar.' };

  const supabase = await createServerClient();
  const { error } = await supabase.from('activities').insert({
    client_id: clientId,
    happened_at: (formData.get('happened_at') as string) || todayISO(),
    kind: ((formData.get('kind') as string) || 'nota').trim(),
    body,
    next_step: ((formData.get('next_step') as string) || '').trim() || null,
    next_step_at: ((formData.get('next_step_at') as string) || '').trim() || null,
  });

  if (error) return { success: false, error: 'No se pudo guardar la nota.' };

  revalidatePath('/');
  revalidatePath(`/clientes/${clientId}`);
  return { success: true };
}

export async function deleteActivity(id: string, clientId: string): Promise<Result> {
  if (!(await requireAdmin())) return DENIED;

  const supabase = await createServerClient();
  const { error } = await supabase.from('activities').delete().eq('id', id);
  if (error) return { success: false, error: 'No se pudo eliminar la nota.' };

  revalidatePath(`/clientes/${clientId}`);
  return { success: true };
}
