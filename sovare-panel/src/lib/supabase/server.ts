import { createServerClient as createSSRClient } from '@supabase/ssr';
import { cookies } from 'next/headers';

/**
 * Cliente de Supabase para el panel.
 *
 * Apunta al esquema `sovare`, no a `public`: este proyecto de Supabase también
 * hospeda la demo de GastroOS, y las tablas del producto no tienen nada que
 * hacer acá. El aislamiento real lo da RLS —`sovare.is_admin()`—, no el
 * esquema; esto es sólo para no tener que escribir el prefijo en cada consulta.
 */
export async function createServerClient() {
  const cookieStore = await cookies();

  return createSSRClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      db: { schema: 'sovare' },
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet: { name: string; value: string; options?: Record<string, unknown> }[]) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options as never)
            );
          } catch {
            // Server Component: no se pueden escribir cookies desde acá.
          }
        },
      },
    }
  );
}

/**
 * Corta el paso a cualquiera que no esté en `sovare.admins`.
 *
 * RLS ya devuelve vacío para el resto, pero un panel que muestra cero clientes
 * y cero pesos en vez de negar la entrada es peor: parece que se borró todo.
 */
export async function requireAdmin() {
  const supabase = await createServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return null;

  const { data } = await supabase.from('admins').select('email').eq('user_id', user.id).maybeSingle();
  return data ? { id: user.id, email: data.email } : null;
}
