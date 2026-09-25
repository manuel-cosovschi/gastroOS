'use client';

import { Suspense, useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { ProductGrid } from '@/components/catalog/product-grid';
import { CategoryFilter } from '@/components/catalog/category-filter';
import { getActiveCategories, getActiveProducts } from '@/actions/catalog';
import type { Product, Category } from '@/types';

function CatalogoContent() {
  const searchParams = useSearchParams();
  const categoriaParam = searchParams.get('categoria');

  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<string | null>(categoriaParam);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      setLoading(true);
      const [cats, prods] = await Promise.all([
        getActiveCategories(),
        getActiveProducts(selectedCategory || undefined),
      ]);
      setCategories(cats);
      setProducts(prods);
      setLoading(false);
    }
    load();
  }, [selectedCategory]);

  return (
    <>
      <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        <h1 className="text-3xl font-bold text-stone-900">Catálogo</h1>
        <p className="mt-2 text-stone-500">
          Explorá nuestros productos y armá tu pedido.
        </p>

        <div className="mt-6">
          <CategoryFilter
            categories={categories}
            selectedSlug={selectedCategory}
            onSelect={setSelectedCategory}
          />
        </div>

        <div className="mt-8">
          {loading ? (
            <div className="flex items-center justify-center py-16">
              <div className="h-8 w-8 animate-spin rounded-full border-4 border-stone-200 border-t-stone-900" />
            </div>
          ) : (
            <ProductGrid products={products} />
          )}
        </div>
      </main>
    </>
  );
}

export default function CatalogoPage() {
  return (
    <Suspense fallback={
      <div className="flex items-center justify-center min-h-screen">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-stone-200 border-t-stone-900" />
      </div>
    }>
      <CatalogoContent />
    </Suspense>
  );
}
