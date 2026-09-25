'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { Loader2, Package } from 'lucide-react';
import { adjustProductStock } from '@/actions/products';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import type { Product } from '@/types';

/**
 * Stock de producto terminado.
 *
 * Dos operaciones, que es lo que un negocio chico necesita: registrar una
 * tanda que salió del horno (suma) o corregir el stock a mano (fija el valor).
 * Las dos dejan movimiento registrado.
 */
export function ProductStockManager({ product }: { product: Product }) {
  const router = useRouter();
  const [saving, setSaving] = useState(false);
  const [batches, setBatches] = useState('1');
  const [newQuantity, setNewQuantity] = useState(String(product.stock_quantity));
  const [notes, setNotes] = useState('');

  const run = async (quantity: number, note: string, successMessage: string) => {
    setSaving(true);
    const result = await adjustProductStock(product.id, quantity, note);
    setSaving(false);

    if (!result.success) {
      toast.error(result.error || 'No se pudo actualizar el stock.');
      return;
    }

    toast.success(successMessage);
    setNotes('');
    router.refresh();
  };

  const registerProduction = () => {
    const count = Number(batches);
    if (!count || count <= 0) return toast.error('Indicá cuántos lotes produjiste.');

    const units = count * product.batch_size;
    run(
      product.stock_quantity + units,
      `Producción: ${count} lote(s) × ${product.batch_size}`,
      `Producción registrada: +${units} ${product.sale_unit}`
    );
  };

  const adjust = () => {
    if (!notes.trim()) return toast.error('Escribí el motivo del ajuste.');
    run(Number(newQuantity), notes, 'Stock ajustado');
  };

  return (
    <section className="surface max-w-2xl p-5">
      <div className="mb-4 flex items-center gap-2">
        <Package className="h-4 w-4 text-stone-400" />
        <h2 className="text-sm font-semibold text-stone-900">Stock de producto terminado</h2>
      </div>

      <p className="mb-5 text-sm text-stone-500">
        Disponible ahora:{' '}
        <span className="font-semibold text-stone-900">
          {product.stock_quantity} {product.sale_unit}
        </span>
        {product.min_stock_quantity > 0 && (
          <span className="text-stone-400"> · mínimo {product.min_stock_quantity}</span>
        )}
      </p>

      <div className="grid gap-5 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="batches">Registrar producción</Label>
          <div className="flex gap-2">
            <Input
              id="batches"
              type="number"
              min={1}
              value={batches}
              onChange={(event) => setBatches(event.target.value)}
            />
            <Button type="button" variant="outline" onClick={registerProduction} disabled={saving}>
              {saving && <Loader2 className="h-4 w-4 animate-spin" />}
              Sumar
            </Button>
          </div>
          <p className="text-xs text-stone-500">
            Lotes de {product.batch_size} {product.sale_unit}. Consume los insumos de la receta.
          </p>
        </div>

        <div className="space-y-2">
          <Label htmlFor="new-quantity">Corregir stock</Label>
          <div className="flex gap-2">
            <Input
              id="new-quantity"
              type="number"
              value={newQuantity}
              onChange={(event) => setNewQuantity(event.target.value)}
            />
            <Button type="button" variant="outline" onClick={adjust} disabled={saving}>
              {saving && <Loader2 className="h-4 w-4 animate-spin" />}
              Ajustar
            </Button>
          </div>
          <Input
            placeholder="Motivo del ajuste"
            value={notes}
            onChange={(event) => setNotes(event.target.value)}
          />
        </div>
      </div>
    </section>
  );
}
