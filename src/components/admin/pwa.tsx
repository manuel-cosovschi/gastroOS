'use client';

import { useEffect, useState } from 'react';
import { Download, Share, X } from 'lucide-react';
import { Button } from '@/components/ui/button';

/**
 * Registro del service worker.
 *
 * Va sólo en el panel: es lo que se instala en el teléfono y lo que recibe las
 * notificaciones. La tienda es una página que se comparte por link y no tiene
 * nada que ganar con un service worker.
 */
export function ServiceWorkerRegistration() {
  useEffect(() => {
    if (!('serviceWorker' in navigator)) return;

    navigator.serviceWorker.register('/sw.js').catch((error) => {
      // Que no se registre no rompe nada: se pierden las notificaciones y la
      // pantalla de sin conexión, y el panel anda igual.
      console.error('[pwa] no se pudo registrar el service worker:', error);
    });
  }, []);

  return null;
}

const DISMISSED_KEY = 'gastroos:instalar:oculto';

interface InstallPrompt extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

/**
 * Invitación a instalar el panel en el teléfono.
 *
 * Aparece una sola vez y se puede cerrar para siempre: un cartel que vuelve
 * cada vez que alguien abre su trabajo es publicidad, no una ayuda.
 *
 * En Android el navegador avisa cuándo se puede instalar y se usa su propio
 * diálogo. En iPhone no existe ese aviso —Safari no lo implementa— así que hay
 * que explicar los dos toques a mano; por eso el texto está escrito, y no es
 * un descuido.
 */
export function InstallBanner() {
  const [prompt, setPrompt] = useState<InstallPrompt | null>(null);
  const [showIOS, setShowIOS] = useState(false);

  useEffect(() => {
    let dismissed = false;
    try {
      dismissed = window.localStorage.getItem(DISMISSED_KEY) === '1';
    } catch {
      // Sin almacenamiento el cartel puede reaparecer; no vale romper por eso.
    }
    if (dismissed) return;

    const standalone =
      window.matchMedia('(display-mode: standalone)').matches ||
      (window.navigator as { standalone?: boolean }).standalone === true;
    if (standalone) return;

    const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);
    if (isIOS) {
      setShowIOS(true);
      return;
    }

    const onPrompt = (event: Event) => {
      event.preventDefault();
      setPrompt(event as InstallPrompt);
    };

    window.addEventListener('beforeinstallprompt', onPrompt);
    return () => window.removeEventListener('beforeinstallprompt', onPrompt);
  }, []);

  const hide = () => {
    setPrompt(null);
    setShowIOS(false);
    try {
      window.localStorage.setItem(DISMISSED_KEY, '1');
    } catch {
      // Ídem.
    }
  };

  if (!prompt && !showIOS) return null;

  return (
    <div className="mb-4 flex items-start gap-3 rounded-xl border border-brand-200 bg-brand-50 px-4 py-3">
      <Download className="mt-0.5 h-4 w-4 shrink-0 text-brand-700" />
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium text-stone-900">Tenelo a mano en el teléfono</p>
        {showIOS ? (
          <p className="mt-0.5 text-sm leading-relaxed text-stone-700">
            Tocá <Share className="inline h-3.5 w-3.5 align-text-bottom" /> abajo en Safari y elegí{' '}
            <strong>Agregar a inicio</strong>. Queda como una aplicación más, y ahí también podés
            activar las notificaciones.
          </p>
        ) : (
          <>
            <p className="mt-0.5 text-sm leading-relaxed text-stone-700">
              Se agrega a tu pantalla de inicio y abre directo en el panel, sin barra del navegador.
            </p>
            <Button
              size="sm"
              className="mt-2.5"
              onClick={async () => {
                if (!prompt) return;
                await prompt.prompt();
                await prompt.userChoice;
                hide();
              }}
            >
              Instalar
            </Button>
          </>
        )}
      </div>
      <button
        onClick={hide}
        aria-label="No mostrar más"
        className="shrink-0 rounded-md p-1 text-stone-400 transition-colors hover:bg-white hover:text-stone-600"
      >
        <X className="h-4 w-4" />
      </button>
    </div>
  );
}
