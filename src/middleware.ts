import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';
import { TENANT_HEADER, isOtherRootSubdomain, rootOrigin, tenantFromHost } from '@/lib/tenant';

/**
 * Hace dos cosas, y las dos dependen de a qué host llegó el pedido.
 *
 * 1. En `tunegocio.gastroos.shop` sirve la tienda de ese negocio. El subdominio
 *    se valida y viaja hasta los componentes en la cabecera `x-tenant-slug`.
 *    Esa subdirección sólo muestra la tienda: el panel, el login y el resto del
 *    sitio viven en el dominio principal, así que cualquier otra ruta redirige
 *    allá. Así una sesión nunca queda atada a una tienda y nadie llega al panel
 *    por un subdominio.
 *
 * 2. En el dominio principal, el panel exige sesión y el login no tiene sentido
 *    con una abierta.
 *
 * En los dos casos se borra la cabecera `x-tenant-slug` que venga de afuera: es
 * la que decide qué tienda se lee, y tiene que ser la que puso este archivo.
 */

/** Rutas públicas de la tienda. Lo demás, en un subdominio, no existe. */
const STORE_PREFIXES = ['/catalogo', '/paquetes', '/pedido'];
const STORE_FILES = ['/manifest.webmanifest', '/icon.svg', '/apple-icon.png', '/favicon.ico'];

function isStorePath(pathname: string): boolean {
  if (STORE_FILES.includes(pathname)) return true;
  return STORE_PREFIXES.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`));
}

/** Pasa el pedido con la cabecera del negocio puesta (o ausente) y nada más. */
function forwardedHeaders(request: NextRequest, tenant: string | null): Headers {
  const headers = new Headers(request.headers);
  headers.delete(TENANT_HEADER);
  if (tenant) headers.set(TENANT_HEADER, tenant);
  return headers;
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const tenant = tenantFromHost(request.headers.get('host'));

  // ---------- Un subdominio: sólo la tienda ----------
  if (tenant) {
    if (pathname === '/') {
      // La puerta de entrada de una tienda es su catálogo.
      const url = request.nextUrl.clone();
      url.pathname = '/catalogo';
      return NextResponse.rewrite(url, { request: { headers: forwardedHeaders(request, tenant) } });
    }

    if (isStorePath(pathname)) {
      return NextResponse.next({ request: { headers: forwardedHeaders(request, tenant) } });
    }

    const origin = rootOrigin();
    if (!origin) return new NextResponse('No encontrado', { status: 404 });
    return NextResponse.redirect(new URL(`${pathname}${request.nextUrl.search}`, origin), 307);
  }

  // ---------- Un subdominio que no es una tienda ----------
  // `www`, `admin`, el de una demo… No tienen nada propio: se mandan al dominio
  // principal en lugar de servir el sitio entero bajo un nombre que no es el suyo.
  if (isOtherRootSubdomain(request.headers.get('host'))) {
    const origin = rootOrigin();
    if (!origin) return new NextResponse('No encontrado', { status: 404 });
    return NextResponse.redirect(new URL(`${pathname}${request.nextUrl.search}`, origin), 307);
  }

  // ---------- El dominio principal ----------
  const needsSession = pathname.startsWith('/admin') || pathname === '/login';
  if (!needsSession) {
    return NextResponse.next({ request: { headers: forwardedHeaders(request, null) } });
  }

  let supabaseResponse = NextResponse.next({ request: { headers: forwardedHeaders(request, null) } });

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
          supabaseResponse = NextResponse.next({
            request: { headers: forwardedHeaders(request, null) },
          });
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

/**
 * Todas las páginas, menos los archivos estáticos.
 *
 * Antes sólo corría en `/admin` y `/login`. Ahora tiene que ver cualquier ruta
 * para poder quitar la cabecera del negocio que venga de afuera y para reconocer
 * el subdominio de una tienda; los archivos de `public/` y de `_next` no pasan
 * por acá porque no tienen nada que decidir.
 */
export const config = {
  matcher: [
    '/((?!_next/static|_next/image|.*\\.(?:png|jpe?g|gif|svg|webp|avif|ico|woff2?|ttf|otf|css|js|map|txt|xml|pdf|mp4)$).*)',
  ],
};
