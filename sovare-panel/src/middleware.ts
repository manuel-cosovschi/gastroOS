import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';

/**
 * El panel entero exige sesión. La verificación de que además sea admin la
 * hace cada pantalla con requireAdmin(): acá sólo se mira que haya sesión,
 * porque el middleware corre en cada navegación y no conviene pegarle a la
 * base para eso.
 */
export async function middleware(request: NextRequest) {
  let response = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet: { name: string; value: string; options?: Record<string, unknown> }[]) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          response = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options as never)
          );
        },
      },
    }
  );

  const {
    data: { session },
  } = await supabase.auth.getSession();

  const { pathname } = request.nextUrl;

  if (pathname !== '/login' && !session) {
    const url = request.nextUrl.clone();
    url.pathname = '/login';
    url.searchParams.set('next', pathname);
    return NextResponse.redirect(url);
  }

  if (pathname === '/login' && session) {
    const url = request.nextUrl.clone();
    url.pathname = '/';
    url.search = '';
    return NextResponse.redirect(url);
  }

  return response;
}

/**
 * Todo menos los archivos estáticos.
 *
 * La lista anterior nombraba `icon.svg` y `favicon.ico` uno por uno, así que
 * cualquier otro archivo de `public/` caía en el middleware: el pedido del
 * logo no traía sesión, lo mandaba a `/login` y el navegador recibía HTML
 * donde esperaba una imagen. De ahí el cuadradito roto arriba del formulario.
 *
 * Ahora se excluye por extensión, que es lo que hay que excluir: un archivo
 * estático nunca necesita pasar por la puerta.
 */
export const config = {
  matcher: [
    '/((?!_next/static|_next/image|.*\\.(?:svg|png|jpg|jpeg|gif|webp|avif|ico|woff2?|txt|xml|webmanifest)$).*)',
  ],
};
