import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { cargarProspectos } from '@/lib/prospectos';

/**
 * Por dónde entran los prospectos que junta la tarea diaria.
 *
 * Dos formas de identificarse, porque son dos usos del mismo trabajo:
 *
 *   - `PROSPECCION_TOKEN`, que es como entra la tarea. Corre sola a la mañana y
 *     no hay nadie que ponga una contraseña.
 *   - La sesión de un administrador, que es como entra el panel cuando Manuel
 *     pega una lista a mano. Es la misma autenticación que usa el resto del
 *     panel.
 *
 * Por qué una llave guardada es aceptable acá, cuando para el resto no lo sería:
 * esta puerta hace una sola cosa, y es insertar prospectos. No lee la base, no
 * modifica ni borra nada, el estado lo fija el código y hay un tope por día.
 * Si la llave se filtrara, lo peor que puede pasar es encontrar unas filas de
 * más en una lista de prospección. No se expone un dato de nadie ni se toca un
 * peso. Para rotarla alcanza con cambiar la variable en Vercel y el texto de la
 * tarea.
 *
 * Lo que devuelve son números y los nombres que vinieron en el pedido. Nunca
 * dice quién más está cargado, así que tampoco sirve para averiguar nada.
 */

export const dynamic = 'force-dynamic';
export const maxDuration = 30;

function json(body: Record<string, unknown>, status = 200) {
  return NextResponse.json(body, { status, headers: { 'Cache-Control': 'no-store' } });
}

/** La llave de la tarea, comparada en tiempo constante. */
function tokenValido(recibido: string): boolean {
  const esperado = process.env.PROSPECCION_TOKEN;
  if (!esperado || esperado.length < 24) return false;
  if (recibido.length !== esperado.length) return false;

  // Sin salir en la primera diferencia: una comparación que corta antes filtra,
  // por lo que tarda, cuántos caracteres del principio son correctos.
  let diferencias = 0;
  for (let i = 0; i < esperado.length; i += 1) {
    diferencias |= recibido.charCodeAt(i) ^ esperado.charCodeAt(i);
  }
  return diferencias === 0;
}

/** ¿El portador es un administrador de SOVARE? */
async function esAdmin(jwt: string): Promise<boolean> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anon) return false;

  const client = createClient(url, anon, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { headers: { Authorization: `Bearer ${jwt}` } },
    db: { schema: 'sovare' },
  });

  const {
    data: { user },
    error,
  } = await client.auth.getUser(jwt);
  if (error || !user) return false;

  // Con el token del usuario, RLS ya sólo deja ver la lista a los administradores.
  const { data } = await client.from('admins').select('user_id').eq('user_id', user.id).maybeSingle();
  return Boolean(data);
}

export async function POST(request: Request) {
  const portador = /^Bearer\s+(\S+)$/i.exec(request.headers.get('authorization') || '')?.[1];
  if (!portador) return json({ ok: false, message: 'No autorizado.' }, 401);

  if (!tokenValido(portador) && !(await esAdmin(portador))) {
    return json({ ok: false, message: 'No autorizado.' }, 401);
  }

  let cuerpo: unknown;
  try {
    cuerpo = await request.json();
  } catch {
    return json({ ok: false, message: 'El cuerpo no es JSON.' }, 400);
  }

  // Se acepta la lista pelada, `{ prospectos: [...] }`, o el mensaje entero de
  // la tarea en `{ texto: "..." }`, del que se extrae el bloque.
  const entrada = Array.isArray(cuerpo)
    ? cuerpo
    : ((cuerpo as { prospectos?: unknown[]; texto?: string })?.prospectos ??
      (cuerpo as { texto?: string })?.texto);

  if (!Array.isArray(entrada) && typeof entrada !== 'string') {
    return json({ ok: false, message: 'Mandá una lista de prospectos o el texto que la contiene.' }, 400);
  }

  try {
    const resultado = await cargarProspectos(entrada);
    return json({ ...resultado }, resultado.ok ? 200 : 400);
  } catch (error) {
    console.error('[api/interno/prospectos] falló:', error);
    return json({ ok: false, message: 'Algo falló del lado de la landing.' }, 500);
  }
}
