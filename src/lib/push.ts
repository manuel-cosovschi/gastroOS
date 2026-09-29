import webpush from 'web-push';
import { createServiceClient } from '@/lib/supabase/service';

/**
 * Notificaciones push del panel.
 *
 * Las claves VAPID son lo que le demuestra al servicio de push del fabricante
 * (Google, Apple, Mozilla) que el mensaje sale de este servidor y no de
 * cualquiera que haya conseguido un endpoint. Sin ellas no se manda nada: el
 * panel sigue funcionando y la pantalla de ajustes explica que falta
 * configurarlas, en vez de ofrecer un interruptor que no hace nada.
 *
 * Generarlas es un comando:
 *   npx web-push generate-vapid-keys
 */

export interface PushMessage {
  title: string;
  body: string;
  url?: string;
  tag?: string;
}

/**
 * La clave pública va con prefijo NEXT_PUBLIC porque el navegador la necesita
 * para suscribirse: es pública por diseño, igual que la anon key. La privada
 * nunca sale del servidor, y es la única que hay que cuidar.
 */
export const VAPID_PUBLIC_KEY = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY || '';

export function pushConfigured(): boolean {
  return Boolean(VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY);
}

let configured = false;

function setup(): boolean {
  if (!pushConfigured()) return false;
  if (configured) return true;

  webpush.setVapidDetails(
    process.env.VAPID_SUBJECT || `mailto:${process.env.NEXT_PUBLIC_CONTACT_EMAIL || 'hola@gastroos.app'}`,
    VAPID_PUBLIC_KEY,
    process.env.VAPID_PRIVATE_KEY!
  );
  configured = true;
  return true;
}

/**
 * Avisa a todos los dispositivos del negocio.
 *
 * Nunca lanza. Se llama desde el alta de un pedido, y un aviso que no sale no
 * puede hacer que el pedido falle: el pedido ya está guardado y es lo que
 * importa. Los errores van al log.
 */
export async function notifyBusiness(businessId: string, message: PushMessage): Promise<number> {
  if (!setup()) return 0;

  const supabase = createServiceClient();
  if (!supabase) return 0;

  const { data, error } = await supabase.rpc('business_push_targets', {
    p_business_id: businessId,
  });

  if (error) {
    console.error('[notifyBusiness] no se pudieron leer las suscripciones:', error);
    return 0;
  }

  const targets = (data || []) as { endpoint: string; p256dh: string; auth: string }[];
  if (targets.length === 0) return 0;

  const payload = JSON.stringify(message);
  const gone: string[] = [];

  const results = await Promise.all(
    targets.map(async (target) => {
      try {
        await webpush.sendNotification(
          { endpoint: target.endpoint, keys: { p256dh: target.p256dh, auth: target.auth } },
          payload,
          { TTL: 60 * 60 * 6 }
        );
        return true;
      } catch (error) {
        const status = (error as { statusCode?: number }).statusCode;
        // 404 y 410 significan que ese navegador ya no existe: se desinstaló la
        // aplicación, se limpiaron los datos o el usuario revocó el permiso.
        // Guardarlas para siempre hace que cada aviso pague el costo de
        // intentar contra endpoints muertos.
        if (status === 404 || status === 410) gone.push(target.endpoint);
        else console.error('[notifyBusiness] falló un envío:', status, error);
        return false;
      }
    })
  );

  if (gone.length > 0) {
    await supabase.from('push_subscriptions').delete().in('endpoint', gone);
  }

  return results.filter(Boolean).length;
}
