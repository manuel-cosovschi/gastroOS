import { PackageForm } from '@/components/admin/packages/package-form';
import { listProducts } from '@/actions/products';

export default async function NuevoPaquetePage() {
  const products = await listProducts();

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-stone-900">Nuevo paquete</h1>
      <PackageForm products={products} />
    </div>
  );
}
