'use server';

import { revalidatePath } from 'next/cache';
import { createServerClient } from '@/lib/supabase/server';
import { requireBusinessId } from '@/lib/business';
import { ACCEPTED_IMAGE_TYPES, MAX_IMAGE_SIZE, MEDIA_BUCKET } from '@/lib/constants';

/**
 * Subida de imágenes al storage de Supabase.
 *
 * Va con la sesión del usuario, no con el service role: las policies del bucket
 * ya exigen estar autenticado, así que saltear RLS no aportaba nada y obligaba
 * a tener una clave con permisos totales en el entorno del servidor web.
 * Los archivos se guardan bajo un prefijo por negocio para poder limpiarlos.
 */
async function assertAuthenticated(): Promise<boolean> {
  const supabase = await createServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return !!user;
}

export async function uploadImage(
  formData: FormData
): Promise<{ success: boolean; url?: string; error?: string }> {
  const file = formData.get('file') as File | null;
  if (!file) return { success: false, error: 'No se recibió ningún archivo.' };

  if (!ACCEPTED_IMAGE_TYPES.includes(file.type)) {
    return { success: false, error: 'Formato no soportado. Usá JPG, PNG o WebP.' };
  }
  if (file.size > MAX_IMAGE_SIZE) {
    return { success: false, error: 'La imagen no puede superar los 5 MB.' };
  }
  if (!(await assertAuthenticated())) {
    return { success: false, error: 'No tenés permiso para subir imágenes.' };
  }

  const businessId = await requireBusinessId();
  const supabase = await createServerClient();
  const extension = file.name.split('.').pop()?.toLowerCase() || 'jpg';
  const path = `${businessId}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${extension}`;

  const { error } = await supabase.storage
    .from(MEDIA_BUCKET)
    .upload(path, file, { cacheControl: '3600', upsert: false });

  if (error) {
    return {
      success: false,
      error: `No se pudo subir la imagen. Verificá que el bucket "${MEDIA_BUCKET}" exista.`,
    };
  }

  const { data } = supabase.storage.from(MEDIA_BUCKET).getPublicUrl(path);
  return { success: true, url: data.publicUrl };
}

export async function deleteImage(imageUrl: string): Promise<{ success: boolean; error?: string }> {
  if (!(await assertAuthenticated())) return { success: false, error: 'No tenés permiso.' };

  const parts = imageUrl.split(`/storage/v1/object/public/${MEDIA_BUCKET}/`);
  if (parts.length < 2) return { success: false, error: 'URL de imagen inválida.' };

  const supabase = await createServerClient();
  const { error } = await supabase.storage.from(MEDIA_BUCKET).remove([parts[1]]);

  if (error) return { success: false, error: 'No se pudo eliminar la imagen.' };
  return { success: true };
}

/** Sube la imagen y la asocia al producto en un solo paso. */
export async function uploadProductImage(
  productId: string,
  formData: FormData
): Promise<{ success: boolean; url?: string; error?: string }> {
  const upload = await uploadImage(formData);
  if (!upload.success) return upload;

  const businessId = await requireBusinessId();
  const supabase = await createServerClient();

  const { data: product } = await supabase
    .from('products')
    .select('image_url')
    .eq('id', productId)
    .eq('business_id', businessId)
    .maybeSingle();

  const { error } = await supabase
    .from('products')
    .update({ image_url: upload.url })
    .eq('id', productId)
    .eq('business_id', businessId);

  if (error) return { success: false, error: 'No se pudo actualizar el producto.' };

  // La imagen anterior ya no se usa: liberamos el espacio.
  if (product?.image_url) await deleteImage(product.image_url).catch(() => {});

  revalidateImageViews(productId);
  return { success: true, url: upload.url };
}

export async function removeProductImage(
  productId: string
): Promise<{ success: boolean; error?: string }> {
  if (!(await assertAuthenticated())) return { success: false, error: 'No tenés permiso.' };

  const businessId = await requireBusinessId();
  const supabase = await createServerClient();

  const { data: product } = await supabase
    .from('products')
    .select('image_url')
    .eq('id', productId)
    .eq('business_id', businessId)
    .maybeSingle();

  if (product?.image_url) await deleteImage(product.image_url).catch(() => {});

  await supabase
    .from('products')
    .update({ image_url: null })
    .eq('id', productId)
    .eq('business_id', businessId);

  revalidateImageViews(productId);
  return { success: true };
}

function revalidateImageViews(productId: string) {
  revalidatePath('/admin/productos');
  revalidatePath(`/admin/productos/${productId}`);
  revalidatePath('/catalogo');
}
