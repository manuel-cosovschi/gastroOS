'use client';

import Link from 'next/link';
import { Menu, Package, Plus, Receipt, UserPlus } from 'lucide-react';
import { DEMO_MODE } from '@/lib/constants';
import { cn } from '@/lib/utils';

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

export function AdminTopbar({ onOpenMenu }: { onOpenMenu: () => void }) {
  return (
    <header className="sticky top-0 z-30 border-b border-stone-200 bg-white/80 backdrop-blur">
      {DEMO_MODE && (
        <div className="bg-brand-700 px-4 py-1.5 text-center text-xs font-medium text-white">
          Estás viendo una demo de GastroOS con datos de ejemplo
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
          className="inline-flex h-9 items-center gap-2 rounded-lg bg-stone-900 px-4 text-sm font-medium text-white shadow-sm transition-colors hover:bg-stone-800"
        >
          <Plus className="h-4 w-4" />
          Nuevo pedido
        </Link>
      </div>
    </header>
  );
}
