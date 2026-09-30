'use client';

import { useEffect } from 'react';
import Link, { useLinkStatus } from 'next/link';
import Image from 'next/image';
import { usePathname, useRouter } from 'next/navigation';

import {
  BarChart3,
  CalendarDays,
  ChefHat,
  ClipboardList,
  LayoutDashboard,
  Loader2,
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

/**
 * Deja listas las pantallas del menú antes de que las pidan.
 *
 * El `<Link>` de Next precarga solo cuando entra en pantalla, y en el teléfono
 * el menú vive corrido fuera del viewport: nunca "entra", así que nunca
 * precargaba nada y cada toque pagaba el viaje entero al servidor. Acá se
 * piden a mano, de a una y cuando el navegador está libre, para no competir
 * con la pantalla que el visitante está mirando.
 *
 * Lo que se trae es la cáscara de cada ruta (el `loading.tsx`), no sus datos:
 * son unos pocos kB por sección y es lo que hace que el cambio de pantalla se
 * vea en el acto.
 */
function usePrefetchSections() {
  const router = useRouter();

  useEffect(() => {
    const rutas = [...PRIMARY_LINKS, ...SECONDARY_LINKS].map((link) => link.href);
    let cancelled = false;
    let timer: number | undefined;

    // En conexiones lentas o con ahorro de datos no se precarga nada: ahí el
    // tráfico de más molesta más de lo que ayuda.
    const connection = (
      navigator as Navigator & {
        connection?: { saveData?: boolean; effectiveType?: string };
      }
    ).connection;
    if (connection?.saveData || connection?.effectiveType === 'slow-2g') return;

    const siguiente = (position: number) => {
      if (cancelled || position >= rutas.length) return;
      router.prefetch(rutas[position]);
      timer = window.setTimeout(() => siguiente(position + 1), 120);
    };

    // Un respiro para que primero termine de cargar la pantalla actual.
    timer = window.setTimeout(() => siguiente(0), 1200);

    return () => {
      cancelled = true;
      if (timer) window.clearTimeout(timer);
    };
  }, [router]);
}

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
  usePrefetchSections();

  const isActive = (href: string) =>
    href === '/admin' ? pathname === '/admin' : pathname.startsWith(href);

  const handleLogout = async () => {
    const supabase = createClient();
    await supabase.auth.signOut();
    // La pantalla de login es /login: /admin/login no existe y mandaba a un 404.
    window.location.href = '/login';
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

      <nav data-tour="nav" className="flex-1 space-y-1 overflow-y-auto px-3 py-4">
        {PRIMARY_LINKS.map((link) => (
          <NavLink key={link.href} {...link} active={isActive(link.href)} onNavigate={onClose} />
        ))}

        <p className="px-3 pb-1 pt-5 text-[11px] font-semibold uppercase tracking-wider text-stone-400">
          Catálogo y ajustes
        </p>
        {SECONDARY_LINKS.map((link) => (
          <NavLink key={link.href} {...link} active={isActive(link.href)} onNavigate={onClose} />
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
  onNavigate,
}: {
  href: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  active: boolean;
  onNavigate: () => void;
}) {
  return (
    // El `prefetch` explícito es para el menú del teléfono, que está fuera de
    // pantalla: sin él Next no precarga nada de lo que hay acá adentro.
    <Link href={href} prefetch onClick={onNavigate} className="block">
      <NavLinkBody label={label} icon={Icon} active={active} />
    </Link>
  );
}

/**
 * El renglón del menú, con su estado de espera.
 *
 * `useLinkStatus` sólo funciona adentro de un `<Link>`, y por eso esto es un
 * componente aparte en vez de estilos en el link.
 *
 * Antes el único indicio de que el toque había registrado era el `hover:` gris
 * del renglón, que en una pantalla táctil queda pegado hasta que termina de
 * navegar: parecía que el sistema se había trabado. Ahora el renglón se pinta
 * como la sección activa apenas se toca y muestra que está abriendo, y el gris
 * del hover quedó sólo para los dispositivos que de verdad tienen puntero.
 */
function NavLinkBody({
  label,
  icon: Icon,
  active,
}: {
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  active: boolean;
}) {
  const { pending } = useLinkStatus();
  const highlighted = active || pending;

  return (
    <span
      className={cn(
        'flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors',
        highlighted
          ? 'bg-brand-50 text-brand-800'
          : 'text-stone-600 [@media(hover:hover)]:hover:bg-stone-100 [@media(hover:hover)]:hover:text-stone-900'
      )}
    >
      {pending && !active ? (
        <Loader2 className="h-4 w-4 shrink-0 animate-spin text-brand-600" />
      ) : (
        <Icon className={cn('h-4 w-4 shrink-0', highlighted ? 'text-brand-600' : 'text-stone-400')} />
      )}
      {label}
    </span>
  );
}
