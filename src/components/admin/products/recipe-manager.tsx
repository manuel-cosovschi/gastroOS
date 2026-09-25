'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { saveProductRecipe } from '@/actions/ingredients';
import type { RecipeItem, Ingredient } from '@/types';
import { Plus, Trash2, Loader2 } from 'lucide-react';
import { toast } from 'sonner';

interface RecipeManagerProps {
  productId: string;
  productName: string;
  batchSize: number;
  currentRecipe: RecipeItem[];
  availableIngredients: Ingredient[];
}

export function RecipeManager({
  productId,
  productName,
  batchSize: initialBatchSize,
  currentRecipe,
  availableIngredients,
}: RecipeManagerProps) {
  const [batchSize, setBatchSize] = useState(initialBatchSize);
  const [items, setItems] = useState(
    currentRecipe.map((r) => ({
      ingredient_id: r.ingredient_id,
      quantity_per_batch: r.quantity_per_batch,
    }))
  );
  const [saving, setSaving] = useState(false);

  const addItem = () => {
    const unusedIngredient = availableIngredients.find(
      (ing) => !items.some((item) => item.ingredient_id === ing.id)
    );
    if (unusedIngredient) {
      setItems([...items, { ingredient_id: unusedIngredient.id, quantity_per_batch: 0 }]);
    }
  };

  const removeItem = (index: number) => {
    setItems(items.filter((_, i) => i !== index));
  };

  const updateItem = (index: number, field: string, value: string | number) => {
    const newItems = [...items];
    newItems[index] = { ...newItems[index], [field]: value };
    setItems(newItems);
  };

  const handleSave = async () => {
    setSaving(true);
    const result = await saveProductRecipe(productId, batchSize, items.filter((i) => i.quantity_per_batch > 0));
    if (result.success) {
      toast.success('Receta guardada');
    } else {
      toast.error(result.error || 'Error al guardar receta');
    }
    setSaving(false);
  };

  const getIngredientUnit = (id: string) =>
    availableIngredients.find((i) => i.id === id)?.unit || '';

  return (
    <div className="rounded-lg border border-stone-200 bg-white p-6 space-y-4">
      <div>
        <h2 className="text-lg font-semibold text-stone-900">Receta</h2>
        <p className="text-sm text-stone-500">
          Ingredientes necesarios para producir {productName}
        </p>
      </div>

      <div className="flex items-center gap-4">
        <div>
          <label className="block text-sm font-medium text-stone-700 mb-1">
            Unidades por lote (batch)
          </label>
          <input
            type="number"
            min="1"
            value={batchSize}
            onChange={(e) => setBatchSize(Number(e.target.value) || 1)}
            className="w-32 rounded-md border border-stone-300 px-3 py-2 text-sm focus:border-stone-500 focus:outline-none focus:ring-1 focus:ring-stone-500"
          />
        </div>
        <p className="text-xs text-stone-400 mt-6">
          Ej: si un lote de cookies produce 24 cookies, poner 24
        </p>
      </div>

      {items.length > 0 && (
        <div className="space-y-2">
          {items.map((item, index) => (
            <div key={index} className="flex items-center gap-3">
              <select
                value={item.ingredient_id}
                onChange={(e) => updateItem(index, 'ingredient_id', e.target.value)}
                className="flex-1 rounded-md border border-stone-300 px-3 py-2 text-sm focus:border-stone-500 focus:outline-none focus:ring-1 focus:ring-stone-500"
              >
                {availableIngredients.map((ing) => (
                  <option key={ing.id} value={ing.id}>{ing.name} ({ing.unit})</option>
                ))}
              </select>
              <input
                type="number"
                step="0.001"
                min="0"
                value={item.quantity_per_batch}
                onChange={(e) => updateItem(index, 'quantity_per_batch', Number(e.target.value))}
                className="w-28 rounded-md border border-stone-300 px-3 py-2 text-sm focus:border-stone-500 focus:outline-none focus:ring-1 focus:ring-stone-500"
                placeholder="Cantidad"
              />
              <span className="text-xs text-stone-500 w-12">
                {getIngredientUnit(item.ingredient_id)}
              </span>
              <button onClick={() => removeItem(index)} className="text-stone-400 hover:text-red-500">
                <Trash2 className="h-4 w-4" />
              </button>
            </div>
          ))}
        </div>
      )}

      {items.length === 0 && (
        <p className="text-sm text-stone-400 py-2">
          No hay ingredientes en la receta. Agregá al menos uno.
        </p>
      )}

      <div className="flex items-center justify-between pt-2">
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={addItem}
          disabled={items.length >= availableIngredients.length}
        >
          <Plus className="mr-1 h-3 w-3" /> Agregar ingrediente
        </Button>
        <Button size="sm" onClick={handleSave} disabled={saving}>
          {saving && <Loader2 className="mr-1 h-3 w-3 animate-spin" />}
          Guardar receta
        </Button>
      </div>
    </div>
  );
}
