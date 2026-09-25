import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ArrowLeft } from 'lucide-react';
import { getCustomer } from '@/actions/customers';
import { PageHeader } from '@/components/ui/page-header';
import { CustomerForm } from '@/components/admin/customers/customer-form';

export const metadata = { title: 'Editar cliente' };

export default async function EditCustomerPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const result = await getCustomer(id);
  if (!result) notFound();

  return (
    <div className="space-y-6">
      <Link
        href={`/admin/clientes/${id}`}
        className="inline-flex items-center gap-1 text-sm text-stone-500 transition-colors hover:text-stone-900"
      >
        <ArrowLeft className="h-4 w-4" /> Volver al cliente
      </Link>
      <PageHeader title={`Editar ${result.customer.full_name}`} />
      <CustomerForm customer={result.customer} />
    </div>
  );
}
