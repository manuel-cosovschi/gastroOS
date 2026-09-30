import { NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase/server';

/**
 * Cerrar sesión desde el servidor.
 *
 * Existe por un caso muy concreto: una demo que venció y se limpió mientras la
 * cookie de la persona seguía viva. Esa sesión es válida para Supabase pero ya
 * no tiene ningún negocio detrás, y el panel no tiene nada que mostrarle.
 *
 * Mandarlo a `/login` sin más no alcanza: el middleware ve una sesión abierta
 * y lo devuelve a `/admin`, que lo devuelve a `/login`, para siempre. Hay que
 * borrar la cookie primero, y eso un Server Component no lo puede hacer — un
 * route handler sí.
 */
export async function GET(request: Request) {
  const supabase = await createServerClient();
  await supabase.auth.signOut();

  return NextResponse.redirect(new URL('/login', request.url));
}
