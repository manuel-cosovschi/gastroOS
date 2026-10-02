import { Suspense } from 'react';
import Link from 'next/link';
import { Logo } from '@/components/brand/logo';
import { EnterDemoButton } from '@/components/demo/enter-demo-button';
import { ClientAccess, ClientAccessSkeleton } from '@/components/login/client-access';
import { APP_TAGLINE, DEMO_MODE } from '@/lib/constants';
import { whatsappUrl } from '@/lib/marketing';

export const metadata = { title: 'Entrar' };

/**
 * La pantalla de entrada. Sirve a dos tipos de visitante a la vez.
 *
 * Quien todavía no es cliente llega para probar el sistema: el botón de la demo
 * le arma una copia propia de una pastelería de ejemplo, sin registrarse. Quien ya
 * contrató llega para entrar a su negocio con su mail y su contraseña. Los dos
 * están en la misma pantalla porque `gastroos.shop` aloja las dos cosas: la demo
 * y las cuentas de los clientes del plan Taller.
 *
 * En la instalación propia de un cliente (`DEMO_MODE` en falso) no hay demo y el
 * formulario es toda la pantalla.
 *
 * Es un componente de servidor a propósito. Antes la página entera era cliente
 * y colgaba de un `Suspense` por culpa de `useSearchParams`, así que lo único
 * que llegaba del servidor era un spinner: en un teléfono con mala señal, la
 * primera pantalla de GastroOS estaba en blanco hasta que bajaba todo el
 * JavaScript.
 */
export default function LoginPage() {
  const help = whatsappUrl('Hola, necesito ayuda para entrar a mi cuenta de GastroOS.');

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

            <div className="mt-8">
              <p className="mb-3 text-center text-sm font-semibold text-stone-900">
                ¿Ya sos cliente? Entrá a tu cuenta
              </p>
              <Suspense fallback={<ClientAccessSkeleton />}>
                <ClientAccess helpUrl={help} />
              </Suspense>
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
            <ClientAccess helpUrl={help} />
          </Suspense>
        )}
      </div>
    </div>
  );
}
