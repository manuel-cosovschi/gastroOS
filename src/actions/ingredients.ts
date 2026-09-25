'use server';

import { revalidatePath } from 'next/cache';
import { createServerClient } from '@/lib/supabase/server';
import { requireBusinessId } from '@/lib/business';
import type {
  CreateIngredientInput,
  Ingredient,
  RecipeItem,
  StockAdjustment,
  StockMovement,
  UpdateIngredientInput,
} from '@/types';

// ============================================
// Insumos
// ============================================

export async function listIngredients(onlyActive = false): Promise<Ingredient[]> {
  const businessId = await requireBusinessId();
  const supabase = await createServerClient();

  let query = supabase
    .from('ingredients')
    .select('*')
    .eq('business_id', businessId)
    .order('name');

  if (onlyActive) query = query.eq('is_active', true);

  const { data } = await query;
  return (data as Ingredient[]) || [];
}

export async function getIngredient(id: string): Promise<Ingredient | null> {
  const businessId = await requireBusinessId();
  const supabase = await createServerClient();
  const { data } = await supabase
    .from('ingredients')
    .select('*')
    .eq('id', id)
    .eq('business_id', businessId)
    .maybeSingle();
  return (data as Ingredient) || null;
}

export async function createIngredient(
  input: CreateIngredientInput
): Promise<{ success: boolean; ingredient?: Ingredient; error?: string }> {
  if (!input.name?.trim()) return { success: false, error: 'El nombre es obligatorio.' };

  const businessId = await requireBusinessId();
  const supabase = await createServerClient();

  const { data, error } = await supabase
    .from('ingredients')
    .insert({
      business_id: businessId,
      name: input.name.trim(),
      unit: input.unit || 'unidad',
      category: input.category?.trim() || null,
      stock_quantity: input.stock_quantity ?? 0,
      min_stock_quantity: input.min_stock_quantity ?? 0,
      cost_per_unit: input.cost_per_unit ?? 0,
      supplier: input.supplier?.trim() || null,
      notes: input.notes?.trim() || null,
    })
    .select()
    .single();

  if (error || !data) {
    if (error?.code === '23505') return { success: false, error: 'Ya existe un insumo con ese nombre.' };
    return { success: false, error: 'No se pudo crear el insumo.' };
  }

  if ((input.stock_quantity ?? 0) > 0) {
    await supabase.from('stock_movements').insert({
      business_id: businessId,
      reference_type: 'ingredient',
      reference_id: data.id,
      movement_type: 'adjustment',
      quantity: input.stock_quantity,
      unit_cost: input.cost_per_unit ?? 0,
      notes: 'Stock inicial',
    });
  }

  revalidateStockViews();
  return { success: true, ingredient: data as Ingredient };
}

export async function updateIngredient(
  id: string,
  input: UpdateIngredientInput
): Promise<{ success: boolean; error?: string }> {
  const businessId = await requireBusinessId();
  const supabase = await createServerClient();

  const { error } = await supabase
    .from('ingredients')
    .update(input)
    .eq('id', id)
    .eq('business_id', businessId);

  if (error) {
    if (error.code === '23505') return { success: false, error: 'Ya existe un insumo con ese nombre.' };
    return { success: false, error: 'No se pudo actualizar el insumo.' };
  }

  revalidateStockViews(id);
  return { success: true };
}

export async function deleteIngredient(id: string): Promise<{ success: boolean; error?: string }> {
  const businessId = await requireBusinessId();
  const supabase = await createServerClient();

  const { error } = await supabase
    .from('ingredients')
    .delete()
    .eq('id', id)
    .eq('business_id', businessId);

  if (error) return { success: false, error: 'No se pudo eliminar el insumo.' };

  revalidateStockViews();
  return { success: true };
}

/** Fija el stock a un valor y deja el movimiento de ajuste correspondiente. */
export async function adjustIngredientStock(
  id: string,
  adjustment: StockAdjustment
): Promise<{ success: boolean; error?: string }> {
  const businessId = await requireBusinessId();
  const supabase = await createServerClient();

  const { data: ingredient } = await supabase
    .from('ingredients')
    .select('stock_quantity')
    .eq('id', id)
    .eq('business_id', businessId)
    .maybeSingle();

  if (!ingredient) return { success: false, error: 'Insumo no encontrado.' };

  const diff = adjustment.new_quantity - Number(ingredient.stock_quantity);

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { error } = await supabase
    .from('ingredients')
    .update({ stock_quantity: adjustment.new_quantity })
    .eq('id', id);

  if (error) return { success: false, error: 'No se pudo ajustar el stock.' };

  await supabase.from('stock_movements').insert({
    business_id: businessId,
    reference_type: 'ingredient',
    reference_id: id,
    movement_type: 'adjustment',
    quantity: diff,
    notes: adjustment.notes || 'Ajuste manual',
    created_by: user?.id || null,
  });

  revalidateStockViews(id);
  return { success: true };
}

/** Suma stock y actualiza el costo unitario al precio de la compra. */
export async function registerPurchase(
  ingredientId: string,
  quantity: number,
  unitCost: number,
  notes?: string
): Promise<{ success: boolean; error?: string }> {
  if (quantity <= 0) return { success: false, error: 'La cantidad tiene que ser mayor a cero.' };

  const businessId = await requireBusinessId();
  const supabase = await createServerClient();

  const { data: ingredient } = await supabase
    .from('ingredients')
    .select('stock_quantity')
    .eq('id', ingredientId)
    .eq('business_id', businessId)
    .maybeSingle();

  if (!ingredient) return { success: false, error: 'Insumo no encontrado.' };

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { error } = await supabase
    .from('ingredients')
    .update({
      stock_quantity: Number(ingredient.stock_quantity) + quantity,
      cost_per_unit: unitCost,
    })
    .eq('id', ingredientId);

  if (error) return { success: false, error: 'No se pudo registrar la compra.' };

  await supabase.from('stock_movements').insert({
    business_id: businessId,
    reference_type: 'ingredient',
    reference_id: ingredientId,
    movement_type: 'purchase',
    quantity,
    unit_cost: unitCost,
    notes: notes || 'Compra registrada',
    created_by: user?.id || null,
  });

  revalidateStockViews(ingredientId);
  return { success: true };
}

export async function getIngredientMovements(
  ingredientId: string,
  limit = 30
): Promise<StockMovement[]> {
  const businessId = await requireBusinessId();
  const supabase = await createServerClient();
  const { data } = await supabase
    .from('stock_movements')
    .select('*')
    .eq('business_id', businessId)
    .eq('reference_type', 'ingredient')
    .eq('reference_id', ingredientId)
    .order('created_at', { ascending: false })
    .limit(limit);
  return (data as StockMovement[]) || [];
}

// ============================================
// Recetas
// ============================================

export async function getProductRecipe(productId: string): Promise<RecipeItem[]> {
  const supabase = await createServerClient();
  const { data } = await supabase
    .from('recipe_items')
    .select('*, ingredient:ingredients(*)')
    .eq('product_id', productId);
  return (data as RecipeItem[]) || [];
}

export async function saveProductRecipe(
  productId: string,
  batchSize: number,
  items: { ingredient_id: string; quantity_per_batch: number }[]
): Promise<{ success: boolean; error?: string }> {
  const businessId = await requireBusinessId();
  const supabase = await createServerClient();

  const { data: product } = await supabase
    .from('products')
    .select('id')
    .eq('id', productId)
    .eq('business_id', businessId)
    .maybeSingle();

  if (!product) return { success: false, error: 'Producto no encontrado.' };

  await supabase
    .from('products')
    .update({ batch_size: Math.max(1, batchSize) })
    .eq('id', productId);

  // Reemplazo completo: es más simple y más fiable que diferenciar altas/bajas.
  await supabase.from('recipe_items').delete().eq('product_id', productId);

  const valid = items.filter((item) => item.ingredient_id && item.quantity_per_batch > 0);
  if (valid.length > 0) {
    const { error } = await supabase
      .from('recipe_items')
      .insert(valid.map((item) => ({ ...item, product_id: productId })));
    if (error) return { success: false, error: 'No se pudo guardar la receta.' };
  }

  revalidatePath(`/admin/productos/${productId}`);
  revalidatePath('/admin/stock');
  return { success: true };
}

function revalidateStockViews(ingredientId?: string) {
  revalidatePath('/admin');
  revalidatePath('/admin/stock');
  if (ingredientId) revalidatePath(`/admin/stock/${ingredientId}`);
}
