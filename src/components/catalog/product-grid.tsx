import type { Product } from '@/types';
import { ProductCard } from './product-card';

interface ProductGridProps {
  products: Product[];
  /** Hay una categoría elegida: "no hay nada" se refiere a ella, no a toda la tienda. */
  filtered?: boolean;
}

export function ProductGrid({ products, filtered = false }: ProductGridProps) {
  if (products.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center">
        <span className="text-4xl mb-4">🍪</span>
        <p className="text-stone-500">
          {filtered
            ? 'No hay productos disponibles en esta categoría.'
            : 'Todavía no hay productos cargados. Volvé pronto.'}
        </p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
      {products.map((product) => (
        <ProductCard key={product.id} product={product} />
      ))}
    </div>
  );
}
