import Link from 'next/link';
import { ArrowRight, CalendarCheck, Mail, MessageCircle, PlayCircle } from 'lucide-react';
import { cn } from '@/lib/utils';
import { BOOKING_URL, DEMO_URL, EMAIL_URL, WHATSAPP_URL } from '@/lib/marketing';

/**
 * Botones de contacto y de prueba.
 *
 * Hay dos acciones que son cosas muy distintas y antes las dos se llamaban
 * "demo": una es una reunión con una persona y la otra es entrar al sistema
 * solo. Ahora cada una se llama por lo que es —"reunión" y "probar"— y en el
 * llamado principal cada botón lleva debajo qué pasa si lo tocás.
 *
 * Cada vía sólo se renderiza si está configurada: una landing con un botón que
 * no lleva a ningún lado es peor que no tener el botón.
 */

// Los dos renglones contrastan lo mismo —quién maneja— porque es la
// diferencia real entre las dos acciones, no la duración ni los datos.
const MEETING_CAPTION = 'Videollamada de 20 minutos: te lo mostramos nosotros';
const TRY_CAPTION = 'Entrás solo, ahora mismo, con datos de ejemplo';

function Caption({ children }: { children: React.ReactNode }) {
  return <span className="mt-2 block text-xs leading-snug text-stone-500">{children}</span>;
}

export function BookMeetingButton({
  className,
  size = 'lg',
  caption = false,
}: {
  className?: string;
  size?: 'lg' | 'md';
  caption?: boolean;
}) {
  if (!BOOKING_URL) return null;

  const button = (
    <a
      href={BOOKING_URL}
      target="_blank"
      rel="noreferrer"
      className={cn(
        'inline-flex items-center justify-center gap-2 rounded-xl bg-brand-700 font-medium text-white shadow-sm transition-colors hover:bg-brand-800',
        size === 'lg' ? 'h-12 px-6 text-base' : 'h-10 px-4 text-sm',
        className
      )}
    >
      <CalendarCheck className={size === 'lg' ? 'h-5 w-5' : 'h-4 w-4'} />
      Reservar una reunión
    </a>
  );

  if (!caption) return button;

  return (
    <span className="block text-center">
      {button}
      <Caption>{MEETING_CAPTION}</Caption>
    </span>
  );
}

export function TrySystemButton({
  className,
  variant = 'outline',
  size = 'lg',
  caption = false,
}: {
  className?: string;
  variant?: 'outline' | 'solid';
  size?: 'lg' | 'md';
  caption?: boolean;
}) {
  const button = (
    <Link
      href={DEMO_URL}
      className={cn(
        'inline-flex items-center justify-center gap-2 rounded-xl font-medium transition-colors',
        size === 'lg' ? 'h-12 px-6 text-base' : 'h-10 px-4 text-sm',
        variant === 'solid'
          ? 'bg-stone-900 text-white hover:bg-stone-800'
          : 'border border-stone-300 bg-white text-stone-800 hover:border-stone-400 hover:bg-stone-50',
        className
      )}
    >
      <PlayCircle className={size === 'lg' ? 'h-5 w-5' : 'h-4 w-4'} />
      Probar el sistema
    </Link>
  );

  if (!caption) return button;

  return (
    <span className="block text-center">
      {button}
      <Caption>{TRY_CAPTION}</Caption>
    </span>
  );
}

/** Fila de contacto: WhatsApp y mail, sólo los que estén configurados. */
export function ContactLinks({ className }: { className?: string }) {
  if (!WHATSAPP_URL && !EMAIL_URL) return null;

  return (
    <div className={cn('flex flex-wrap items-center gap-3', className)}>
      {WHATSAPP_URL && (
        <a
          href={WHATSAPP_URL}
          target="_blank"
          rel="noreferrer"
          className="inline-flex h-12 items-center gap-2 rounded-xl border border-stone-300 bg-white px-5 text-base font-medium text-stone-800 transition-colors hover:border-stone-400 hover:bg-stone-50"
        >
          <MessageCircle className="h-5 w-5 text-brand-600" />
          WhatsApp
        </a>
      )}
      {EMAIL_URL && (
        <a
          href={EMAIL_URL}
          className="inline-flex h-12 items-center gap-2 rounded-xl border border-stone-300 bg-white px-5 text-base font-medium text-stone-800 transition-colors hover:border-stone-400 hover:bg-stone-50"
        >
          <Mail className="h-5 w-5 text-brand-600" />
          Escribinos
        </a>
      )}
    </div>
  );
}

/** CTA del hero: reunión si está configurada, si no probar el sistema. */
export function PrimaryCta({ className }: { className?: string }) {
  return (
    <div className={cn('flex flex-wrap items-center gap-3', className)}>
      {BOOKING_URL ? (
        <>
          <BookMeetingButton />
          <TrySystemButton />
        </>
      ) : (
        <>
          <TrySystemButton variant="solid" />
          {WHATSAPP_URL && (
            <a
              href={WHATSAPP_URL}
              target="_blank"
              rel="noreferrer"
              className="inline-flex h-12 items-center gap-2 rounded-xl border border-stone-300 bg-white px-6 text-base font-medium text-stone-800 transition-colors hover:border-stone-400 hover:bg-stone-50"
            >
              <MessageCircle className="h-5 w-5 text-brand-600" />
              Hablar por WhatsApp
              <ArrowRight className="h-4 w-4 text-stone-400" />
            </a>
          )}
        </>
      )}
    </div>
  );
}
