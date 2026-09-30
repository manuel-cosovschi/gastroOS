'use server';

import { redirect } from 'next/navigation';
import { createServerClient } from '@/lib/supabase/server';
import { DEMO_EMAIL, DEMO_MODE } from '@/lib/constants';

/**
 * Entrada libre a la demo.
 *
 * La sesión se abre del lado del servidor a propósito: la contraseña sale de
 * `DEMO_PASSWORD`, que nunca viaja al navegador. Poner la clave en el bundle
 * con un `NEXT_PUBLIC_` sería más corto y quedaría publicada para siempre en
 * el código de la página; acá el visitante toca un botón y entra, sin
 * enterarse de que existe una contraseña.
 *
 * Es deliberado que cualquiera pueda entrar. Es una demo con datos de ejemplo
 * y su razón de ser es que alguien la pruebe sin pedir permiso: ponerle una
 * barrera a la única pantalla que sirve para convencer no tiene sentido.
 */
export async function enterDemo(): Promise<{ error: string } | never> {
  if (!DEMO_MODE) {
    return { error: 'La demo no está disponible.' };
  }

  const password = process.env.DEMO_PASSWORD;
  if (!password) {
    console.error('[enterDemo] falta DEMO_PASSWORD: la demo no puede abrir sesión sola.');
    return { error: 'La demo no está disponible en este momento.' };
  }

  const supabase = await createServerClient();
  const { error } = await supabase.auth.signInWithPassword({
    email: DEMO_EMAIL,
    password,
  });

  if (error) {
    console.error('[enterDemo] no se pudo iniciar sesión en la demo:', error.message);
    return { error: 'No pudimos abrir la demo. Probá de nuevo en un momento.' };
  }

  // Fuera del try/catch de arriba: `redirect` funciona lanzando, y atraparlo
  // haría que la redirección no ocurra.
  redirect('/admin');
}
