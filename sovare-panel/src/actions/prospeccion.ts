'use server';

import { revalidatePath } from 'next/cache';
import { createServerClient, requireAdmin } from '@/lib/supabase/server';

/**
 * Escrituras de la pantalla de prospección.
 */

type Result = { success: boolean; error?: string };

const DENIED: Result = { success: false, error: 'No tenés permiso.' };

/**
 * Deja constancia de que a este prospecto ya le escribimos.
 *
 * Se llama desde el click del botón de WhatsApp, en paralelo con la apertura del
 * chat. Si falla, el mensaje igual se manda: lo único que se pierde es la marca,
 * y por eso el error se registra y no se le muestra a nadie — cortar el flujo
 * por una columna de seguimiento sería peor que el problema.
 *
 * No sobreescribe una marca anterior. "Cuándo le escribí por primera vez" es el
 * dato que sirve para saber a quién hay que volver a buscar; si cada reapertura
 * del chat lo moviera a hoy, ningún prospecto se vería nunca como viejo.
 */
export async function marcarContactado(id: string): Promise<Result> {
  if (!(await requireAdmin())) return DENIED;
  const supabase = await createServerClient();

  const { error } = await supabase
    .from('clients')
    .update({ contacted_at: new Date().toISOString() })
    .eq('id', id)
    .is('contacted_at', null);

  if (error) {
    console.error('[marcarContactado] no se pudo registrar el contacto:', error);
    return { success: false, error: 'No se pudo registrar el contacto.' };
  }

  revalidatePath('/prospeccion');
  revalidatePath(`/clientes/${id}`);
  return { success: true };
}

/** Volver a poner un prospecto en la lista de pendientes. */
export async function desmarcarContactado(id: string): Promise<Result> {
  if (!(await requireAdmin())) return DENIED;
  const supabase = await createServerClient();

  const { error } = await supabase.from('clients').update({ contacted_at: null }).eq('id', id);
  if (error) return { success: false, error: 'No se pudo deshacer.' };

  revalidatePath('/prospeccion');
  revalidatePath(`/clientes/${id}`);
  return { success: true };
}

/** Corregir el mensaje de un prospecto desde el panel, sin tocar un deploy. */
export async function guardarMensaje(id: string, mensaje: string): Promise<Result> {
  if (!(await requireAdmin())) return DENIED;
  const supabase = await createServerClient();

  const limpio = mensaje.trim();
  const { error } = await supabase
    .from('clients')
    .update({ outreach_message: limpio || null })
    .eq('id', id);

  if (error) return { success: false, error: 'No se pudo guardar el mensaje.' };

  revalidatePath('/prospeccion');
  revalidatePath(`/clientes/${id}`);
  return { success: true };
}
