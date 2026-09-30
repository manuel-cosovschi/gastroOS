import { Suspense } from 'react';
import Link from 'next/link';
import { Logo } from '@/components/brand/logo';
import { EnterDemoButton } from '@/components/demo/enter-demo-button';
import { ClientAccess, ClientAccessSkeleton } from '@/components/login/client-access';
import { APP_TAGLINE, DEMO_MODE } from '@/lib/constants';

export const metadata = { title: 'Entrar' };

/**
 * La pantalla de entrada, que es dos pantallas distintas según el deploy.
 *
 * En `gastroos.shop` —el sitio de venta— sólo existe la demo. No hay ningún
 * formulario de clientes porque no hay ninguna cuenta de cliente que pueda
 * entrar ahí: cada cliente tiene su propia instalación, con su propia base de
 * datos, y entra por su propio dominio. Un formulario en esta pantalla no le
 * serviría a nadie y le restaba a lo único que acá tiene que pasar, que es que
 * alguien pruebe el sistema.
 *
 * En la instalación de un cliente (`DEMO_MODE` en falso) es al revés: no hay
 * demo y el formulario es toda la pantalla.
 *
 * Es un componente de servidor a propósito. Antes la página entera era cliente
 * y colgaba de un `Suspense` por culpa de `useSearchParams`, así que lo único
 * que llegaba del servidor era un spinner: en un teléfono con mala señal, la
 * primera pantalla de GastroOS estaba en blanco hasta que bajaba todo el
 * JavaScript.
 */
export default function LoginPage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-stone-50 px-4 py-12">
      <div className="w-full max-w-sm">
        <div className="mb-8 flex flex-col items-center text-center">
          <Logo size="lg" className="flex-col gap-3" />
          <p className="mt-3 text-sm text-stone-500">{APP_TAGLINE}</p>
        </div>

        {DEMO_MODE ? (
          <>
            <div className="surface space-y-3 p-6">
              <div className="text-center">
                <p className="text-sm font-semibold text-stone-900">Probá el sistema ahora</p>
                <p className="mt-1 text-sm leading-relaxed text-stone-600">
                  Te armamos una copia tuya de una pastelería de ejemplo. Cambiá lo que quieras: no
                  hay que registrarse, no hace falta dejar ningún dato y nadie más ve lo que hagas.
                </p>
              </div>
              <EnterDemoButton />
            </div>

            <p className="mt-6 text-center text-sm text-stone-500">
              ¿Querés el tuyo?{' '}
              <Link href="/contratar" className="font-medium text-brand-700 hover:underline">
                Mirá los planes
              </Link>
            </p>
          </>
        ) : (
          <Suspense fallback={<ClientAccessSkeleton />}>
            <ClientAccess />
          </Suspense>
        )}
      </div>
    </div>
  );
}
