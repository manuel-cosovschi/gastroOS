'use server';

import { revalidatePath } from 'next/cache';
import { createServerClient } from '@/lib/supabase/server';
import { getCurrentBusiness, requireBusiness } from '@/lib/business';
import type { Business, UpdateBusinessInput } from '@/types';

export async function getBusiness(): Promise<Business | null> {
  return getCurrentBusiness();
}

export async function updateBusiness(
  input: UpdateBusinessInput
): Promise<{ success: boolean; error?: string }> {
  try {
    const business = await requireBusiness();
    const supabase = await createServerClient();

    if (input.name !== undefined && !input.name.trim()) {
      return { success: false, error: 'El nombre comercial no puede quedar vacío.' };
    }

    const { error } = await supabase
      .from('businesses')
      .update({
        ...input,
        name: input.name?.trim() ?? undefined,
      })
      .eq('id', business.id);

    if (error) return { success: false, error: 'No se pudo guardar la configuración.' };

    // El nombre y el logo aparecen en el sidebar y la tienda pública
    revalidatePath('/', 'layout');
    return { success: true };
  } catch {
    return { success: false, error: 'No hay un negocio activo.' };
  }
}

/** Preferencias operativas (clave/valor) del negocio activo. */
export async function getSettings(): Promise<Record<string, unknown>> {
  const business = await getCurrentBusiness();
  if (!business) return {};

  const supabase = await createServerClient();
  const { data } = await supabase
    .from('settings')
    .select('key, value')
    .eq('business_id', business.id);

  const settings: Record<string, unknown> = {};
  (data || []).forEach((row) => {
    settings[row.key] = row.value;
  });
  return settings;
}

export async function updateSettings(
  updates: Record<string, unknown>
): Promise<{ success: boolean; error?: string }> {
  try {
    const business = await requireBusiness();
    const supabase = await createServerClient();

    const rows = Object.entries(updates).map(([key, value]) => ({
      business_id: business.id,
      key,
      value,
      updated_at: new Date().toISOString(),
    }));

    const { error } = await supabase
      .from('settings')
      .upsert(rows, { onConflict: 'business_id,key' });

    if (error) return { success: false, error: 'No se pudieron guardar las preferencias.' };

    revalidatePath('/admin/configuracion');
    return { success: true };
  } catch {
    return { success: false, error: 'No hay un negocio activo.' };
  }
}
