import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ArrowLeft } from 'lucide-react';
import { getOrder } from '@/actions/orders';
import { listCustomers } from '@/actions/customers';
import { listProducts } from '@/actions/products';
import { listPackages } from '@/actions/packages';
import { PageHeader } from '@/components/ui/page-header';
import { OrderForm } from '@/components/admin/orders/order-form';

export const metadata = { title: 'Editar pedido' };

export default async function EditOrderPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [order, customers, products, packages] = await Promise.all([
    getOrder(id),
    listCustomers(),
    listProducts({ is_active: true }),
    listPackages(),
  ]);

  if (!order) notFound();

  return (
    <div className="space-y-6">
      <Link
        href={`/admin/pedidos/${id}`}
        className="inline-flex items-center gap-1 text-sm text-stone-500 transition-colors hover:text-stone-900"
      >
        <ArrowLeft className="h-4 w-4" /> Volver al pedido
      </Link>

      <PageHeader title={`Editar pedido #${order.order_number}`} />

      <OrderForm
        customers={customers}
        products={products}
        packages={packages.filter((pkg) => pkg.is_active)}
        order={order}
      />
    </div>
  );
}
