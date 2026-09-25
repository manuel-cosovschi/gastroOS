'use server';

import { revalidatePath } from 'next/cache';
import { createServerClient } from '@/lib/supabase/server';
import { requireBusinessId } from '@/lib/business';
import { getProductUnitCosts } from '@/lib/production-cost';
import { round2, slugify } from '@/lib/utils';
import { productSchema } from '@/lib/validations/product';
import type {
  CreateProductInput,
  Product,
  ProductFilters,
  ProductWithMargin,
  UpdateProductInput,
} from '@/types';

export async function listProducts(filters: ProductFilters = {}): Promise<Product[]> {
  const businessId = await requireBusinessId();
  const supabase = await createServerClient();

  let query = supabase
    .from('products')
    .select('*, category:categories(*)')
    .eq('business_id', businessId)
    .order('sort_order')
    .order('name');

  if (filters.category_id) query = query.eq('category_id', filters.category_id);
  if (filters.is_active !== undefined) query = query.eq('is_active', filters.is_active);
  if (filters.search?.trim()) query = query.ilike('name', `%${filters.search.trim()}%`);

  const { data } = await query;
  return (data as Product[]) || [];
}

/** Productos con costo y margen ya resueltos, para la grilla del panel. */
export async function listProductsWithMargin(
  filters: ProductFilters = {}
): Promise<ProductWithMargin[]> {
  const products = await listProducts(filters);
  if (products.length === 0) return [];

  const costs = await getProductUnitCosts(products.map((p) => p.id));

  return products.map((product) => {
    const unitCost = costs.get(product.id) ?? 0;
    const price = Number(product.price);
    const margin = round2(price - unitCost);
    return {
      ...product,
      unit_cost: unitCost,
      margin,
      margin_pct: price > 0 ? round2((margin / price) * 100) : 0,
    };
  });
}

export async function getProduct(id: string): Promise<Product | null> {
  const businessId = await requireBusinessId();
  const supabase = await createServerClient();
  const { data } = await supabase
    .from('products')
    .select('*, category:categories(*)')
    .eq('id', id)
    .eq('business_id', businessId)
    .maybeSingle();
  return (data as Product) || null;
}

export async function createProduct(
  input: CreateProductInput
): Promise<{ success: boolean; product?: Product; error?: string }> {
  const parsed = productSchema.safeParse(input);
  if (!parsed.success) return { success: false, error: parsed.error.errors[0].message };

  const businessId = await requireBusinessId();
  const supabase = await createServerClient();

  const { data, error } = await supabase
    .from('products')
    .insert({ ...parsed.data, business_id: businessId, slug: slugify(input.name) })
    .select()
    .single();

  if (error || !data) {
    if (error?.code === '23505') return { success: false, error: 'Ya existe un producto con ese nombre.' };
    return { success: false, error: 'No se pudo crear el producto.' };
  }

  revalidateProductViews();
  return { success: true, product: data as Product };
}

export async function updateProduct(
  id: string,
  input: UpdateProductInput
): Promise<{ success: boolean; product?: Product; error?: string }> {
  const businessId = await requireBusinessId();
  const supabase = await createServerClient();

  const patch: Record<string, unknown> = { ...input };
  if (input.name) patch.slug = slugify(input.name);

  const { data, error } = await supabase
    .from('products')
    .update(patch)
    .eq('id', id)
    .eq('business_id', businessId)
    .select()
    .single();

  if (error) {
    if (error.code === '23505') return { success: false, error: 'Ya existe un producto con ese nombre.' };
    return { success: false, error: 'No se pudo actualizar el producto.' };
  }

  revalidateProductViews(id);
  return { success: true, product: data as Product };
}

export async function toggleProductActive(
  id: string
): Promise<{ success: boolean; error?: string }> {
  const businessId = await requireBusinessId();
  const supabase = await createServerClient();

  const { data: product } = await supabase
    .from('products')
    .select('is_active')
    .eq('id', id)
    .eq('business_id', businessId)
    .maybeSingle();

  if (!product) return { success: false, error: 'Producto no encontrado.' };

  const { error } = await supabase
    .from('products')
    .update({ is_active: !product.is_active })
    .eq('id', id);

  if (error) return { success: false, error: 'No se pudo cambiar el estado.' };

  revalidateProductViews(id);
  return { success: true };
}

export async function deleteProduct(id: string): Promise<{ success: boolean; error?: string }> {
  const businessId = await requireBusinessId();
  const supabase = await createServerClient();

  const { error } = await supabase
    .from('products')
    .delete()
    .eq('id', id)
    .eq('business_id', businessId);

  if (error) {
    return {
      success: false,
      error: 'No se pudo eliminar. Puede estar en un combo o en un pedido: desactivalo en su lugar.',
    };
  }

  revalidateProductViews();
  return { success: true };
}

/** Ajusta el stock de producto terminado y registra el movimiento. */
export async function adjustProductStock(
  id: string,
  newQuantity: number,
  notes?: string
): Promise<{ success: boolean; error?: string }> {
  const businessId = await requireBusinessId();
  const supabase = await createServerClient();

  const { data: product } = await supabase
    .from('products')
    .select('stock_quantity')
    .eq('id', id)
    .eq('business_id', businessId)
    .maybeSingle();

  if (!product) return { success: false, error: 'Producto no encontrado.' };

  const diff = newQuantity - Number(product.stock_quantity);
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { error } = await supabase
    .from('products')
    .update({ stock_quantity: newQuantity })
    .eq('id', id);

  if (error) return { success: false, error: 'No se pudo ajustar el stock.' };

  await supabase.from('stock_movements').insert({
    business_id: businessId,
    reference_type: 'product',
    reference_id: id,
    movement_type: diff > 0 ? 'production' : 'adjustment',
    quantity: diff,
    notes: notes || (diff > 0 ? 'Producción registrada' : 'Ajuste manual'),
    created_by: user?.id || null,
  });

  revalidateProductViews(id);
  revalidatePath('/admin/stock');
  return { success: true };
}

function revalidateProductViews(id?: string) {
  revalidatePath('/admin/productos');
  if (id) revalidatePath(`/admin/productos/${id}`);
  revalidatePath('/catalogo');
  revalidatePath('/admin');
}
