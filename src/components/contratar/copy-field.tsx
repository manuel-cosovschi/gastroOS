'use client';

import { useState } from 'react';
import { Check, Copy } from 'lucide-react';
import { cn } from '@/lib/utils';

/**
 * Un dato bancario con botón de copiar.
 *
 * Existe porque el caso real es alguien copiando un CBU de 22 dígitos desde el
 * teléfono para pegarlo en la app del banco. Un dígito mal y la transferencia
 * va a la cuenta de otra persona, así que esto no es una comodidad.
 */
export function CopyField({
  label,
  value,
  mono,
}: {
  label: string;
  value: string;
  mono?: boolean;
}) {
  const [copied, setCopied] = useState(false);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      // Sin permiso de portapapeles el dato igual está a la vista para copiarlo
      // a mano; que falle no puede romper nada.
    }
  };

  return (
    <div className="flex min-w-0 items-center justify-between gap-3 border-b border-stone-100 py-2.5 last:border-0">
      <div className="min-w-0">
        <p className="text-xs text-stone-500">{label}</p>
        <p
          className={cn(
            'truncate text-sm font-medium text-stone-900',
            mono && 'font-mono tracking-tight'
          )}
        >
          {value}
        </p>
      </div>
      <button
        type="button"
        onClick={copy}
        className="inline-flex shrink-0 items-center gap-1.5 rounded-md border border-stone-200 px-2.5 py-1.5 text-xs font-medium text-stone-600 transition-colors hover:bg-stone-50 hover:text-stone-900"
        aria-label={`Copiar ${label}`}
      >
        {copied ? (
          <>
            <Check className="h-3.5 w-3.5 text-brand-600" />
            Copiado
          </>
        ) : (
          <>
            <Copy className="h-3.5 w-3.5" />
            Copiar
          </>
        )}
      </button>
    </div>
  );
}
