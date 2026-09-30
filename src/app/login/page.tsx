import { Suspense } from 'react';
import Link from 'next/link';
import { Logo } from '@/components/brand/logo';
import { EnterDemoButton } from '@/components/demo/enter-demo-button';
import {
  ClientAccess,
  ClientAccessClosed,
  ClientAccessSkeleton,
} from '@/components/login/client-access';
import { APP_TAGLINE, DEMO_MODE } from '@/lib/constants';

export const metadata = { title: 'Entrar' };

/**
 * La pantalla de entrada.
 *
 * Es un componente de servidor a propósito. Antes la página entera era cliente
 * y colgaba de un `Suspense` por culpa de `useSearchParams`, así que lo único
 * que llegaba del servidor era un spinner: en un teléfono con mala señal, la
 * primera pantalla de GastroOS estaba en blanco hasta que bajaba todo el
 * JavaScript. Ahora el logo, la demo y las dos puertas vienen pintadas de una,
 * y lo único que espera al JavaScript es el formulario de los clientes.
 *
 * Las dos puertas están separadas y dichas con todas las letras porque son
 * para dos personas distintas: la que viene a probar y la que ya tiene su
 * sistema.
 */
export default function LoginPage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-stone-50 px-4 py-12">
      <div className="w-full max-w-sm">
        <div className="mb-8 flex flex-col items-center text-center">
          <Logo size="lg" className="flex-col gap-3" />
          <p className="mt-3 text-sm text-stone-500">{APP_TAGLINE}</p>
        </div>

        {DEMO_MODE && (
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

            <div className="my-5 flex items-center gap-3">
              <span className="h-px flex-1 bg-stone-200" />
              <span className="text-xs font-medium uppercase tracking-wider text-stone-400">o</span>
              <span className="h-px flex-1 bg-stone-200" />
            </div>
          </>
        )}

        <Suspense fallback={DEMO_MODE ? <ClientAccessClosed /> : <ClientAccessSkeleton />}>
          <ClientAccess />
        </Suspense>

        {DEMO_MODE && (
          <p className="mt-6 text-center text-sm text-stone-500">
            ¿Todavía no tenés el tuyo?{' '}
            <Link href="/contratar" className="font-medium text-brand-700 hover:underline">
              Mirá los planes
            </Link>
          </p>
        )}
      </div>
    </div>
  );
}
