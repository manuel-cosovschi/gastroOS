'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Search } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

export default function TrackOrderPage() {
  const router = useRouter();
  const [orderNumber, setOrderNumber] = useState('');

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    const value = orderNumber.trim().replace('#', '');
    if (value) router.push(`/pedido/seguimiento/${value}`);
  };

  return (
    <div className="mx-auto max-w-md px-4 py-16 sm:px-6">
      <h1 className="text-center text-2xl font-semibold tracking-tight text-stone-900">
        Seguimiento de pedido
      </h1>
      <p className="mt-2 text-center text-sm text-stone-500">
        Ingresá el número que te dimos al confirmar tu pedido.
      </p>

      <form onSubmit={handleSubmit} className="surface mt-8 p-5">
        <Label htmlFor="orderNumber">Número de pedido</Label>
        <div className="mt-1.5 flex gap-2">
          <Input
            id="orderNumber"
            value={orderNumber}
            onChange={(event) => setOrderNumber(event.target.value)}
            placeholder="Ej: 128"
            inputMode="numeric"
            autoFocus
          />
          <Button type="submit" disabled={!orderNumber.trim()}>
            <Search className="h-4 w-4" />
            Buscar
          </Button>
        </div>
      </form>
    </div>
  );
}
