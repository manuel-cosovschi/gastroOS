import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import { PageHeader } from '@/components/ui/page-header';
import { CustomerForm } from '@/components/admin/customers/customer-form';

export const metadata = { title: 'Nuevo cliente' };

export default function NewCustomerPage() {
  return (
    <div className="space-y-6">
      <Link
        href="/admin/clientes"
        className="inline-flex items-center gap-1 text-sm text-stone-500 transition-colors hover:text-stone-900"
      >
        <ArrowLeft className="h-4 w-4" /> Volver a clientes
      </Link>
      <PageHeader title="Nuevo cliente" description="Sólo el nombre es obligatorio." />
      <CustomerForm />
    </div>
  );
}
