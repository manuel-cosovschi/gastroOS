'use server';

import { createServerClient } from '@/lib/supabase/server';
import { requireBusinessId } from '@/lib/business';
import { notifyBusiness, pushConfigured } from '@/lib/push';

/**
 * Alta y baja de un dispositivo para las notificaciones del panel.
 *
 * La suscripción la genera el navegador; acá sólo se guarda. Va contra la tabla
 * con RLS —cada uno maneja las suyas— y no con la service role: esto lo llama
 * alguien con sesión.
 */

export interface PushSubscriptionInput {
  endpoint: string;
  keys: { p256dh: string; auth: string };
}

type Result = { success: boolean; error?: string };

export async function savePushSubscription(
  subscription: PushSubscriptionInput,
  userAgent?: string
): Promise<Result> {
  if (!pushConfigured()) return { success: false, error: 'Las notificaciones no están configuradas.' };

  const businessId = await requireBusinessId();
  const supabase = await createServerClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { success: false, error: 'Iniciá sesión de nuevo.' };

  if (!subscription?.endpoint || !subscription.keys?.p256dh || !subscription.keys?.auth) {
    return { success: false, error: 'El navegador no devolvió una suscripción válida.' };
  }

  // El endpoint es único: si el mismo navegador se vuelve a suscribir —pasa
  // cada vez que el servicio de push rota las claves— se actualiza la fila en
  // lugar de sumar una suscripción muerta más.
  const { error } = await supabase.from('push_subscriptions').upsert(
    {
      business_id: businessId,
      user_id: user.id,
      endpoint: subscription.endpoint,
      p256dh: subscription.keys.p256dh,
      auth: subscription.keys.auth,
      user_agent: userAgent?.slice(0, 300) || null,
    },
    { onConflict: 'endpoint' }
  );

  if (error) {
    console.error('[savePushSubscription] no se pudo guardar:', error);
    return { success: false, error: 'No se pudo activar las notificaciones.' };
  }

  return { success: true };
}

export async function removePushSubscription(endpoint: string): Promise<Result> {
  const supabase = await createServerClient();
  const { error } = await supabase.from('push_subscriptions').delete().eq('endpoint', endpoint);

  if (error) {
    console.error('[removePushSubscription] no se pudo borrar:', error);
    return { success: false, error: 'No se pudo desactivar las notificaciones.' };
  }
  return { success: true };
}

/** Manda una notificación de prueba al negocio de quien la pide. */
export async function sendTestNotification(): Promise<Result & { sent?: number }> {
  const businessId = await requireBusinessId();
  const sent = await notifyBusiness(businessId, {
    title: 'Probando las notificaciones',
    body: 'Si ves esto, ya te vamos a avisar cuando entre un pedido.',
    url: '/admin',
  });

  if (sent === 0) {
    return {
      success: false,
      error: 'No llegó a ningún dispositivo. Revisá que las notificaciones estén permitidas.',
    };
  }
  return { success: true, sent };
}
