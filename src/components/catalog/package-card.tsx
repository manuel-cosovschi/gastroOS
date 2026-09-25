'use client';

import Image from 'next/image';
import Link from 'next/link';
import { ImageIcon, Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useCart } from '@/components/cart/cart-provider';
import { useMoney } from '@/components/admin/business-provider';
import type { Package } from '@/types';
import { toast } from 'sonner';

interface PackageCardProps {
  pkg: Package;
}

export function PackageCard({ pkg }: PackageCardProps) {
  const { addItem } = useCart();
  const money = useMoney();

  const handleAddToCart = (e: React.MouseEvent) => {
    e.preventDefault();
    addItem({
      id: pkg.id,
      type: 'package',
      name: pkg.name,
      price: pkg.price,
      quantity: 1,
      image_url: pkg.image_url,
      min_advance_hours: null,
      sale_unit: 'paquete',
    });
    toast.success(`${pkg.name} agregado al pedido`);
  };

  return (
    <Link
      href={`/paquetes/${pkg.slug}`}
      className="group block overflow-hidden rounded-lg border border-stone-200 bg-white transition-shadow hover:shadow-md"
    >
      <div className="relative aspect-[4/3] overflow-hidden bg-stone-100">
        {pkg.image_url ? (
          <Image
            src={pkg.image_url}
            alt={pkg.name}
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
          {pkg.name}
        </h3>
        {pkg.description && (
          <p className="mt-1 text-sm text-stone-500 line-clamp-2">{pkg.description}</p>
        )}
        <div className="mt-3 flex items-center justify-between">
          <span className="text-lg font-semibold text-stone-900">
            {money(pkg.price)}
          </span>
          <Button size="icon" variant="outline" onClick={handleAddToCart} aria-label="Agregar">
            <Plus className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </Link>
  );
}
