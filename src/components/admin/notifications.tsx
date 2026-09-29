'use client';

import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { Bell, BellOff, BellRing, Loader2, Smartphone } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  removePushSubscription,
  savePushSubscription,
  sendTestNotification,
} from '@/actions/push';

/**
 * Interruptor de las notificaciones del panel.
 *
 * Dos avisos que parecen de más y no lo son.
 *
 * El primero: en iPhone, las notificaciones web sólo existen si la aplicación
 * está agregada a la pantalla de inicio. Safari no lo dice; devuelve que no se
 * puede y listo. Quien no lo sabe concluye que el sistema está roto, así que
 * acá se explica antes de que pruebe.
 *
 * El segundo: si alguien ya bloqueó las notificaciones del sitio, este botón no
 * puede desbloquearlas — el navegador no vuelve a preguntar. Hay que ir a los
 * permisos del sitio a mano, y el mensaje lo dice en vez de dejar un botón que
 * no hace nada.
 */

type State = 'cargando' | 'no-soportado' | 'ios-sin-instalar' | 'bloqueado' | 'activo' | 'inactivo';

export function NotificationSettings({ vapidKey }: { vapidKey: string }) {
  const [state, setState] = useState<State>('cargando');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let cancelled = false;

    const check = async () => {
      if (typeof window === 'undefined') return;

      const supported =
        'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window;

      if (!supported) {
        // En iPhone el soporte aparece recién cuando la app corre desde la
        // pantalla de inicio, así que se distingue ese caso del "tu navegador
        // no puede".
        const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);
        const standalone =
          window.matchMedia('(display-mode: standalone)').matches ||
          (window.navigator as { standalone?: boolean }).standalone === true;
        if (!cancelled) setState(isIOS && !standalone ? 'ios-sin-instalar' : 'no-soportado');
        return;
      }

      if (Notification.permission === 'denied') {
        if (!cancelled) setState('bloqueado');
        return;
      }

      try {
        const registration = await navigator.serviceWorker.ready;
        const existing = await registration.pushManager.getSubscription();
        if (!cancelled) setState(existing ? 'activo' : 'inactivo');
      } catch {
        if (!cancelled) setState('inactivo');
      }
    };

    check();
    return () => {
      cancelled = true;
    };
  }, []);

  const activate = async () => {
    setBusy(true);
    try {
      const permission = await Notification.requestPermission();
      if (permission !== 'granted') {
        setState(permission === 'denied' ? 'bloqueado' : 'inactivo');
        return;
      }

      const registration = await navigator.serviceWorker.ready;
      const subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(vapidKey),
      });

      const json = subscription.toJSON() as {
        endpoint?: string;
        keys?: { p256dh?: string; auth?: string };
      };

      const result = await savePushSubscription(
        {
          endpoint: json.endpoint || '',
          keys: { p256dh: json.keys?.p256dh || '', auth: json.keys?.auth || '' },
        },
        navigator.userAgent
      );

      if (!result.success) {
        // Si el servidor no la guardó, dejarla viva en el navegador haría que
        // el interruptor diga "activo" sin que llegue nunca nada.
        await subscription.unsubscribe();
        toast.error(result.error || 'No se pudo activar.');
        setState('inactivo');
        return;
      }

      setState('activo');
      toast.success('Listo. Te vamos a avisar cuando entre un pedido.');
    } catch (error) {
      console.error('[notificaciones] no se pudo activar:', error);
      toast.error('No se pudo activar las notificaciones en este dispositivo.');
    } finally {
      setBusy(false);
    }
  };

  const deactivate = async () => {
    setBusy(true);
    try {
      const registration = await navigator.serviceWorker.ready;
      const subscription = await registration.pushManager.getSubscription();
      if (subscription) {
        await removePushSubscription(subscription.endpoint);
        await subscription.unsubscribe();
      }
      setState('inactivo');
      toast.success('Notificaciones desactivadas en este dispositivo.');
    } finally {
      setBusy(false);
    }
  };

  if (state === 'cargando') {
    return <p className="text-sm text-stone-500">Revisando este dispositivo…</p>;
  }

  if (state === 'ios-sin-instalar') {
    return (
      <Note icon={Smartphone} title="Primero agregalo a tu pantalla de inicio">
        En iPhone y iPad las notificaciones funcionan sólo si abrís el panel desde la pantalla de
        inicio. Tocá el botón de compartir de Safari, elegí <strong>Agregar a inicio</strong>, y
        entrá desde ahí: el interruptor va a aparecer acá.
      </Note>
    );
  }

  if (state === 'no-soportado') {
    return (
      <Note icon={BellOff} title="Este navegador no puede">
        Probá desde Chrome o Edge en Android o computadora, o desde Safari en iPhone con el panel
        agregado a la pantalla de inicio.
      </Note>
    );
  }

  if (state === 'bloqueado') {
    return (
      <Note icon={BellOff} title="Las notificaciones están bloqueadas">
        Las bloqueaste para este sitio y el navegador no vuelve a preguntar. Tocá el candado de la
        barra de direcciones, permití las notificaciones y recargá esta página.
      </Note>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex items-start gap-3">
        {state === 'activo' ? (
          <BellRing className="mt-0.5 h-5 w-5 shrink-0 text-brand-600" />
        ) : (
          <Bell className="mt-0.5 h-5 w-5 shrink-0 text-stone-400" />
        )}
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium text-stone-900">
            {state === 'activo'
              ? 'Activadas en este dispositivo'
              : 'Desactivadas en este dispositivo'}
          </p>
          <p className="mt-0.5 text-sm leading-relaxed text-stone-600">
            {state === 'activo'
              ? 'Te avisamos cuando entre un pedido por la tienda, aunque tengas el panel cerrado.'
              : 'Activalas para enterarte de un pedido nuevo sin tener que mirar la pantalla.'}
          </p>
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        {state === 'activo' ? (
          <>
            <Button variant="outline" onClick={deactivate} disabled={busy}>
              {busy && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Desactivar
            </Button>
            <Button
              variant="outline"
              disabled={busy}
              onClick={async () => {
                setBusy(true);
                const result = await sendTestNotification();
                setBusy(false);
                if (result.success) toast.success('Aviso enviado.');
                else toast.error(result.error || 'No se pudo enviar.');
              }}
            >
              Probar
            </Button>
          </>
        ) : (
          <Button onClick={activate} disabled={busy}>
            {busy ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Bell className="mr-2 h-4 w-4" />
            )}
            Activar notificaciones
          </Button>
        )}
      </div>

      <p className="text-xs leading-relaxed text-stone-500">
        Se activan por dispositivo. Si querés que te lleguen al teléfono y a la computadora, tenés
        que activarlas en los dos.
      </p>
    </div>
  );
}

function Note({
  icon: Icon,
  title,
  children,
}: {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex gap-3 rounded-lg border border-stone-200 bg-stone-50 p-4">
      <Icon className="mt-0.5 h-5 w-5 shrink-0 text-stone-400" />
      <div className="min-w-0">
        <p className="text-sm font-medium text-stone-900">{title}</p>
        <p className="mt-0.5 text-sm leading-relaxed text-stone-600">{children}</p>
      </div>
    </div>
  );
}

/**
 * La clave VAPID viaja en base64 de URL y `pushManager.subscribe` la quiere
 * como bytes. Es la conversión que pide la especificación.
 */
function urlBase64ToUint8Array(base64: string): Uint8Array<ArrayBuffer> {
  const padding = '='.repeat((4 - (base64.length % 4)) % 4);
  const normalized = (base64 + padding).replace(/-/g, '+').replace(/_/g, '/');
  const raw = window.atob(normalized);

  // El buffer va creado explícito: `new Uint8Array(n)` puede apoyarse en un
  // SharedArrayBuffer según el tipo, y `applicationServerKey` sólo acepta uno
  // común.
  const output = new Uint8Array(new ArrayBuffer(raw.length));
  for (let i = 0; i < raw.length; i += 1) output[i] = raw.charCodeAt(i);
  return output;
}
