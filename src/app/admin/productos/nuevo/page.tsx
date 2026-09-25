import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import { listCategories } from '@/actions/categories';
import { PageHeader } from '@/components/ui/page-header';
import { ProductForm } from '@/components/admin/products/product-form';

export const metadata = { title: 'Nuevo producto' };

export default async function NewProductPage() {
  const categories = await listCategories();

  return (
    <div className="space-y-6">
      <Link
        href="/admin/productos"
        className="inline-flex items-center gap-1 text-sm text-stone-500 transition-colors hover:text-stone-900"
      >
        <ArrowLeft className="h-4 w-4" /> Volver a productos
      </Link>
      <PageHeader title="Nuevo producto" />
      <ProductForm categories={categories} />
    </div>
  );
}
