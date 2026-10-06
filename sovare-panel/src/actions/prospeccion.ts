'use server';

import { revalidatePath } from 'next/cache';
import { createServerClient, requireAdmin } from '@/lib/supabase/server';
import { todayISO } from '@/lib/utils';

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
 * La tarea corre sin acceso a la base —una rutina arranca una sesión nueva cada
 * día y esa sesión no hereda los conectores, así que no tiene cómo escribir—, y
 * por eso termina entregando los prospectos en su mensaje. Esto es el otro lado:
 * se pega ese bloque acá y entran.
 *
 * Entran con la sesión del administrador que está mirando la pantalla, que es lo
 * que evita el camino obvio y peor: darle a la tarea una clave de la base
 * guardada en el texto de la rutina. Esa clave viviría en claro dentro de un
 * trabajo programado que corre solo todos los días, sin vencimiento y sin que
 * nadie la mire. Un campo de texto en una pantalla con sesión no tiene nada de
 * eso.
 *
 * No lanza por una fila mala: carga las que sirven y devuelve el detalle de las
 * que no, con el motivo. Media docena de prospectos donde uno vino sin teléfono
 * no es razón para perder los otros cinco.
 */
export async function importarProspectos(texto: string): Promise<
  Result & {
    cargados?: number;
    repetidos?: string[];
    rechazados?: { nombre: string; motivo: string }[];
  }
> {
  if (!(await requireAdmin())) return DENIED;

  const filas = leerBloque(texto);
  if (!filas) {
    return {
      success: false,
      error:
        'No encontré prospectos en lo que pegaste. Tiene que ser el bloque JSON que deja la tarea diaria.',
    };
  }
  if (filas.length === 0) return { success: false, error: 'El bloque vino vacío.' };
  if (filas.length > 50) {
    return { success: false, error: 'Son demasiados de una vez. Pegá hasta 50.' };
  }

  const supabase = await createServerClient();

  // Contra qué se compara para no repetir. Se traen todos: la tabla es de
  // cientos de filas, no de millones, y pedirle a la base una consulta por
  // prospecto sería peor.
  const { data: existentes, error: errorLectura } = await supabase
    .from('clients')
    .select('business_name, whatsapp, source_url');

  if (errorLectura) {
    console.error('[importarProspectos] no se pudo leer lo que ya hay:', errorLectura);
    return { success: false, error: 'No se pudo leer la lista actual.' };
  }

  const nombres = new Set((existentes ?? []).map((row) => normalizar(row.business_name)));
  const telefonos = new Set(
    (existentes ?? []).map((row) => soloDigitos(row.whatsapp)).filter(Boolean)
  );
  const links = new Set(
    (existentes ?? []).map((row) => (row.source_url || '').trim().toLowerCase()).filter(Boolean)
  );

  const repetidos: string[] = [];
  const rechazados: { nombre: string; motivo: string }[] = [];
  const aCargar: Record<string, unknown>[] = [];
  const hoy = todayISO();

  for (const fila of filas) {
    const nombre = texto_(fila.business_name) || texto_(fila.nombre);
    if (!nombre) {
      rechazados.push({ nombre: '(sin nombre)', motivo: 'no trae nombre del negocio' });
      continue;
    }

    const whatsapp = soloDigitos(texto_(fila.whatsapp) || texto_(fila.telefono));
    const link = (texto_(fila.source_url) || texto_(fila.link) || '').toLowerCase();

    // Repetido contra lo que ya está, y contra lo que vino en este mismo pegado.
    const clave = normalizar(nombre);
    if (nombres.has(clave) || (whatsapp && telefonos.has(whatsapp)) || (link && links.has(link))) {
      repetidos.push(nombre);
      continue;
    }
    nombres.add(clave);
    if (whatsapp) telefonos.add(whatsapp);
    if (link) links.add(link);

    aCargar.push({
      business_name: nombre.slice(0, 160),
      city: texto_(fila.city) || texto_(fila.ciudad) || null,
      industry: texto_(fila.industry) || texto_(fila.rubro) || null,
      contact_name: texto_(fila.contact_name) || null,
      whatsapp: whatsapp || null,
      source: texto_(fila.source) || texto_(fila.origen) || 'Prospección automática',
      source_url: texto_(fila.source_url) || texto_(fila.link) || null,
      outreach_message: texto_(fila.outreach_message) || texto_(fila.mensaje) || null,
      notes: texto_(fila.notes) || texto_(fila.notas) || null,
      status: 'prospecto',
      first_contact_at: hoy,
      // Se marca cuando Manuel escribe desde el panel, no al cargarlo.
      contacted_at: null,
    });
  }

  if (aCargar.length > 0) {
    const { error } = await supabase.from('clients').insert(aCargar);
    if (error) {
      console.error('[importarProspectos] no se pudieron cargar:', error);
      return { success: false, error: 'No se pudieron cargar los prospectos.' };
    }
  }

  revalidatePath('/prospeccion');
  revalidatePath('/clientes');
  return {
    success: true,
    cargados: aCargar.length,
    repetidos,
    rechazados,
  };
}

/**
 * Saca la lista de prospectos de lo que sea que hayan pegado.
 *
 * La tarea entrega un bloque JSON, pero lo pega una persona desde un mensaje más
 * largo, así que puede venir con texto alrededor, con las comillas de un ```json,
 * o solo. Se busca el primer corchete y se lee hasta el que lo cierra.
 */
function leerBloque(texto: string): Record<string, unknown>[] | null {
  const limpio = texto.replace(/```(?:json)?/gi, '').trim();
  const desde = limpio.indexOf('[');
  const hasta = limpio.lastIndexOf(']');
  if (desde === -1 || hasta <= desde) return null;

  try {
    const leido = JSON.parse(limpio.slice(desde, hasta + 1));
    if (!Array.isArray(leido)) return null;
    return leido.filter((fila) => fila && typeof fila === 'object');
  } catch {
    return null;
  }
}

function texto_(valor: unknown): string {
  return typeof valor === 'string' ? valor.trim() : '';
}

/** Para comparar nombres: sin tildes, sin puntuación, sin dobles espacios. */
function normalizar(valor: string): string {
  return valor
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * El teléfono como lo guarda el panel: diez dígitos, sin 0 y sin 15.
 *
 * El mismo número se escribe de muchas formas y todas tienen que chocar entre
 * sí, o el mismo negocio entra dos veces. Se sacan, en este orden, las cuatro
 * cosas que le cuelgan a un número argentino:
 *
 *   2235385143          ya está
 *   +54 9 223 538-5143  el país y el 9 del móvil internacional
 *   0223 15 538-5143    el 0 de larga distancia y el 15
 *   54 223 15 5385143   las dos cosas mezcladas
 *
 * El 9 se saca sólo si lo que queda detrás son exactamente diez dígitos: así un
 * número que de verdad empieza con 9 no se come su primer dígito.
 */
function soloDigitos(valor: string | null): string {
  let digitos = (valor || '').replace(/\D/g, '');
  if (!digitos) return '';
  digitos = digitos.replace(/^54/, '');
  digitos = digitos.replace(/^9(?=\d{10}$)/, '');
  digitos = digitos.replace(/^0/, '');
  return digitos.replace(/^(\d{2,4})15/, '$1');
}
