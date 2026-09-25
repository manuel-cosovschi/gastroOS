'use server';

import { revalidatePath } from 'next/cache';
import { createServerClient } from '@/lib/supabase/server';
import { requireBusinessId } from '@/lib/business';
import { slugify } from '@/lib/utils';
import type { Category, CreateCategoryInput, UpdateCategoryInput } from '@/types';

export async function listCategories(): Promise<Category[]> {
  const businessId = await requireBusinessId();
  const supabase = await createServerClient();
  const { data } = await supabase
    .from('categories')
    .select('*')
    .eq('business_id', businessId)
    .order('sort_order')
    .order('name');
  return (data as Category[]) || [];
}

export async function createCategory(
  input: CreateCategoryInput
): Promise<{ success: boolean; error?: string }> {
  if (!input.name?.trim()) return { success: false, error: 'El nombre es obligatorio.' };

  const businessId = await requireBusinessId();
  const supabase = await createServerClient();

  const { error } = await supabase.from('categories').insert({
    business_id: businessId,
    name: input.name.trim(),
    slug: slugify(input.name),
    description: input.description?.trim() || null,
    sort_order: input.sort_order || 0,
  });

  if (error) {
    if (error.code === '23505') return { success: false, error: 'Ya existe una categoría con ese nombre.' };
    return { success: false, error: 'No se pudo crear la categoría.' };
  }

  revalidateCategoryViews();
  return { success: true };
}

export async function updateCategory(
  id: string,
  input: UpdateCategoryInput
): Promise<{ success: boolean; error?: string }> {
  const businessId = await requireBusinessId();
  const supabase = await createServerClient();

  const patch: Record<string, unknown> = { ...input };
  if (input.name) patch.slug = slugify(input.name);

  const { error } = await supabase
    .from('categories')
    .update(patch)
    .eq('id', id)
    .eq('business_id', businessId);

  if (error) {
    if (error.code === '23505') return { success: false, error: 'Ya existe una categoría con ese nombre.' };
    return { success: false, error: 'No se pudo actualizar la categoría.' };
  }

  revalidateCategoryViews();
  return { success: true };
}

export async function deleteCategory(id: string): Promise<{ success: boolean; error?: string }> {
  const businessId = await requireBusinessId();
  const supabase = await createServerClient();

  // Los productos de la categoría no se borran: quedan sin categoría.
  const { error } = await supabase
    .from('categories')
    .delete()
    .eq('id', id)
    .eq('business_id', businessId);

  if (error) return { success: false, error: 'No se pudo eliminar la categoría.' };

  revalidateCategoryViews();
  return { success: true };
}

function revalidateCategoryViews() {
  revalidatePath('/admin/productos');
  revalidatePath('/admin/productos/categorias');
  revalidatePath('/catalogo');
}
