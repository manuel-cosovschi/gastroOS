'use client';

import { Button } from '@/components/ui/button';
import { useCart } from '@/components/cart/cart-provider';
import type { PackageDetail } from '@/types';
import { toast } from 'sonner';
import { ShoppingBag } from 'lucide-react';

export function AddPackageToCartButton({ pkg }: { pkg: PackageDetail }) {
  const { addItem } = useCart();

  const handleAdd = () => {
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
    <Button size="lg" onClick={handleAdd} className="w-full">
      <ShoppingBag className="mr-2 h-4 w-4" /> Agregar al pedido
    </Button>
  );
}
