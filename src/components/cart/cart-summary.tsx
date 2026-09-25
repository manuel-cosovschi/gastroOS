'use client';

import { Minus, Plus, ShoppingBag, Trash2 } from 'lucide-react';
import { useCart } from './cart-provider';
import { Button } from '@/components/ui/button';
import { useMoney } from '@/components/admin/business-provider';

export function CartSummary() {
  const money = useMoney();
  const { items, updateQuantity, removeItem, subtotal } = useCart();

  if (items.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-center">
        <ShoppingBag className="mb-4 h-8 w-8 text-stone-300" />
        <p className="text-stone-500">Tu pedido está vacío.</p>
        <p className="mt-1 text-sm text-stone-400">
          Explorá el catálogo para agregar productos.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <h2 className="text-lg font-semibold text-stone-900">Tu pedido</h2>

      <div className="divide-y divide-stone-200">
        {items.map((item) => (
          <div key={item.id} className="flex items-center gap-4 py-4">
            <div className="flex-1 min-w-0">
              <p className="font-medium text-stone-900 truncate">{item.name}</p>
              <p className="text-sm text-stone-500">
                {money(item.price)} / {item.sale_unit}
              </p>
            </div>

            <div className="flex items-center gap-2">
              <Button
                size="icon"
                variant="outline"
                className="h-8 w-8"
                onClick={() => updateQuantity(item.id, item.quantity - 1)}
                disabled={item.quantity <= 1}
              >
                <Minus className="h-3 w-3" />
              </Button>
              <span className="w-8 text-center text-sm font-medium">{item.quantity}</span>
              <Button
                size="icon"
                variant="outline"
                className="h-8 w-8"
                onClick={() => updateQuantity(item.id, item.quantity + 1)}
              >
                <Plus className="h-3 w-3" />
              </Button>
            </div>

            <p className="w-20 text-right font-medium text-stone-900">
              {money(item.price * item.quantity)}
            </p>

            <Button
              size="icon"
              variant="ghost"
              className="h-8 w-8 text-stone-400 hover:text-red-600"
              onClick={() => removeItem(item.id)}
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        ))}
      </div>

      <div className="flex items-center justify-between border-t border-stone-200 pt-4">
        <span className="text-base font-semibold text-stone-900">Subtotal estimado</span>
        <span className="text-xl font-bold text-stone-900">{money(subtotal)}</span>
      </div>
    </div>
  );
}
