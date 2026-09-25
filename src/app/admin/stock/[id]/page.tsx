'use client';

import { use, useCallback, useEffect, useState } from 'react';
import {
  getIngredient,
  updateIngredient,
  adjustIngredientStock,
  registerPurchase,
  getIngredientMovements,
} from '@/actions/ingredients';
import { Button } from '@/components/ui/button';
import { STOCK_UNITS, MOVEMENT_TYPE_LABELS } from '@/types';
import type { Ingredient, StockMovement, MovementType } from '@/types';
import { ArrowLeft, Loader2, Plus } from 'lucide-react';
import Link from 'next/link';
import { toast } from 'sonner';
import { formatDateTime } from '@/lib/utils';

export default function EditarIngredientePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const [ingredient, setIngredient] = useState<Ingredient | null>(null);
  const [movements, setMovements] = useState<StockMovement[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [tab, setTab] = useState<'info' | 'stock' | 'historial'>('info');

  // Stock adjustment state
  const [adjustQty, setAdjustQty] = useState('');
  const [adjustNotes, setAdjustNotes] = useState('');

  // Purchase state
  const [purchaseQty, setPurchaseQty] = useState('');
  const [purchaseCost, setPurchaseCost] = useState('');
  const [purchaseNotes, setPurchaseNotes] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    const [ing, movs] = await Promise.all([
      getIngredient(id),
      getIngredientMovements(id),
    ]);
    setIngredient(ing);
    setMovements(movs);
    if (ing) setAdjustQty(String(ing.stock_quantity));
    setLoading(false);
  }, [id]);

  useEffect(() => {
    load();
  }, [load]);

  const handleSaveInfo = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setSaving(true);
    const formData = new FormData(e.currentTarget);

    const result = await updateIngredient(id, {
      name: formData.get('name') as string,
      unit: formData.get('unit') as string,
      min_stock_quantity: Number(formData.get('min_stock_quantity')) || 0,
      cost_per_unit: Number(formData.get('cost_per_unit')) || 0,
      supplier: (formData.get('supplier') as string) || undefined,
      notes: (formData.get('notes') as string) || undefined,
      is_active: formData.get('is_active') === 'on',
    });

    if (result.success) {
      toast.success('Ingrediente actualizado');
      load();
    } else {
      toast.error(result.error || 'Error');
    }
    setSaving(false);
  };

  const handleAdjust = async () => {
    if (!adjustNotes.trim()) {
      toast.error('Escribí un motivo para el ajuste');
      return;
    }
    setSaving(true);
    const result = await adjustIngredientStock(id, {
      new_quantity: Number(adjustQty),
      notes: adjustNotes,
    });
    if (result.success) {
      toast.success('Stock ajustado');
      setAdjustNotes('');
      load();
    } else {
      toast.error(result.error || 'Error');
    }
    setSaving(false);
  };

  const handlePurchase = async () => {
    if (!purchaseQty || Number(purchaseQty) <= 0) {
      toast.error('Ingresá una cantidad válida');
      return;
    }
    setSaving(true);
    const result = await registerPurchase(
      id,
      Number(purchaseQty),
      Number(purchaseCost) || 0,
      purchaseNotes || undefined
    );
    if (result.success) {
      toast.success('Compra registrada');
      setPurchaseQty('');
      setPurchaseCost('');
      setPurchaseNotes('');
      load();
    } else {
      toast.error(result.error || 'Error');
    }
    setSaving(false);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-stone-200 border-t-stone-900" />
      </div>
    );
  }

  if (!ingredient) {
    return <p className="text-stone-500">Ingrediente no encontrado.</p>;
  }

  return (
    <div className="space-y-6 max-w-2xl">
      <div>
        <Link
          href="/admin/stock"
          className="inline-flex items-center gap-1 text-sm text-stone-500 hover:text-stone-900 mb-2"
        >
          <ArrowLeft className="h-4 w-4" /> Ingredientes
        </Link>
        <h1 className="text-2xl font-bold text-stone-900">{ingredient.name}</h1>
        <p className="text-sm text-stone-500">
          Stock actual: <span className={ingredient.stock_quantity < ingredient.min_stock_quantity ? 'text-red-600 font-medium' : ''}>
            {ingredient.stock_quantity} {ingredient.unit}
          </span>
        </p>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 border-b border-stone-200">
        {(['info', 'stock', 'historial'] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
              tab === t
                ? 'border-stone-900 text-stone-900'
                : 'border-transparent text-stone-500 hover:text-stone-700'
            }`}
          >
            {t === 'info' ? 'Información' : t === 'stock' ? 'Stock' : 'Historial'}
          </button>
        ))}
      </div>

      {/* Info Tab */}
      {tab === 'info' && (
        <form onSubmit={handleSaveInfo} className="rounded-lg border border-stone-200 bg-white p-6 space-y-4">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label className="block text-sm font-medium text-stone-700 mb-1">Nombre *</label>
              <input
                name="name"
                defaultValue={ingredient.name}
                required
                className="w-full rounded-md border border-stone-300 px-3 py-2 text-sm focus:border-stone-500 focus:outline-none focus:ring-1 focus:ring-stone-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-stone-700 mb-1">Unidad *</label>
              <select
                name="unit"
                defaultValue={ingredient.unit}
                required
                className="w-full rounded-md border border-stone-300 px-3 py-2 text-sm focus:border-stone-500 focus:outline-none focus:ring-1 focus:ring-stone-500"
              >
                {STOCK_UNITS.map((unit) => (
                  <option key={unit} value={unit}>{unit}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label className="block text-sm font-medium text-stone-700 mb-1">Stock mínimo</label>
              <input
                name="min_stock_quantity"
                type="number"
                step="0.001"
                min="0"
                defaultValue={ingredient.min_stock_quantity}
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
                defaultValue={ingredient.cost_per_unit}
                className="w-full rounded-md border border-stone-300 px-3 py-2 text-sm focus:border-stone-500 focus:outline-none focus:ring-1 focus:ring-stone-500"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-stone-700 mb-1">Proveedor</label>
            <input
              name="supplier"
              defaultValue={ingredient.supplier || ''}
              className="w-full rounded-md border border-stone-300 px-3 py-2 text-sm focus:border-stone-500 focus:outline-none focus:ring-1 focus:ring-stone-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-stone-700 mb-1">Notas</label>
            <textarea
              name="notes"
              rows={2}
              defaultValue={ingredient.notes || ''}
              className="w-full rounded-md border border-stone-300 px-3 py-2 text-sm focus:border-stone-500 focus:outline-none focus:ring-1 focus:ring-stone-500"
            />
          </div>

          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              name="is_active"
              id="is_active"
              defaultChecked={ingredient.is_active}
              className="rounded border-stone-300"
            />
            <label htmlFor="is_active" className="text-sm text-stone-700">Activo</label>
          </div>

          <div className="flex justify-end pt-2">
            <Button type="submit" disabled={saving}>
              {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Guardar cambios
            </Button>
          </div>
        </form>
      )}

      {/* Stock Tab */}
      {tab === 'stock' && (
        <div className="space-y-4">
          {/* Adjust stock */}
          <div className="rounded-lg border border-stone-200 bg-white p-6">
            <h3 className="font-semibold text-stone-900 mb-3">Ajustar stock</h3>
            <p className="text-sm text-stone-500 mb-3">
              Corregí el stock actual si hay diferencia con el conteo real.
            </p>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div>
                <label className="block text-xs text-stone-500 mb-1">Nuevo valor de stock</label>
                <input
                  type="number"
                  step="0.001"
                  min="0"
                  value={adjustQty}
                  onChange={(e) => setAdjustQty(e.target.value)}
                  className="w-full rounded-md border border-stone-300 px-3 py-2 text-sm focus:border-stone-500 focus:outline-none focus:ring-1 focus:ring-stone-500"
                />
              </div>
              <div>
                <label className="block text-xs text-stone-500 mb-1">Motivo *</label>
                <input
                  type="text"
                  value={adjustNotes}
                  onChange={(e) => setAdjustNotes(e.target.value)}
                  placeholder="Ej: Conteo físico"
                  className="w-full rounded-md border border-stone-300 px-3 py-2 text-sm focus:border-stone-500 focus:outline-none focus:ring-1 focus:ring-stone-500"
                />
              </div>
            </div>
            <div className="mt-3 flex justify-end">
              <Button size="sm" onClick={handleAdjust} disabled={saving}>
                Ajustar stock
              </Button>
            </div>
          </div>

          {/* Register purchase */}
          <div className="rounded-lg border border-stone-200 bg-white p-6">
            <h3 className="font-semibold text-stone-900 mb-3">Registrar compra</h3>
            <p className="text-sm text-stone-500 mb-3">
              Sumá stock cuando comprás materia prima.
            </p>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              <div>
                <label className="block text-xs text-stone-500 mb-1">Cantidad</label>
                <input
                  type="number"
                  step="0.001"
                  min="0"
                  value={purchaseQty}
                  onChange={(e) => setPurchaseQty(e.target.value)}
                  placeholder="0"
                  className="w-full rounded-md border border-stone-300 px-3 py-2 text-sm focus:border-stone-500 focus:outline-none focus:ring-1 focus:ring-stone-500"
                />
              </div>
              <div>
                <label className="block text-xs text-stone-500 mb-1">Costo por unidad ($)</label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  value={purchaseCost}
                  onChange={(e) => setPurchaseCost(e.target.value)}
                  placeholder="0"
                  className="w-full rounded-md border border-stone-300 px-3 py-2 text-sm focus:border-stone-500 focus:outline-none focus:ring-1 focus:ring-stone-500"
                />
              </div>
              <div>
                <label className="block text-xs text-stone-500 mb-1">Nota (opcional)</label>
                <input
                  type="text"
                  value={purchaseNotes}
                  onChange={(e) => setPurchaseNotes(e.target.value)}
                  placeholder="Ej: Proveedor X"
                  className="w-full rounded-md border border-stone-300 px-3 py-2 text-sm focus:border-stone-500 focus:outline-none focus:ring-1 focus:ring-stone-500"
                />
              </div>
            </div>
            <div className="mt-3 flex justify-end">
              <Button size="sm" onClick={handlePurchase} disabled={saving}>
                <Plus className="mr-1 h-3 w-3" /> Registrar compra
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* History Tab */}
      {tab === 'historial' && (
        <div className="rounded-lg border border-stone-200 bg-white overflow-hidden">
          {movements.length === 0 ? (
            <p className="px-6 py-8 text-center text-sm text-stone-500">Sin movimientos registrados.</p>
          ) : (
            <table className="w-full text-sm">
              <thead className="border-b border-stone-200 bg-stone-50">
                <tr>
                  <th className="px-4 py-3 text-left font-medium text-stone-500">Fecha</th>
                  <th className="px-4 py-3 text-left font-medium text-stone-500">Tipo</th>
                  <th className="px-4 py-3 text-left font-medium text-stone-500">Cantidad</th>
                  <th className="px-4 py-3 text-left font-medium text-stone-500">Notas</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-stone-200">
                {movements.map((mov) => (
                  <tr key={mov.id} className="hover:bg-stone-50">
                    <td className="px-4 py-3 text-stone-500">{formatDateTime(mov.created_at)}</td>
                    <td className="px-4 py-3 text-stone-900">
                      {MOVEMENT_TYPE_LABELS[mov.movement_type as MovementType] || mov.movement_type}
                    </td>
                    <td className={`px-4 py-3 font-medium ${mov.quantity >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                      {mov.quantity >= 0 ? '+' : ''}{mov.quantity}
                    </td>
                    <td className="px-4 py-3 text-stone-500 max-w-xs truncate">{mov.notes || '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}
    </div>
  );
}
