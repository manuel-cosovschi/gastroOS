'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useCart } from '@/components/cart/cart-provider';
import type { Product } from '@/types';
import { toast } from 'sonner';
import { ShoppingBag, Minus, Plus } from 'lucide-react';

interface AddToCartButtonProps {
  product: Product;
}

export function AddToCartButton({ product }: AddToCartButtonProps) {
  const { addItem } = useCart();
  const [quantity, setQuantity] = useState(product.min_quantity || 1);

  const handleAdd = () => {
    addItem({
      id: product.id,
      type: 'product',
      name: product.name,
      price: product.price,
      quantity,
      image_url: product.image_url,
      min_advance_hours: product.min_advance_hours,
      sale_unit: product.sale_unit,
    });
    toast.success(`${product.name} x${quantity} agregado al pedido`);
  };

  return (
    <div className="flex items-center gap-4">
      <div className="flex items-center gap-2">
        <Button
          size="icon"
          variant="outline"
          onClick={() => setQuantity(Math.max(product.min_quantity || 1, quantity - 1))}
        >
          <Minus className="h-4 w-4" />
        </Button>
        <Input
          type="number"
          value={quantity}
          onChange={(e) => setQuantity(Math.max(product.min_quantity || 1, Number(e.target.value)))}
          className="w-20 text-center"
          min={product.min_quantity || 1}
        />
        <Button
          size="icon"
          variant="outline"
          onClick={() => setQuantity(quantity + 1)}
        >
          <Plus className="h-4 w-4" />
        </Button>
      </div>
      <Button size="lg" onClick={handleAdd} className="flex-1">
        <ShoppingBag className="mr-2 h-4 w-4" /> Agregar al pedido
      </Button>
    </div>
  );
}
