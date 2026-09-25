'use client';

import { ShoppingBag } from 'lucide-react';
import Link from 'next/link';
import { useCart } from './cart-provider';

export function CartBadge() {
  const { totalItems } = useCart();

  return (
    <Link href="/pedido" className="relative">
      <ShoppingBag className="h-5 w-5 text-stone-600" />
      {totalItems > 0 && (
        <span className="absolute -right-2 -top-2 flex h-5 w-5 items-center justify-center rounded-full bg-stone-900 text-[10px] font-bold text-white">
          {totalItems}
        </span>
      )}
    </Link>
  );
}
