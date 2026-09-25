import { notFound } from 'next/navigation';
import Image from 'next/image';
import Link from 'next/link';
import { getProductBySlug } from '@/actions/catalog';
import { AddToCartButton } from '@/components/catalog/add-to-cart-button';
import { formatPrice } from '@/lib/utils';
import { ArrowLeft, ImageIcon } from 'lucide-react';

interface Props {
  params: Promise<{ slug: string }>;
}

export default async function ProductDetailPage({ params }: Props) {
  const { slug } = await params;
  const product = await getProductBySlug(slug);

  if (!product) notFound();

  return (
    <>
      <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        <Link
          href="/catalogo"
          className="inline-flex items-center text-sm text-stone-500 hover:text-stone-900 mb-6"
        >
          <ArrowLeft className="mr-1 h-4 w-4" /> Volver al catálogo
        </Link>

        <div className="grid grid-cols-1 gap-8 lg:grid-cols-2">
          {/* Image */}
          <div className="relative aspect-square overflow-hidden rounded-lg bg-stone-100">
            {product.image_url ? (
              <Image
                src={product.image_url}
                alt={product.name}
                fill
                className="object-cover"
                priority
              />
            ) : (
              <div className="flex h-full items-center justify-center text-stone-300">
                <ImageIcon className="h-10 w-10 text-stone-300" />
              </div>
            )}
          </div>

          {/* Details */}
          <div className="space-y-6">
            {product.category && (
              <span className="text-sm font-medium text-stone-500">
                {product.category.name}
              </span>
            )}

            <h1 className="text-3xl font-bold text-stone-900">
              {product.name}
            </h1>

            <p className="text-3xl font-bold text-stone-900">
              {formatPrice(product.price)}
              <span className="text-base font-normal text-stone-400 ml-2">
                / {product.sale_unit}
              </span>
            </p>

            {product.short_description && (
              <p className="text-lg text-stone-600">{product.short_description}</p>
            )}

            {product.long_description && (
              <div className="prose prose-stone">
                <p>{product.long_description}</p>
              </div>
            )}

            {product.ingredients && (
              <div>
                <h3 className="text-sm font-semibold text-stone-900 uppercase tracking-wide">
                  Ingredientes
                </h3>
                <p className="mt-1 text-sm text-stone-600">{product.ingredients}</p>
              </div>
            )}

            {product.min_quantity > 1 && (
              <p className="text-sm text-stone-500">
                Pedido mínimo: {product.min_quantity} {product.sale_unit}(s)
              </p>
            )}

            <AddToCartButton product={product} />
          </div>
        </div>
      </main>
    </>
  );
}
