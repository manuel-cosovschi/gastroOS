import Link from 'next/link';
import { ArrowRight, CalendarCheck, Mail, MessageCircle, PlayCircle } from 'lucide-react';
import { cn } from '@/lib/utils';
import { BOOKING_URL, DEMO_URL, EMAIL_URL, WHATSAPP_URL } from '@/lib/marketing';

/**
 * Botones de contacto y demo.
 *
 * Cada vía sólo se renderiza si está configurada: una landing con un botón que
 * no lleva a ningún lado es peor que no tener el botón.
 */

export function BookDemoButton({
  className,
  size = 'lg',
}: {
  className?: string;
  size?: 'lg' | 'md';
}) {
  if (!BOOKING_URL) return null;

  return (
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
      Reservar una demo
    </a>
  );
}

export function TryDemoButton({
  className,
  variant = 'outline',
  size = 'lg',
}: {
  className?: string;
  variant?: 'outline' | 'solid';
  size?: 'lg' | 'md';
}) {
  return (
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
      Entrar a la demo
    </Link>
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

/** CTA principal: reserva si está configurada, si no la demo. */
export function PrimaryCta({ className }: { className?: string }) {
  return (
    <div className={cn('flex flex-wrap items-center gap-3', className)}>
      {BOOKING_URL ? (
        <>
          <BookDemoButton />
          <TryDemoButton />
        </>
      ) : (
        <>
          <TryDemoButton variant="solid" />
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
