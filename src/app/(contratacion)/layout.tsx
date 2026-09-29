import Link from 'next/link';
import { notFound } from 'next/navigation';
import { signupsEnabled } from '@/lib/signups';
import { Logo } from '@/components/brand/logo';
import { SovareCredit } from '@/components/brand/sovare';

/**
 * Shell de la contratación.
 *
 * Marca GastroOS, no la del negocio: acá el que vende es GastroOS. Deliberadamente
 * sin navegación: quien está por transferir no necesita que le ofrezcan siete
 * lugares más a dónde ir.
 *
 * Si la contratación no está configurada —falta la service role o los datos de
 * transferencia— estas rutas no existen. Es lo que le pasa a la instalación de
 * un cliente, donde no tiene ningún sentido vender GastroOS.
 */
export default function ContratacionLayout({ children }: { children: React.ReactNode }) {
  if (!signupsEnabled()) notFound();

  return (
    <div className="flex min-h-screen flex-col bg-stone-50">
      <header className="border-b border-stone-200 bg-white">
        <div className="mx-auto flex h-16 max-w-3xl items-center px-4 sm:px-6">
          <Link href="/" className="flex items-center" aria-label="Volver al inicio de GastroOS">
            <Logo />
          </Link>
        </div>
      </header>

      <main className="flex-1">
        <div className="mx-auto max-w-3xl px-4 py-10 sm:px-6 sm:py-14">{children}</div>
      </main>

      <footer className="border-t border-stone-200 bg-white py-8">
        <div className="mx-auto flex max-w-3xl justify-center px-4 sm:px-6">
          <SovareCredit />
        </div>
      </footer>
    </div>
  );
}
