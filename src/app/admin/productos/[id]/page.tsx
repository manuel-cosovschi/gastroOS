import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ArrowLeft } from 'lucide-react';
import { getProduct } from '@/actions/products';
import { listCategories } from '@/actions/categories';
import { getProductRecipe, listIngredients } from '@/actions/ingredients';
import { PageHeader } from '@/components/ui/page-header';
import { ProductForm } from '@/components/admin/products/product-form';
import { ProductStockManager } from '@/components/admin/products/product-stock-manager';
import { RecipeManager } from '@/components/admin/products/recipe-manager';

export const metadata = { title: 'Editar producto' };

export default async function EditProductPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [product, categories, recipe, ingredients] = await Promise.all([
    getProduct(id),
    listCategories(),
    getProductRecipe(id),
    listIngredients(true),
  ]);

  if (!product) notFound();

  return (
    <div className="space-y-6">
      <Link
        href="/admin/productos"
        className="inline-flex items-center gap-1 text-sm text-stone-500 transition-colors hover:text-stone-900"
      >
        <ArrowLeft className="h-4 w-4" /> Volver a productos
      </Link>

      <PageHeader title={product.name} description="Datos, stock y receta del producto." />

      <ProductForm product={product} categories={categories} />
      <ProductStockManager product={product} />
      <RecipeManager
        productId={product.id}
        productName={product.name}
        batchSize={product.batch_size}
        currentRecipe={recipe}
        availableIngredients={ingredients}
      />
    </div>
  );
}
