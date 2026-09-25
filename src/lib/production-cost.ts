import { createServerClient } from '@/lib/supabase/server';
import { round2 } from '@/lib/utils';

/**
 * Costo unitario de producción por producto.
 *
 * Prioridad: `cost_override` cargado a mano; si no está, se suma la receta
 * (insumo × costo unitario) y se divide por `batch_size`. Sin override ni
 * receta el costo es 0 y el margen queda igual al precio: el dashboard avisa
 * de los productos sin costo para que no pase desapercibido.
 */
export async function getProductUnitCosts(productIds: string[]): Promise<Map<string, number>> {
  const result = new Map<string, number>();
  const ids = Array.from(new Set(productIds.filter(Boolean)));
  if (ids.length === 0) return result;

  const supabase = await createServerClient();

  const { data: products } = await supabase
    .from('products')
    .select('id, cost_override, batch_size')
    .in('id', ids);

  if (!products) return result;

  const needsRecipe: { id: string; batch_size: number }[] = [];

  for (const product of products) {
    if (product.cost_override != null && Number(product.cost_override) > 0) {
      result.set(product.id, Number(product.cost_override));
    } else {
      needsRecipe.push({ id: product.id, batch_size: product.batch_size || 1 });
      result.set(product.id, 0);
    }
  }

  if (needsRecipe.length > 0) {
    const { data: recipes } = await supabase
      .from('recipe_items')
      .select('product_id, quantity_per_batch, ingredient:ingredients(cost_per_unit)')
      .in(
        'product_id',
        needsRecipe.map((p) => p.id)
      );

    const batchCostByProduct = new Map<string, number>();
    for (const item of recipes || []) {
      const ingredient = item.ingredient as unknown as { cost_per_unit: number } | null;
      const lineCost = Number(item.quantity_per_batch) * Number(ingredient?.cost_per_unit || 0);
      batchCostByProduct.set(
        item.product_id,
        (batchCostByProduct.get(item.product_id) || 0) + lineCost
      );
    }

    for (const product of needsRecipe) {
      const batchCost = batchCostByProduct.get(product.id) || 0;
      if (batchCost > 0) {
        result.set(product.id, round2(batchCost / product.batch_size));
      }
    }
  }

  return result;
}

/** Costo unitario de un combo: suma del costo de cada producto × su cantidad. */
export async function getPackageUnitCosts(packageIds: string[]): Promise<Map<string, number>> {
  const result = new Map<string, number>();
  const ids = Array.from(new Set(packageIds.filter(Boolean)));
  if (ids.length === 0) return result;

  const supabase = await createServerClient();
  ids.forEach((id) => result.set(id, 0));

  const { data: items } = await supabase
    .from('package_items')
    .select('package_id, product_id, quantity')
    .in('package_id', ids);

  if (!items || items.length === 0) return result;

  const productCosts = await getProductUnitCosts(items.map((i) => i.product_id));

  for (const item of items) {
    const productCost = productCosts.get(item.product_id) || 0;
    result.set(item.package_id, (result.get(item.package_id) || 0) + productCost * item.quantity);
  }

  for (const [id, value] of result) result.set(id, round2(value));
  return result;
}
