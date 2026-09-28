import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import { ClientForm } from '@/components/client-form';

export const metadata = { title: 'Nuevo cliente' };

export default function NewClientPage() {
  return (
    <div className="space-y-6">
      <div>
        <Link
          href="/clientes"
          className="inline-flex items-center gap-1.5 text-sm text-stone-500 transition-colors hover:text-stone-900"
        >
          <ArrowLeft className="h-4 w-4" />
          Clientes
        </Link>
        <h1 className="mt-2 text-2xl font-semibold tracking-tight text-stone-900">Nuevo cliente</h1>
        <p className="mt-1 text-sm text-stone-500">
          Sólo el nombre es obligatorio. El resto se completa cuando lo sepas.
        </p>
      </div>

      <ClientForm />
    </div>
  );
}
