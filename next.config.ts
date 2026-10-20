import type { NextConfig } from 'next';

/**
 * El dominio raíz, para la política de marcos.
 *
 * Es la misma cuenta que hace `rootHost()` en `src/lib/tenant.ts` —primero
 * `NEXT_PUBLIC_ROOT_DOMAIN`, después el host de `NEXT_PUBLIC_SITE_URL`, después
 * el de producción que da Vercel—, repetida acá porque este archivo se evalúa
 * antes que la aplicación y no puede importar de ella.
 */
function dominioRaiz(): string | null {
  const explicito = process.env.NEXT_PUBLIC_ROOT_DOMAIN?.trim().toLowerCase();
  if (explicito) return explicito;
  const crudo =
    process.env.NEXT_PUBLIC_SITE_URL?.trim() ||
    (process.env.VERCEL_PROJECT_PRODUCTION_URL ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}` : '');
  try {
    return crudo ? new URL(crudo).host.toLowerCase() : null;
  } catch {
    return null;
  }
}

/**
 * Quién puede meter este sitio adentro de un marco.
 *
 * La página comercial embebe la demo, así que el propio sitio tiene que poder.
 * Y tiene que poder **desde el dominio pelado y desde los subdominios**: la
 * página vive en `gastroos.shop` y las tiendas en `tunegocio.gastroos.shop`, y
 * una política que nombra sólo uno rompe el marco el día que algo se mueve del
 * otro lado. Nadie más: un marco ajeno sobre el panel es la base de cualquier
 * engaño de clics.
 *
 * Sin dominio configurado queda `'self'` solo, que es lo seguro.
 */
const raiz = dominioRaiz();
const MARCOS = ["'self'", ...(raiz ? [`https://${raiz}`, `https://*.${raiz}`] : [])].join(' ');

const ENCABEZADOS = [
  { key: 'Content-Security-Policy', value: `frame-ancestors ${MARCOS}` },
  // Que el navegador no adivine el tipo de un archivo: un comprobante subido
  // como imagen no se puede ejecutar como script.
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  // A otro sitio le llega el dominio, no la dirección entera: las direcciones
  // de contratación y de vendedor llevan un token.
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  // Nada del sistema usa la cámara, el micrófono ni la ubicación. Subir una
  // foto del comprobante usa el selector de archivos, que no pasa por esto.
  { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=(), payment=(), usb=()' },
];

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: '*.supabase.co',
        pathname: '/storage/v1/object/public/**',
      },
    ],
  },
  async headers() {
    return [{ source: '/:path*', headers: ENCABEZADOS }];
  },
};

export default nextConfig;
