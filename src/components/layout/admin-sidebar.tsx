'use client';

import Link from 'next/link';
import Image from 'next/image';
import { usePathname } from 'next/navigation';

import {
  BarChart3,
  CalendarDays,
  ChefHat,
  ClipboardList,
  LayoutDashboard,
  LogOut,
  Package,
  Receipt,
  Settings,
  Store,
  Tags,
  Users,
  Warehouse,
  X,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { createClient } from '@/lib/supabase/client';
import { Logo } from '@/components/brand/logo';
import type { Business } from '@/types';

/** Navegación principal: el orden es el del recorrido diario del negocio. */
const PRIMARY_LINKS = [
  { href: '/admin', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/admin/pedidos', label: 'Pedidos', icon: ClipboardList },
  { href: '/admin/calendario', label: 'Calendario', icon: CalendarDays },
  { href: '/admin/clientes', label: 'Clientes', icon: Users },
  { href: '/admin/productos', label: 'Productos', icon: Package },
  { href: '/admin/stock', label: 'Stock', icon: Warehouse },
  { href: '/admin/gastos', label: 'Gastos', icon: Receipt },
  { href: '/admin/estadisticas', label: 'Estadísticas', icon: BarChart3 },
];

const SECONDARY_LINKS = [
  { href: '/admin/combos', label: 'Combos', icon: ChefHat },
  { href: '/admin/categorias', label: 'Categorías', icon: Tags },
  { href: '/admin/configuracion', label: 'Configuración', icon: Settings },
];

export function AdminSidebar({
  business,
  open,
  onClose,
}: {
  business: Business | null;
  open: boolean;
  onClose: () => void;
}) {
  const pathname = usePathname();

  const isActive = (href: string) =>
    href === '/admin' ? pathname === '/admin' : pathname.startsWith(href);

  const handleLogout = async () => {
    const supabase = createClient();
    await supabase.auth.signOut();
    window.location.href = '/admin/login';
  };

  const content = (
    <>
      <div className="flex items-center justify-between border-b border-stone-200 px-4 py-4">
        <Link href="/admin" className="flex items-center">
          <Logo size="sm" />
        </Link>
        <button
          className="rounded-md p-1.5 text-stone-500 hover:bg-stone-100 lg:hidden"
          onClick={onClose}
          aria-label="Cerrar menú"
        >
          <X className="h-5 w-5" />
        </button>
      </div>

      {business && (
        <div className="flex items-center gap-2.5 border-b border-stone-200 px-4 py-3">
          {business.logo_url ? (
            <Image
              src={business.logo_url}
              alt=""
              width={32}
              height={32}
              className="h-8 w-8 rounded-lg object-cover"
              unoptimized
            />
          ) : (
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-stone-900 text-xs font-semibold text-white">
              {business.name.slice(0, 2).toUpperCase()}
            </span>
          )}
          <div className="min-w-0">
            <p className="truncate text-sm font-medium text-stone-900">{business.name}</p>
            {business.industry && (
              <p className="truncate text-xs text-stone-500">{business.industry}</p>
            )}
          </div>
        </div>
      )}

      <nav className="flex-1 space-y-1 overflow-y-auto px-3 py-4">
        {PRIMARY_LINKS.map((link) => (
          <NavLink key={link.href} {...link} active={isActive(link.href)} />
        ))}

        <p className="px-3 pb-1 pt-5 text-[11px] font-semibold uppercase tracking-wider text-stone-400">
          Catálogo y ajustes
        </p>
        {SECONDARY_LINKS.map((link) => (
          <NavLink key={link.href} {...link} active={isActive(link.href)} />
        ))}
      </nav>

      <div className="space-y-1 border-t border-stone-200 p-3">
        {business?.storefront_enabled && (
          <Link
            href="/"
            target="_blank"
            className="flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium text-stone-500 transition-colors hover:bg-stone-100 hover:text-stone-900"
          >
            <Store className="h-4 w-4" />
            Ver tienda
          </Link>
        )}
        <button
          onClick={handleLogout}
          className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium text-stone-500 transition-colors hover:bg-stone-100 hover:text-stone-900"
        >
          <LogOut className="h-4 w-4" />
          Cerrar sesión
        </button>
      </div>
    </>
  );

  return (
    <>
      {open && (
        <div
          className="fixed inset-0 z-40 bg-stone-900/40 backdrop-blur-sm lg:hidden"
          onClick={onClose}
        />
      )}

      <aside
        className={cn(
          'fixed inset-y-0 left-0 z-50 flex w-64 flex-col border-r border-stone-200 bg-white transition-transform duration-200 lg:translate-x-0',
          open ? 'translate-x-0' : '-translate-x-full'
        )}
      >
        {content}
      </aside>
    </>
  );
}

function NavLink({
  href,
  label,
  icon: Icon,
  active,
}: {
  href: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  active: boolean;
}) {
  return (
    <Link
      href={href}
      className={cn(
        'flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors',
        active
          ? 'bg-brand-50 text-brand-800'
          : 'text-stone-600 hover:bg-stone-100 hover:text-stone-900'
      )}
    >
      <Icon className={cn('h-4 w-4', active ? 'text-brand-600' : 'text-stone-400')} />
      {label}
    </Link>
  );
}
