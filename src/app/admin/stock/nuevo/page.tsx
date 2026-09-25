'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { createIngredient } from '@/actions/ingredients';
import { Button } from '@/components/ui/button';
import { STOCK_UNITS } from '@/types';
import { ArrowLeft, Loader2 } from 'lucide-react';
import Link from 'next/link';
import { toast } from 'sonner';

export default function NuevoIngredientePage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setLoading(true);
    const formData = new FormData(e.currentTarget);

    const result = await createIngredient({
      name: formData.get('name') as string,
      unit: formData.get('unit') as string,
      stock_quantity: Number(formData.get('stock_quantity')) || 0,
      min_stock_quantity: Number(formData.get('min_stock_quantity')) || 0,
      cost_per_unit: Number(formData.get('cost_per_unit')) || 0,
      supplier: (formData.get('supplier') as string) || undefined,
      notes: (formData.get('notes') as string) || undefined,
    });

    if (result.success) {
      toast.success('Ingrediente creado');
      router.push('/admin/stock');
    } else {
      toast.error(result.error || 'Error al crear ingrediente');
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6 max-w-2xl">
      <div>
        <Link
          href="/admin/stock"
          className="inline-flex items-center gap-1 text-sm text-stone-500 hover:text-stone-900 mb-2"
        >
          <ArrowLeft className="h-4 w-4" /> Ingredientes
        </Link>
        <h1 className="text-2xl font-bold text-stone-900">Nuevo ingrediente</h1>
      </div>

      <form onSubmit={handleSubmit} className="rounded-lg border border-stone-200 bg-white p-6 space-y-4">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <label className="block text-sm font-medium text-stone-700 mb-1">Nombre *</label>
            <input
              name="name"
              required
              className="w-full rounded-md border border-stone-300 px-3 py-2 text-sm focus:border-stone-500 focus:outline-none focus:ring-1 focus:ring-stone-500"
              placeholder="Ej: Harina 000"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-stone-700 mb-1">Unidad *</label>
            <select
              name="unit"
              required
              className="w-full rounded-md border border-stone-300 px-3 py-2 text-sm focus:border-stone-500 focus:outline-none focus:ring-1 focus:ring-stone-500"
            >
              {STOCK_UNITS.map((unit) => (
                <option key={unit} value={unit}>{unit}</option>
              ))}
            </select>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <div>
            <label className="block text-sm font-medium text-stone-700 mb-1">Stock actual</label>
            <input
              name="stock_quantity"
              type="number"
              step="0.001"
              min="0"
              defaultValue="0"
              className="w-full rounded-md border border-stone-300 px-3 py-2 text-sm focus:border-stone-500 focus:outline-none focus:ring-1 focus:ring-stone-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-stone-700 mb-1">Stock mínimo</label>
            <input
              name="min_stock_quantity"
              type="number"
              step="0.001"
              min="0"
              defaultValue="0"
              className="w-full rounded-md border border-stone-300 px-3 py-2 text-sm focus:border-stone-500 focus:outline-none focus:ring-1 focus:ring-stone-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-stone-700 mb-1">Costo por unidad ($)</label>
            <input
              name="cost_per_unit"
              type="number"
              step="0.01"
              min="0"
              defaultValue="0"
              className="w-full rounded-md border border-stone-300 px-3 py-2 text-sm focus:border-stone-500 focus:outline-none focus:ring-1 focus:ring-stone-500"
            />
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-stone-700 mb-1">Proveedor</label>
          <input
            name="supplier"
            className="w-full rounded-md border border-stone-300 px-3 py-2 text-sm focus:border-stone-500 focus:outline-none focus:ring-1 focus:ring-stone-500"
            placeholder="Nombre del proveedor (opcional)"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-stone-700 mb-1">Notas</label>
          <textarea
            name="notes"
            rows={2}
            className="w-full rounded-md border border-stone-300 px-3 py-2 text-sm focus:border-stone-500 focus:outline-none focus:ring-1 focus:ring-stone-500"
            placeholder="Notas adicionales (opcional)"
          />
        </div>

        <div className="flex justify-end gap-2 pt-2">
          <Button type="button" variant="outline" onClick={() => router.back()}>
            Cancelar
          </Button>
          <Button type="submit" disabled={loading}>
            {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Crear ingrediente
          </Button>
        </div>
      </form>
    </div>
  );
}
