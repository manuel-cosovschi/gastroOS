'use server';

import { revalidatePath } from 'next/cache';
import { createServerClient, requireAdmin } from '@/lib/supabase/server';
import { callLanding } from '@/lib/landing';

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

/**
 * Cargar de una vez los prospectos que dejó escritos la tarea diaria.
 *
 * El trabajo de verdad —leer el bloque, descartar repetidos, normalizar los
 * teléfonos, insertar— vive en la landing, en `/api/interno/prospectos`. Acá no
 * se repite: es la misma puerta por la que entra la tarea diaria cuando corre
 * sola a la mañana, y tener dos implementaciones de la misma regla es tener dos
 * lugares donde se puede arreglar una y olvidar la otra.
 *
 * El panel se identifica con la sesión del administrador que está mirando la
 * pantalla; la tarea, con su propia llave. La puerta acepta las dos.
 */
export async function importarProspectos(texto: string): Promise<
  Result & {
    cargados?: number;
    repetidos?: string[];
    rechazados?: { nombre: string; motivo: string }[];
  }
> {
  if (!(await requireAdmin())) return DENIED;

  const reply = await callLanding<{
    ok: boolean;
    message?: string;
    cargados: number;
    repetidos: string[];
    rechazados: { nombre: string; motivo: string }[];
  }>({ texto }, '/api/interno/prospectos');

  if (!reply.ok) return { success: false, error: reply.error };
  if (!reply.data.ok) return { success: false, error: reply.data.message || 'No se pudo cargar.' };

  revalidatePath('/prospeccion');
  revalidatePath('/clientes');
  return {
    success: true,
    cargados: reply.data.cargados,
    repetidos: reply.data.repetidos,
    rechazados: reply.data.rechazados,
  };
}

/**
 * Sacar un prospecto de la lista.
 *
 * Hace falta desde que la tarea diaria carga sola: si alguna vez mete un negocio
 * que no corresponde —un restaurante, uno que cerró, un duplicado que se le
 * escapó— tiene que haber forma de sacarlo sin entrar a la base a mano.
 *
 * Las guardas son estrictas a propósito, porque borrar un cliente es más
 * destructivo de lo que parece: `payments` y `activities` cuelgan de él con
 * ON DELETE CASCADE, así que borrar una ficha se lleva puesto su historial de
 * cobros. Por eso esto sólo toca una fila que cumpla las cuatro cosas:
 *
 *   - está en estado `prospecto` (la condición viaja en el propio UPDATE, no se
 *     mira antes: entre mirar y borrar alguien puede haberlo convertido),
 *   - no tiene ningún cobro,
 *   - no salió de la venta de un vendedor,
 *   - no tiene una contratación asociada.
 *
 * Si alguna falla, no borra y lo dice. Un prospecto de verdad no tiene nada de
 * eso; si lo tiene, dejó de ser un prospecto y la respuesta correcta es no
 * tocarlo.
 */
export async function descartarProspecto(id: string): Promise<Result> {
  if (!(await requireAdmin())) return DENIED;
  const supabase = await createServerClient();

  const [cobros, ventas, contrataciones] = await Promise.all([
    supabase.from('payments').select('id', { count: 'exact', head: true }).eq('client_id', id),
    supabase.from('vendor_sales').select('id', { count: 'exact', head: true }).eq('client_id', id),
    supabase.from('signups').select('id', { count: 'exact', head: true }).eq('client_id', id),
  ]);

  if (cobros.error || ventas.error || contrataciones.error) {
    console.error('[descartarProspecto] no se pudo revisar qué cuelga de la ficha:', {
      cobros: cobros.error,
      ventas: ventas.error,
      contrataciones: contrataciones.error,
    });
    return { success: false, error: 'No se pudo verificar la ficha. No se borró nada.' };
  }

  if (cobros.count) return { success: false, error: 'Tiene cobros cargados. No se borra desde acá.' };
  if (ventas.count) return { success: false, error: 'Vino de la venta de un vendedor. No se borra desde acá.' };
  if (contrataciones.count) {
    return { success: false, error: 'Tiene una contratación asociada. No se borra desde acá.' };
  }

  const { data, error } = await supabase
    .from('clients')
    .delete()
    .eq('id', id)
    .eq('status', 'prospecto')
    .select('id');

  if (error) {
    console.error('[descartarProspecto] no se pudo borrar:', error);
    return { success: false, error: 'No se pudo borrar.' };
  }
  if (!data?.length) {
    return { success: false, error: 'Ya no es un prospecto. No se borró nada.' };
  }

  revalidatePath('/prospeccion');
  revalidatePath('/clientes');
  return { success: true };
}
