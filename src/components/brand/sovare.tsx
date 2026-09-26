import Image from 'next/image';
import { cn } from '@/lib/utils';

/**
 * Crédito de autoría: GastroOS es un producto de SOVARE.
 *
 * El isotipo va como imagen y el nombre como texto, no como una sola captura:
 * así se lee nítido en cualquier pantalla, escala con el tipo del sistema y
 * queda en el HTML para buscadores y lectores de pantalla.
 */

export const SOVARE_NAME = 'SOVARE';
export const SOVARE_TAGLINE = 'From where we come. For what comes next.';

export function SovareMark({ className }: { className?: string }) {
  return (
    <Image
      src="/marca/sovare-isotipo.webp"
      alt=""
      width={214}
      height={256}
      className={cn('h-8 w-auto', className)}
    />
  );
}

export function SovareCredit({ className }: { className?: string }) {
  return (
    <div className={cn('flex items-center gap-3', className)}>
      <SovareMark className="h-9 opacity-85" />
      <div className="leading-tight">
        <p className="text-[11px] uppercase tracking-[0.16em] text-stone-400">Un producto de</p>
        <p className="text-sm font-semibold tracking-[0.28em] text-stone-700">{SOVARE_NAME}</p>
        <p className="mt-0.5 text-[11px] italic text-stone-400">{SOVARE_TAGLINE}</p>
      </div>
    </div>
  );
}
