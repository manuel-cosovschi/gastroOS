import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';

export async function middleware(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet: { name: string; value: string; options?: Record<string, unknown> }[]) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          );
          supabaseResponse = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options as never)
          );
        },
      },
    }
  );

  // getSession() lee el JWT localmente en vez de pegarle a Supabase en cada
  // request: el middleware corre en todas las navegaciones y una llamada HTTP
  // acá se paga en latencia. La verificación real del usuario la hacen los
  // server components y las server actions con getUser().
  const { data: { session } } = await supabase.auth.getSession();

  const { pathname } = request.nextUrl;

  // El panel entero exige sesión
  if (pathname.startsWith('/admin') && !session) {
    const url = request.nextUrl.clone();
    url.pathname = '/login';
    // Volvemos a donde el usuario quería ir después de autenticarse
    url.searchParams.set('next', pathname);
    return NextResponse.redirect(url);
  }

  // Con sesión abierta el login no tiene sentido
  if (pathname === '/login' && session) {
    const url = request.nextUrl.clone();
    url.pathname = '/admin';
    url.search = '';
    return NextResponse.redirect(url);
  }

  return supabaseResponse;
}

export const config = {
  matcher: ['/admin/:path*', '/login'],
};
