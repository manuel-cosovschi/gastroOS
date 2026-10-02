'use client';

import Link, { useLinkStatus } from 'next/link';
import { HelpCircle, Loader2, Menu, Package, Plus, Receipt, UserPlus } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useTour } from '@/components/admin/tour/tour-provider';
import { ResetDemoButton } from '@/components/demo/reset-demo-button';

/**
 * Barra superior con las acciones rápidas.
 *
 * "Nuevo pedido" es la acción central del producto y por eso es el único botón
 * sólido; el resto son atajos secundarios. En mobile queda sólo el principal,
 * que es lo que se usa desde el teléfono.
 */

const SHORTCUTS = [
  { href: '/admin/clientes/nuevo', label: 'Nuevo cliente', icon: UserPlus },
  { href: '/admin/gastos?nuevo=1', label: 'Registrar gasto', icon: Receipt },
  { href: '/admin/productos/nuevo', label: 'Nuevo producto', icon: Package },
];

export function AdminTopbar({
  demo,
  onOpenMenu,
}: {
  /** Sólo una copia de la demo lleva el cartel y el botón de reiniciar. */
  demo: boolean;
  onOpenMenu: () => void;
}) {
  const { start } = useTour();

  return (
    <header className="sticky top-0 z-30 border-b border-stone-200 bg-white/80 backdrop-blur">
      {demo && (
        <div className="flex flex-wrap items-center justify-center gap-x-3 gap-y-1 bg-brand-700 px-4 py-1.5 text-center text-xs font-medium text-white">
          {/* "Esta demo es tuya" no es un detalle de cortesía: es la respuesta
              a la primera duda de cualquiera que va a tocar algo. Cada
              visitante recibe su propia copia de los datos de ejemplo. */}
          <span>Esta demo es tuya: cambiá lo que quieras, nadie más lo ve.</span>
          <button onClick={() => start()} className="underline underline-offset-2">
            Ver la guía
          </button>
          <ResetDemoButton />
        </div>
      )}
      <div className="flex h-14 items-center gap-2 px-4 lg:px-6">
        <button
          onClick={onOpenMenu}
          className="-ml-1 rounded-lg p-2 text-stone-600 transition-colors hover:bg-stone-100 lg:hidden"
          aria-label="Abrir menú"
        >
          <Menu className="h-5 w-5" />
        </button>

        <div className="flex-1" />

        {/* La guía queda siempre a mano, no sólo en la demo: un sistema que
            hay que explicar una sola vez igual se olvida a los dos meses. */}
        <button
          onClick={() => start()}
          data-tour="guide"
          title="Ver la guía del sistema"
          className="inline-flex h-9 items-center gap-2 rounded-lg px-3 text-sm font-medium text-stone-600 transition-colors hover:bg-stone-100 hover:text-stone-900"
        >
          <HelpCircle className="h-4 w-4" />
          <span className="hidden sm:inline">Guía</span>
        </button>

        <div className="hidden items-center gap-1 sm:flex">
          {SHORTCUTS.map((shortcut) => (
            <Link
              key={shortcut.href}
              href={shortcut.href}
              title={shortcut.label}
              className={cn(
                'inline-flex h-9 items-center gap-2 rounded-lg px-3 text-sm font-medium',
                'text-stone-600 transition-colors hover:bg-stone-100 hover:text-stone-900'
              )}
            >
              <shortcut.icon className="h-4 w-4" />
              <span className="hidden xl:inline">{shortcut.label}</span>
            </Link>
          ))}
          <span className="mx-1 h-5 w-px bg-stone-200" />
        </div>

        <Link
          href="/admin/pedidos/nuevo"
          prefetch
          data-tour="new-order"
          className="inline-flex h-9 items-center gap-2 rounded-lg bg-brand-600 px-4 text-sm font-medium text-white shadow-sm transition-colors hover:bg-brand-700"
        >
          <NewOrderLabel />
        </Link>
      </div>
    </header>
  );
}

/**
 * El botón principal, mostrando que el toque registró.
 *
 * Es la acción que más se usa y la que más se toca dos veces creyendo que no
 * anduvo. `useLinkStatus` sólo lee el estado del `<Link>` que lo contiene, así
 * que esto tiene que ser un componente aparte.
 */
function NewOrderLabel() {
  const { pending } = useLinkStatus();

  return (
    <>
      {pending ? (
        <Loader2 className="h-4 w-4 animate-spin" />
      ) : (
        <Plus className="h-4 w-4" />
      )}
      Nuevo pedido
    </>
  );
}
