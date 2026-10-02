import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { vendorsEnabled } from '@/lib/vendors';
import { Logo } from '@/components/brand/logo';
import { SovareCredit } from '@/components/brand/sovare';

/**
 * Un link con el que se entra como otra persona no se indexa ni se reenvía por
 * el encabezado Referer: el token está en la dirección, y es todo lo que hace
 * falta para cargar clientes en nombre del vendedor.
 */
export const metadata: Metadata = {
  title: 'Tu página de vendedor',
  robots: { index: false, follow: false },
  referrer: 'no-referrer',
};

/**
 * Shell de la página del vendedor.
 *
 * Igual que la contratación: marca GastroOS, sin navegación, y si la service role
 * no está configurada estas rutas no existen. Es lo que le pasa a la instalación
 * de un cliente, donde no tiene sentido que haya vendedores.
 */
export default function VendedorLayout({ children }: { children: React.ReactNode }) {
  if (!vendorsEnabled()) notFound();

  return (
    <div className="flex min-h-screen flex-col bg-stone-50">
      <header className="border-b border-stone-200 bg-white">
        <div className="mx-auto flex h-16 max-w-3xl items-center px-4 sm:px-6">
          <Link href="/" className="flex items-center" aria-label="GastroOS">
            <Logo />
          </Link>
        </div>
      </header>

      <main className="flex-1">
        <div className="mx-auto max-w-3xl px-4 py-8 sm:px-6 sm:py-12">{children}</div>
      </main>

      <footer className="border-t border-stone-200 bg-white py-8">
        <div className="mx-auto flex max-w-3xl justify-center px-4 sm:px-6">
          <SovareCredit />
        </div>
      </footer>
    </div>
  );
}
