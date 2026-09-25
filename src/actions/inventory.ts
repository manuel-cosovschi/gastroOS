'use server';

import { createServerClient } from '@/lib/supabase/server';
import { requireBusinessId } from '@/lib/business';
import { round2 } from '@/lib/utils';
import type {
  InventoryValuation,
  PurchaseSuggestion,
  StockAlert,
  StockMovement,
} from '@/types';

/**
 * Análisis de stock: alertas, valorización, sugerencias de compra y el
 * descuento automático al confirmar un pedido.
 */

// ============================================
// Alertas
// ============================================

export async function generateStockAlerts(businessId?: string): Promise<StockAlert[]> {
  const id = businessId || (await requireBusinessId());
  const supabase = await createServerClient();
  const alerts: StockAlert[] = [];

  // Postgres no compara dos columnas desde el query builder, así que traemos
  // los activos (son pocas filas) y comparamos en memoria.
  const [{ data: ingredients }, { data: products }, { data: recipes }] = await Promise.all([
    supabase
      .from('ingredients')
      .select('id, name, stock_quantity, min_stock_quantity, unit')
      .eq('business_id', id)
      .eq('is_active', true),
    supabase
      .from('products')
      .select('id, name, stock_quantity, min_stock_quantity, sale_unit, cost_override')
      .eq('business_id', id)
      .eq('is_active', true),
    supabase.from('recipe_items').select('product_id'),
  ]);

  for (const ingredient of ingredients || []) {
    if (Number(ingredient.stock_quantity) < Number(ingredient.min_stock_quantity)) {
      alerts.push({
        type: 'low_ingredient',
        severity: Number(ingredient.stock_quantity) <= 0 ? 'critical' : 'warning',
        message: `${ingredient.name}: quedan ${formatQty(ingredient.stock_quantity)} ${ingredient.unit} (mínimo ${formatQty(ingredient.min_stock_quantity)})`,
        reference_id: ingredient.id,
        reference_name: ingredient.name,
      });
    }
  }

  for (const product of products || []) {
    if (
      Number(product.min_stock_quantity) > 0 &&
      Number(product.stock_quantity) < Number(product.min_stock_quantity)
    ) {
      alerts.push({
        type: 'low_product',
        severity: Number(product.stock_quantity) <= 0 ? 'critical' : 'warning',
        message: `${product.name}: quedan ${product.stock_quantity} ${product.sale_unit} (mínimo ${product.min_stock_quantity})`,
        reference_id: product.id,
        reference_name: product.name,
      });
    }
  }

  // Un producto sin receta ni costo cargado no aporta margen real a las estadísticas.
  const withRecipe = new Set((recipes || []).map((r) => r.product_id));
  for (const product of products || []) {
    if (!withRecipe.has(product.id) && !product.cost_override) {
      alerts.push({
        type: 'missing_recipe',
        severity: 'warning',
        message: `${product.name} no tiene costo cargado: su margen no se calcula`,
        reference_id: product.id,
        reference_name: product.name,
      });
    }
  }

  return alerts;
}

// ============================================
// Valorización
// ============================================

export async function getInventoryValuation(businessId?: string): Promise<InventoryValuation> {
  const id = businessId || (await requireBusinessId());
  const supabase = await createServerClient();

  const [{ data: ingredients }, { data: products }, { data: recipes }] = await Promise.all([
    supabase
      .from('ingredients')
      .select('stock_quantity, cost_per_unit')
      .eq('business_id', id)
      .eq('is_active', true),
    supabase
      .from('products')
      .select('id, stock_quantity, cost_override, batch_size')
      .eq('business_id', id)
      .eq('is_active', true),
    supabase.from('recipe_items').select('product_id, quantity_per_batch, ingredient:ingredients(cost_per_unit)'),
  ]);

  const ingredientsValue = (ingredients || []).reduce(
    (sum, item) => sum + Number(item.stock_quantity) * Number(item.cost_per_unit),
    0
  );

  // Costo por lote de cada producto, resuelto de una sola pasada sobre las recetas
  const batchCost = new Map<string, number>();
  for (const item of recipes || []) {
    const ingredient = item.ingredient as unknown as { cost_per_unit: number } | null;
    batchCost.set(
      item.product_id,
      (batchCost.get(item.product_id) || 0) +
        Number(item.quantity_per_batch) * Number(ingredient?.cost_per_unit || 0)
    );
  }

  let productsValue = 0;
  for (const product of products || []) {
    const stock = Number(product.stock_quantity);
    if (stock <= 0) continue;

    if (product.cost_override) {
      productsValue += stock * Number(product.cost_override);
    } else {
      const cost = batchCost.get(product.id);
      if (cost) productsValue += stock * (cost / (product.batch_size || 1));
    }
  }

  return {
    ingredients_value: round2(ingredientsValue),
    products_value: round2(productsValue),
    total_value: round2(ingredientsValue + productsValue),
  };
}

// ============================================
// Sugerencias de compra
// ============================================

export async function getPurchaseSuggestions(): Promise<PurchaseSuggestion[]> {
  const businessId = await requireBusinessId();
  const supabase = await createServerClient();

  const { data: ingredients } = await supabase
    .from('ingredients')
    .select('id, name, unit, stock_quantity, min_stock_quantity, cost_per_unit')
    .eq('business_id', businessId)
    .eq('is_active', true);

  return (ingredients || [])
    .filter((item) => Number(item.stock_quantity) < Number(item.min_stock_quantity))
    .map((item) => {
      const toBuy = Math.max(0, Number(item.min_stock_quantity) - Number(item.stock_quantity));
      return {
        ingredient_id: item.id,
        ingredient_name: item.name,
        unit: item.unit,
        current_stock: Number(item.stock_quantity),
        needed: Number(item.min_stock_quantity),
        to_buy: round2(toBuy),
        estimated_cost: round2(toBuy * Number(item.cost_per_unit)),
      };
    })
    .sort((a, b) => b.estimated_cost - a.estimated_cost);
}

// ============================================
// Descuento de stock al confirmar un pedido
// ============================================

/**
 * Descuenta del stock lo que consume un pedido.
 *
 * Primero usa producto terminado; lo que falte se produce, y esa producción
 * consume insumos según la receta. Cada paso queda registrado en
 * `stock_movements`, así que el stock siempre se puede reconstruir.
 *
 * No falla el pedido si el stock no alcanza: devuelve avisos. Un negocio chico
 * carga un pedido y produce después — bloquearlo sería pelearse con la realidad.
 */
export async function applyStockForOrder(
  businessId: string,
  orderId: string
): Promise<{ success: boolean; warnings?: string[] }> {
  const supabase = await createServerClient();
  const warnings: string[] = [];

  const { data: order } = await supabase
    .from('orders')
    .select('id, order_number')
    .eq('id', orderId)
    .eq('business_id', businessId)
    .maybeSingle();

  if (!order) return { success: false };

  const { data: items } = await supabase
    .from('order_items')
    .select('product_id, package_id, item_name, quantity')
    .eq('order_id', orderId);

  if (!items?.length) return { success: true };

  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Un combo consume los productos que lo componen
  const lines: { product_id: string; quantity: number }[] = [];
  const packageIds = items.filter((i) => i.package_id).map((i) => i.package_id!);

  if (packageIds.length > 0) {
    const { data: packageItems } = await supabase
      .from('package_items')
      .select('package_id, product_id, quantity')
      .in('package_id', packageIds);

    for (const item of items) {
      if (!item.package_id) continue;
      for (const packageItem of packageItems || []) {
        if (packageItem.package_id === item.package_id) {
          lines.push({
            product_id: packageItem.product_id,
            quantity: packageItem.quantity * item.quantity,
          });
        }
      }
    }
  }

  for (const item of items) {
    if (item.product_id) lines.push({ product_id: item.product_id, quantity: item.quantity });
  }

  // Consolidamos por producto para no hacer dos updates sobre la misma fila
  const needByProduct = new Map<string, number>();
  for (const line of lines) {
    needByProduct.set(line.product_id, (needByProduct.get(line.product_id) || 0) + line.quantity);
  }
  if (needByProduct.size === 0) return { success: true };

  const { data: products } = await supabase
    .from('products')
    .select('id, name, stock_quantity, batch_size')
    .eq('business_id', businessId)
    .in('id', Array.from(needByProduct.keys()));

  const { data: recipes } = await supabase
    .from('recipe_items')
    .select('product_id, ingredient_id, quantity_per_batch, ingredient:ingredients(id, name, unit, stock_quantity, min_stock_quantity)')
    .in('product_id', Array.from(needByProduct.keys()));

  // Consumo total por insumo, para actualizar cada uno una sola vez
  const ingredientConsumption = new Map<
    string,
    { consumption: number; name: string; unit: string; stock: number; min: number }
  >();

  for (const product of products || []) {
    const needed = needByProduct.get(product.id) || 0;
    const available = Number(product.stock_quantity);
    const fromStock = Math.min(Math.max(available, 0), needed);

    if (fromStock > 0) {
      await supabase
        .from('products')
        .update({ stock_quantity: available - fromStock })
        .eq('id', product.id);

      await supabase.from('stock_movements').insert({
        business_id: businessId,
        reference_type: 'product',
        reference_id: product.id,
        movement_type: 'order_deduction',
        quantity: -fromStock,
        order_id: orderId,
        notes: `Pedido #${order.order_number}: ${fromStock} × ${product.name}`,
        created_by: user?.id || null,
      });
    }

    const toProduce = needed - fromStock;
    if (toProduce <= 0) continue;

    const productRecipe = (recipes || []).filter((r) => r.product_id === product.id);
    if (productRecipe.length === 0) {
      warnings.push(`${product.name}: sin receta cargada, no se descontaron insumos.`);
      continue;
    }

    const batches = Math.ceil(toProduce / (product.batch_size || 1));
    for (const recipeItem of productRecipe) {
      const ingredient = recipeItem.ingredient as unknown as {
        id: string;
        name: string;
        unit: string;
        stock_quantity: number;
        min_stock_quantity: number;
      } | null;
      if (!ingredient) continue;

      const entry = ingredientConsumption.get(ingredient.id) || {
        consumption: 0,
        name: ingredient.name,
        unit: ingredient.unit,
        stock: Number(ingredient.stock_quantity),
        min: Number(ingredient.min_stock_quantity),
      };
      entry.consumption += Number(recipeItem.quantity_per_batch) * batches;
      ingredientConsumption.set(ingredient.id, entry);
    }
  }

  for (const [ingredientId, entry] of ingredientConsumption) {
    const newStock = round2(entry.stock - entry.consumption);

    await supabase
      .from('ingredients')
      .update({ stock_quantity: newStock })
      .eq('id', ingredientId);

    await supabase.from('stock_movements').insert({
      business_id: businessId,
      reference_type: 'ingredient',
      reference_id: ingredientId,
      movement_type: 'production_consumption',
      quantity: -round2(entry.consumption),
      order_id: orderId,
      notes: `Pedido #${order.order_number}`,
      created_by: user?.id || null,
    });

    if (newStock < 0) {
      warnings.push(`${entry.name}: stock negativo (${newStock} ${entry.unit}). Reponé antes de producir.`);
    } else if (newStock < entry.min) {
      warnings.push(`${entry.name}: quedó bajo el mínimo (${newStock} ${entry.unit}).`);
    }
  }

  return { success: true, warnings: warnings.length > 0 ? warnings : undefined };
}

// ============================================
// Movimientos
// ============================================

export async function getRecentMovements(limit = 25): Promise<StockMovement[]> {
  const businessId = await requireBusinessId();
  const supabase = await createServerClient();
  const { data } = await supabase
    .from('stock_movements')
    .select('*')
    .eq('business_id', businessId)
    .order('created_at', { ascending: false })
    .limit(limit);
  return (data as StockMovement[]) || [];
}

function formatQty(value: number | string): string {
  const num = Number(value);
  return Number.isInteger(num) ? String(num) : num.toFixed(2);
}
