import { createSovareClient } from '@/lib/supabase/service';

/**
 * Cargar prospectos nuevos en la lista de prospección de SOVARE.
 *
 * Esto lo usa la tarea diaria de prospección, que corre sola y no tiene otra
 * forma de escribir en la base: una rutina de Claude arranca una sesión nueva
 * cada día y esa sesión no hereda ningún conector. La alternativa era que
 * entregara los prospectos escritos para pegarlos a mano, que funciona pero le
 * deja a una persona un trabajo que no tiene por qué hacer.
 *
 * Lo que entra acá viene de afuera y no se le cree nada:
 *
 *   - El estado es siempre `prospecto`, fijo en el código. No sale del pedido,
 *     así que por esta puerta no se puede crear un cliente activo ni tocar uno.
 *   - Sólo se insertan filas nuevas. No hay forma de modificar ni de borrar lo
 *     que ya está.
 *   - Hay un tope diario. Si la tarea se descontrola o la llave se filtra, lo
 *     peor que puede pasar es un puñado de filas de más en una lista, y deja de
 *     entrar nada hasta el día siguiente.
 *   - La respuesta sólo repite nombres que vinieron en el pedido. Nunca dice
 *     quién más está cargado, así que no sirve para averiguar nada.
 */

/** Cuántos puede cargar en un día, entre todas las llamadas. */
const TOPE_DIARIO = 25;

/** Y cuántos en una sola llamada. */
const TOPE_POR_LLAMADA = 50;

export interface ResultadoCarga {
  ok: boolean;
  message?: string;
  cargados: number;
  repetidos: string[];
  rechazados: { nombre: string; motivo: string }[];
}

interface FilaEntrante {
  business_name?: unknown;
  nombre?: unknown;
  city?: unknown;
  ciudad?: unknown;
  industry?: unknown;
  rubro?: unknown;
  contact_name?: unknown;
  whatsapp?: unknown;
  telefono?: unknown;
  source?: unknown;
  origen?: unknown;
  source_url?: unknown;
  link?: unknown;
  outreach_message?: unknown;
  mensaje?: unknown;
  notes?: unknown;
  notas?: unknown;
}

function fallo(message: string): ResultadoCarga {
  return { ok: false, message, cargados: 0, repetidos: [], rechazados: [] };
}

export async function cargarProspectos(entrada: string | unknown[]): Promise<ResultadoCarga> {
  const sovare = createSovareClient();
  if (!sovare) return fallo('Falta configurar la clave de servicio.');

  const filas = typeof entrada === 'string' ? leerBloque(entrada) : normalizarLista(entrada);
  if (!filas) {
    return fallo('No encontré prospectos. Esperaba una lista con el nombre de cada negocio.');
  }
  if (filas.length === 0) return fallo('La lista vino vacía.');
  if (filas.length > TOPE_POR_LLAMADA) {
    return fallo(`Son demasiados de una vez: hasta ${TOPE_POR_LLAMADA}.`);
  }

  // Lo de hoy, para el tope diario. La fecha es la de Argentina, como todo el
  // resto: con la del servidor, el tope se reiniciaría a las 21.
  const hoy = diaEnArgentina();
  const { count: hoyYaCargados } = await sovare
    .from('clients')
    .select('id', { count: 'exact', head: true })
    .eq('status', 'prospecto')
    .gte('created_at', `${hoy}T00:00:00-03:00`);

  const margen = TOPE_DIARIO - (hoyYaCargados ?? 0);
  if (margen <= 0) {
    return fallo(`Ya se cargaron ${TOPE_DIARIO} prospectos hoy. Probá mañana.`);
  }

  // Contra qué se compara para no repetir. Se traen todos: son cientos de filas,
  // no millones, y una consulta por prospecto sería peor.
  const { data: existentes, error: errorLectura } = await sovare
    .from('clients')
    .select('business_name, whatsapp, source_url');

  if (errorLectura) {
    console.error('[cargarProspectos] no se pudo leer lo que ya hay:', errorLectura);
    return fallo('No se pudo leer la lista actual.');
  }

  const nombres = new Set(
    (existentes ?? []).map((fila: { business_name: string }) => normalizar(fila.business_name))
  );
  const telefonos = new Set(
    (existentes ?? [])
      .map((fila: { whatsapp: string | null }) => soloDigitos(fila.whatsapp))
      .filter(Boolean)
  );
  const links = new Set(
    (existentes ?? [])
      .map((fila: { source_url: string | null }) => (fila.source_url || '').trim().toLowerCase())
      .filter(Boolean)
  );

  const repetidos: string[] = [];
  const rechazados: { nombre: string; motivo: string }[] = [];
  const aCargar: Record<string, unknown>[] = [];

  for (const fila of filas) {
    const nombre = texto(fila.business_name) || texto(fila.nombre);
    if (!nombre) {
      rechazados.push({ nombre: '(sin nombre)', motivo: 'no trae nombre del negocio' });
      continue;
    }

    if (aCargar.length >= margen) {
      rechazados.push({ nombre, motivo: `se llegó al tope de ${TOPE_DIARIO} por día` });
      continue;
    }

    const whatsapp = soloDigitos(texto(fila.whatsapp) || texto(fila.telefono));
    const link = (texto(fila.source_url) || texto(fila.link)).toLowerCase();

    // Repetido contra lo cargado, y contra lo que vino en este mismo pedido.
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
      city: recortar(texto(fila.city) || texto(fila.ciudad), 120),
      industry: recortar(texto(fila.industry) || texto(fila.rubro), 120),
      contact_name: recortar(texto(fila.contact_name), 120),
      whatsapp: whatsapp || null,
      source: recortar(texto(fila.source) || texto(fila.origen), 160) || 'Prospección automática',
      source_url: recortar(texto(fila.source_url) || texto(fila.link), 500),
      outreach_message: recortar(texto(fila.outreach_message) || texto(fila.mensaje), 2000),
      notes: recortar(texto(fila.notes) || texto(fila.notas), 2000),
      // Fijo, no sale del pedido: por esta puerta sólo entran prospectos.
      status: 'prospecto',
      first_contact_at: hoy,
      // Lo marca el panel cuando Manuel escribe, no la carga.
      contacted_at: null,
    });
  }

  if (aCargar.length > 0) {
    const { error } = await sovare.from('clients').insert(aCargar);
    if (error) {
      console.error('[cargarProspectos] no se pudieron cargar:', error);
      return fallo('No se pudieron cargar los prospectos.');
    }
  }

  return { ok: true, cargados: aCargar.length, repetidos, rechazados };
}

/**
 * Saca la lista de lo que sea que haya llegado.
 *
 * La tarea entrega un bloque JSON, pero puede venir dentro de un mensaje más
 * largo o con las comillas de un ```json. Se busca el primer corchete y se lee
 * hasta el que lo cierra.
 */
function leerBloque(texto_: string): FilaEntrante[] | null {
  const limpio = texto_.replace(/```(?:json)?/gi, '').trim();
  const desde = limpio.indexOf('[');
  const hasta = limpio.lastIndexOf(']');
  if (desde === -1 || hasta <= desde) return null;

  try {
    return normalizarLista(JSON.parse(limpio.slice(desde, hasta + 1)));
  } catch {
    return null;
  }
}

function normalizarLista(valor: unknown): FilaEntrante[] | null {
  if (!Array.isArray(valor)) return null;
  return valor.filter((fila) => fila && typeof fila === 'object') as FilaEntrante[];
}

function texto(valor: unknown): string {
  return typeof valor === 'string' ? valor.trim() : '';
}

function recortar(valor: string, largo: number): string | null {
  return valor ? valor.slice(0, largo) : null;
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

/** Hoy en Argentina. El tope diario se cuenta por el día del negocio. */
function diaEnArgentina(): string {
  const partes = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Argentina/Buenos_Aires',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(new Date());
  const valor = (tipo: string) => partes.find((parte) => parte.type === tipo)?.value ?? '';
  return `${valor('year')}-${valor('month')}-${valor('day')}`;
}
