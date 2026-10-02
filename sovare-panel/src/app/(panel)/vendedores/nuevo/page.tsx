import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import { SectionCard } from '@/components/ui';
import { VendorForm } from '@/components/vendedores/vendor-form';

export const metadata = { title: 'Nuevo vendedor' };

export default function NewVendorPage() {
  return (
    <div className="space-y-6">
      <div>
        <Link
          href="/vendedores"
          className="inline-flex items-center gap-1.5 text-sm text-stone-500 transition-colors hover:text-stone-900"
        >
          <ArrowLeft className="h-4 w-4" />
          Mis vendedores
        </Link>
        <h1 className="mt-2 text-2xl font-semibold tracking-tight text-stone-900">
          Nuevo vendedor
        </h1>
        <p className="mt-1 max-w-xl text-sm text-stone-500">
          Al guardarlo te queda su link. Se lo mandás por WhatsApp y desde ahí empieza a cargar los
          clientes que consiga.
        </p>
      </div>

      <SectionCard title="Datos del vendedor">
        <div className="px-5 py-5">
          <VendorForm />
        </div>
      </SectionCard>
    </div>
  );
}
