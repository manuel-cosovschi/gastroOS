'use client';

import { useState, useTransition } from 'react';
import { Check, Copy, Mail, MessageCircle, Phone } from 'lucide-react';
import { marcarContactado } from '@/actions/prospeccion';
import { cn } from '@/lib/utils';

/**
 * El botón que abre WhatsApp con el mensaje ya escrito.
 *
 * Dos detalles que no son obvios:
 *
 * Es un `<a>` de verdad y no un `onClick` que llama a `window.open`. Abrir la
 * ventana desde JavaScript después de esperar al servidor hace que el navegador
 * lo trate como un pop-up y lo bloquee, porque ya no está dentro del gesto del
 * usuario. Siendo un link, el sistema operativo abre la app de WhatsApp como
 * con cualquier otro link, y el registro del contacto viaja por detrás sin que
 * nadie espere.
 *
 * Y no se hace `preventDefault()`: el click navega igual que siempre. Si el
 * registro falla, lo único que se pierde es la marca, no el mensaje.
 */
export function BotonWhatsApp({
  clienteId,
  href,
  yaContactado,
  compacto = false,
}: {
  clienteId: string;
  href: string;
  yaContactado: boolean;
  compacto?: boolean;
}) {
  const [marcado, setMarcado] = useState(yaContactado);
  const [, startTransition] = useTransition();

  const registrar = () => {
    if (marcado) return;
    setMarcado(true);
    startTransition(() => {
      void marcarContactado(clienteId);
    });
  };

  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      onClick={registrar}
      className={cn(
        'inline-flex shrink-0 items-center justify-center gap-2 rounded-lg font-medium transition-colors',
        compacto ? 'h-9 w-9' : 'h-9 px-3.5 text-sm',
        marcado
          ? 'border border-stone-300 bg-white text-stone-600 hover:bg-stone-50'
          : 'bg-emerald-600 text-white hover:bg-emerald-700'
      )}
      title={marcado ? 'Ya le escribiste: abrir el chat de nuevo' : 'Abrir WhatsApp con el mensaje escrito'}
      aria-label={
        marcado ? 'Abrir de nuevo el chat de WhatsApp' : 'Abrir WhatsApp con el mensaje escrito'
      }
    >
      <MessageCircle className="h-4 w-4" />
      {!compacto && (marcado ? 'Escribir de nuevo' : 'Escribir por WhatsApp')}
    </a>
  );
}

/** Para los fijos: no hay chat, hay que llamar. */
export function BotonLlamar({ telefono, motivo }: { telefono: string; motivo: string }) {
  return (
    <a
      href={`tel:+54${telefono}`}
      className="inline-flex h-9 shrink-0 items-center gap-2 rounded-lg border border-stone-300 bg-white px-3.5 text-sm font-medium text-stone-600 transition-colors hover:bg-stone-50"
      title={motivo}
    >
      <Phone className="h-4 w-4 text-stone-400" />
      Llamar
    </a>
  );
}

export function BotonMail({
  clienteId,
  mail,
  asunto,
  cuerpo,
  yaContactado,
}: {
  clienteId: string;
  mail: string;
  asunto: string;
  cuerpo: string;
  yaContactado: boolean;
}) {
  const [, startTransition] = useTransition();
  const href = `mailto:${mail}?subject=${encodeURIComponent(asunto)}&body=${encodeURIComponent(cuerpo)}`;

  return (
    <a
      href={href}
      onClick={() => {
        if (!yaContactado) startTransition(() => void marcarContactado(clienteId));
      }}
      className="inline-flex h-9 shrink-0 items-center gap-2 rounded-lg border border-stone-300 bg-white px-3.5 text-sm font-medium text-stone-600 transition-colors hover:bg-stone-50"
      title={`Escribir a ${mail}`}
    >
      <Mail className="h-4 w-4 text-stone-400" />
      Mail
    </a>
  );
}

/** Copiar el mensaje, para cuando se escribe desde WhatsApp Web ya abierto. */
export function BotonCopiar({ texto }: { texto: string }) {
  const [copiado, setCopiado] = useState(false);

  const copiar = async () => {
    try {
      await navigator.clipboard.writeText(texto);
      setCopiado(true);
      setTimeout(() => setCopiado(false), 2000);
    } catch {
      // Sin permiso de portapapeles no hay nada que hacer desde acá: el mensaje
      // está a la vista y se puede seleccionar a mano.
      setCopiado(false);
    }
  };

  return (
    <button
      type="button"
      onClick={copiar}
      className="inline-flex h-9 shrink-0 items-center gap-2 rounded-lg border border-stone-300 bg-white px-3 text-sm font-medium text-stone-600 transition-colors hover:bg-stone-50"
      aria-label="Copiar el mensaje"
    >
      {copiado ? (
        <Check className="h-4 w-4 text-emerald-600" />
      ) : (
        <Copy className="h-4 w-4 text-stone-400" />
      )}
      {copiado ? 'Copiado' : 'Copiar'}
    </button>
  );
}
