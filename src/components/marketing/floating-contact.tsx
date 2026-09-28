'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { CalendarCheck, MessageCircle, PlayCircle, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { BOOKING_URL, DEMO_URL, WHATSAPP_URL } from '@/lib/marketing';

/**
 * Contacto siempre a mano.
 *
 * Dos piezas con el mismo criterio que el resto de la landing: cada una
 * aparece sólo si su vía está configurada.
 *
 * - En desktop, un botón flotante de WhatsApp. En Argentina es la vía por
 *   defecto y hoy había que llegar al pie para encontrarla.
 * - En mobile, una barra fija abajo con la acción principal. El pulgar ya
 *   está ahí y no obliga a scrollear hasta el final para actuar.
 *
 * Las dos esperan a que el visitante haya bajado un poco: aparecer sobre el
 * hero, antes de que la página diga nada, es lo que hace que la gente cierre
 * estas cosas sin leerlas.
 */

const SCROLL_TRIGGER = 700;

function useScrolledPast(threshold: number) {
  const [passed, setPassed] = useState(false);

  useEffect(() => {
    const read = () => setPassed(window.scrollY > threshold);
    read();
    window.addEventListener('scroll', read, { passive: true });
    return () => window.removeEventListener('scroll', read);
  }, [threshold]);

  return passed;
}

export function FloatingWhatsApp() {
  const visible = useScrolledPast(SCROLL_TRIGGER);
  const [dismissed, setDismissed] = useState(false);

  if (!WHATSAPP_URL || dismissed) return null;

  return (
    <div
      className={cn(
        'fixed bottom-6 right-6 z-40 hidden items-center gap-2 transition-all duration-300 sm:flex',
        visible ? 'translate-y-0 opacity-100' : 'pointer-events-none translate-y-3 opacity-0'
      )}
    >
      <a
        href={WHATSAPP_URL}
        target="_blank"
        rel="noreferrer"
        className="inline-flex h-12 items-center gap-2 rounded-full bg-brand-700 px-5 text-sm font-medium text-white shadow-lift transition-colors hover:bg-brand-800"
      >
        <MessageCircle className="h-5 w-5" />
        Hablemos por WhatsApp
      </a>
      <button
        onClick={() => setDismissed(true)}
        aria-label="Ocultar el botón de WhatsApp"
        className="inline-flex h-7 w-7 items-center justify-center rounded-full border border-stone-200 bg-white text-stone-400 shadow-sm transition-colors hover:text-stone-700"
      >
        <X className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}

export function MobileCtaBar() {
  const visible = useScrolledPast(SCROLL_TRIGGER);

  return (
    <div
      className={cn(
        'fixed inset-x-0 bottom-0 z-40 border-t border-stone-200 bg-white/95 px-4 py-3 backdrop-blur transition-transform duration-300 sm:hidden',
        visible ? 'translate-y-0' : 'translate-y-full'
      )}
    >
      <div className="flex items-center gap-2">
        {BOOKING_URL ? (
          <a
            href={BOOKING_URL}
            target="_blank"
            rel="noreferrer"
            className="inline-flex h-11 flex-1 items-center justify-center gap-2 rounded-xl bg-brand-700 text-sm font-medium text-white"
          >
            <CalendarCheck className="h-4 w-4" />
            Reservar una reunión
          </a>
        ) : (
          <Link
            href={DEMO_URL}
            className="inline-flex h-11 flex-1 items-center justify-center gap-2 rounded-xl bg-stone-900 text-sm font-medium text-white"
          >
            <PlayCircle className="h-4 w-4" />
            Probar el sistema
          </Link>
        )}

        {WHATSAPP_URL && (
          <a
            href={WHATSAPP_URL}
            target="_blank"
            rel="noreferrer"
            aria-label="Escribinos por WhatsApp"
            className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-stone-300 text-stone-700"
          >
            <MessageCircle className="h-5 w-5" />
          </a>
        )}
      </div>
    </div>
  );
}
