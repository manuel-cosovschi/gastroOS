import Image from 'next/image';
import { cn } from '@/lib/utils';
import { SOVARE_PANEL_URL } from '@/lib/marketing';

/**
 * Crédito de autoría: GastroOS es un producto de SOVARE.
 *
 * El isotipo va como imagen y el nombre como texto, no como una sola captura:
 * así se lee nítido en cualquier pantalla, escala con el tipo del sistema y
 * queda en el HTML para buscadores y lectores de pantalla.
 *
 * Con `NEXT_PUBLIC_SOVARE_PANEL_URL` cargada, el crédito es además la puerta de
 * entrada al panel interno. Va como variable de entorno y no clavada en el
 * código porque este repositorio es la plantilla que se forkea por cliente: la
 * URL del panel de SOVARE no tiene por qué viajar en la instalación de nadie.
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

function CreditBody() {
  return (
    <>
      <SovareMark className="h-9 opacity-85 transition-opacity group-hover:opacity-100" />
      <div className="leading-tight">
        <p className="text-[11px] uppercase tracking-[0.16em] text-stone-400">Un producto de</p>
        <p className="text-sm font-semibold tracking-[0.28em] text-stone-700 transition-colors group-hover:text-stone-900">
          {SOVARE_NAME}
        </p>
        <p className="mt-0.5 text-[11px] italic text-stone-400">{SOVARE_TAGLINE}</p>
      </div>
    </>
  );
}

export function SovareCredit({ className }: { className?: string }) {
  const layout = 'flex items-center gap-3';

  if (!SOVARE_PANEL_URL) {
    return (
      <div className={cn(layout, className)}>
        <CreditBody />
      </div>
    );
  }

  return (
    <a
      href={SOVARE_PANEL_URL}
      target="_blank"
      rel="noreferrer"
      title="Panel interno de SOVARE"
      className={cn(
        layout,
        'group -m-2 rounded-xl p-2 transition-colors hover:bg-stone-100',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500',
        className
      )}
    >
      <CreditBody />
    </a>
  );
}
