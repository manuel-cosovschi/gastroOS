'use client';

import Image from 'next/image';
import Link from 'next/link';
import { ImageIcon, Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useCart } from '@/components/cart/cart-provider';
import { useMoney } from '@/components/admin/business-provider';
import type { Product } from '@/types';
import { toast } from 'sonner';

interface ProductCardProps {
  product: Product;
}

export function ProductCard({ product }: ProductCardProps) {
  const { addItem } = useCart();
  const money = useMoney();

  const handleAddToCart = (e: React.MouseEvent) => {
    e.preventDefault();
    addItem({
      id: product.id,
      type: 'product',
      name: product.name,
      price: product.price,
      quantity: product.min_quantity || 1,
      image_url: product.image_url,
      min_advance_hours: product.min_advance_hours,
      sale_unit: product.sale_unit,
    });
    toast.success(`${product.name} agregado al pedido`);
  };

  return (
    <Link
      href={`/catalogo/${product.slug}`}
      className="group block overflow-hidden rounded-lg border border-stone-200 bg-white transition-shadow hover:shadow-md"
    >
      <div className="relative aspect-square overflow-hidden bg-stone-100">
        {product.image_url ? (
          <Image
            src={product.image_url}
            alt={product.name}
            fill
            className="object-cover transition-transform group-hover:scale-105"
            sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
          />
        ) : (
          <div className="flex h-full items-center justify-center text-stone-300">
            <ImageIcon className="h-8 w-8 text-stone-300" />
          </div>
        )}
      </div>

      <div className="p-4">
        <h3 className="font-medium text-stone-900 group-hover:text-stone-700">
          {product.name}
        </h3>
        {product.short_description && (
          <p className="mt-1 text-sm text-stone-500 line-clamp-2">
            {product.short_description}
          </p>
        )}
        <div className="mt-3 flex items-center justify-between">
          <span className="text-lg font-semibold text-stone-900">
            {money(product.price)}
            <span className="text-xs font-normal text-stone-400 ml-1">
              / {product.sale_unit}
            </span>
          </span>
          <Button size="icon" variant="outline" onClick={handleAddToCart} aria-label="Agregar">
            <Plus className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </Link>
  );
}
