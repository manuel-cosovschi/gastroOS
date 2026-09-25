'use server';

import { revalidatePath } from 'next/cache';
import { createServerClient } from '@/lib/supabase/server';
import { requireBusinessId } from '@/lib/business';
import { slugify } from '@/lib/utils';
import type { CreatePackageInput, Package, PackageDetail, UpdatePackageInput } from '@/types';

/**
 * Combos: un precio único para un conjunto de productos (box de desayuno,
 * mesa dulce, menú semanal de viandas). Comparten catálogo y stock con los
 * productos que los componen.
 */

export async function listPackages(): Promise<PackageDetail[]> {
  const businessId = await requireBusinessId();
  const supabase = await createServerClient();

  const { data: packages } = await supabase
    .from('packages')
    .select('*')
    .eq('business_id', businessId)
    .order('sort_order')
    .order('name');

  if (!packages?.length) return [];

  const { data: items } = await supabase
    .from('package_items')
    .select('*, product:products(id, name, price)')
    .in(
      'package_id',
      packages.map((p) => p.id)
    );

  return packages.map((pkg) => ({
    ...pkg,
    items: (items || []).filter((item) => item.package_id === pkg.id),
  })) as PackageDetail[];
}

export async function getPackage(id: string): Promise<PackageDetail | null> {
  const businessId = await requireBusinessId();
  const supabase = await createServerClient();

  const { data: pkg } = await supabase
    .from('packages')
    .select('*')
    .eq('id', id)
    .eq('business_id', businessId)
    .maybeSingle();

  if (!pkg) return null;

  const { data: items } = await supabase
    .from('package_items')
    .select('*, product:products(id, name, price)')
    .eq('package_id', pkg.id);

  return { ...pkg, items: items || [] } as PackageDetail;
}

export async function createPackage(
  input: CreatePackageInput
): Promise<{ success: boolean; pkg?: Package; error?: string }> {
  const error = validatePackage(input);
  if (error) return { success: false, error };

  const businessId = await requireBusinessId();
  const supabase = await createServerClient();

  const { data: pkg, error: insertError } = await supabase
    .from('packages')
    .insert({
      business_id: businessId,
      name: input.name.trim(),
      slug: slugify(input.name),
      description: input.description?.trim() || null,
      image_url: input.image_url || null,
      price: input.price,
      is_editable: input.is_editable || false,
      is_active: input.is_active ?? true,
    })
    .select()
    .single();

  if (insertError || !pkg) {
    if (insertError?.code === '23505') return { success: false, error: 'Ya existe un combo con ese nombre.' };
    return { success: false, error: 'No se pudo crear el combo.' };
  }

  await supabase.from('package_items').insert(
    input.items.map((item) => ({
      package_id: pkg.id,
      product_id: item.product_id,
      quantity: item.quantity,
    }))
  );

  revalidatePackageViews();
  return { success: true, pkg: pkg as Package };
}

export async function updatePackage(
  id: string,
  input: UpdatePackageInput
): Promise<{ success: boolean; error?: string }> {
  const businessId = await requireBusinessId();
  const supabase = await createServerClient();

  const patch: Record<string, unknown> = {};
  if (input.name) {
    patch.name = input.name.trim();
    patch.slug = slugify(input.name);
  }
  if (input.description !== undefined) patch.description = input.description?.trim() || null;
  if (input.image_url !== undefined) patch.image_url = input.image_url || null;
  if (input.price !== undefined) patch.price = input.price;
  if (input.is_editable !== undefined) patch.is_editable = input.is_editable;
  if (input.is_active !== undefined) patch.is_active = input.is_active;

  if (Object.keys(patch).length > 0) {
    const { error } = await supabase
      .from('packages')
      .update(patch)
      .eq('id', id)
      .eq('business_id', businessId);
    if (error) return { success: false, error: 'No se pudo actualizar el combo.' };
  }

  if (input.items) {
    await supabase.from('package_items').delete().eq('package_id', id);
    if (input.items.length > 0) {
      await supabase.from('package_items').insert(
        input.items.map((item) => ({
          package_id: id,
          product_id: item.product_id,
          quantity: item.quantity,
        }))
      );
    }
  }

  revalidatePackageViews(id);
  return { success: true };
}

export async function togglePackageActive(
  id: string
): Promise<{ success: boolean; error?: string }> {
  const businessId = await requireBusinessId();
  const supabase = await createServerClient();

  const { data: pkg } = await supabase
    .from('packages')
    .select('is_active')
    .eq('id', id)
    .eq('business_id', businessId)
    .maybeSingle();

  if (!pkg) return { success: false, error: 'Combo no encontrado.' };

  const { error } = await supabase
    .from('packages')
    .update({ is_active: !pkg.is_active })
    .eq('id', id);

  if (error) return { success: false, error: 'No se pudo cambiar el estado.' };

  revalidatePackageViews(id);
  return { success: true };
}

export async function deletePackage(id: string): Promise<{ success: boolean; error?: string }> {
  const businessId = await requireBusinessId();
  const supabase = await createServerClient();

  const { error } = await supabase
    .from('packages')
    .delete()
    .eq('id', id)
    .eq('business_id', businessId);

  if (error) {
    return { success: false, error: 'No se pudo eliminar. Puede estar usado en un pedido: desactivalo.' };
  }

  revalidatePackageViews();
  return { success: true };
}

function validatePackage(input: CreatePackageInput): string | null {
  if (!input.name?.trim()) return 'El nombre es obligatorio.';
  if (!input.price || input.price <= 0) return 'El precio tiene que ser mayor a cero.';
  if (!input.items?.length) return 'Agregá al menos un producto al combo.';
  return null;
}

function revalidatePackageViews(id?: string) {
  revalidatePath('/admin/combos');
  if (id) revalidatePath(`/admin/combos/${id}`);
  revalidatePath('/catalogo');
}
