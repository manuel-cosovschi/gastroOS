import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import { listCustomers } from '@/actions/customers';
import { listProducts } from '@/actions/products';
import { listPackages } from '@/actions/packages';
import { PageHeader } from '@/components/ui/page-header';
import { OrderForm } from '@/components/admin/orders/order-form';

export const metadata = { title: 'Nuevo pedido' };

export default async function NewOrderPage() {
  const [customers, products, packages] = await Promise.all([
    listCustomers(),
    listProducts({ is_active: true }),
    listPackages(),
  ]);

  return (
    <div className="space-y-6">
      <Link
        href="/admin/pedidos"
        className="inline-flex items-center gap-1 text-sm text-stone-500 transition-colors hover:text-stone-900"
      >
        <ArrowLeft className="h-4 w-4" /> Volver a pedidos
      </Link>

      <PageHeader
        title="Nuevo pedido"
        description="Buscá el cliente, elegí los productos y listo."
      />

      <OrderForm
        customers={customers}
        products={products}
        packages={packages.filter((pkg) => pkg.is_active)}
      />
    </div>
  );
}
