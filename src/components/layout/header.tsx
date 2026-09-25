import Link from 'next/link';
import Image from 'next/image';
import { CartBadge } from '@/components/cart/cart-badge';
import type { Business } from '@/types';

const NAV_LINKS = [
  { href: '/catalogo', label: 'Catálogo' },
  { href: '/paquetes', label: 'Combos' },
  { href: '/pedido/seguimiento', label: 'Seguir mi pedido' },
];

export function StorefrontHeader({ business }: { business: Business }) {
  return (
    <header className="sticky top-0 z-40 w-full border-b border-stone-200 bg-white/90 backdrop-blur">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-4 px-4 sm:px-6">
        <Link href="/catalogo" className="flex min-w-0 items-center gap-2.5">
          {business.logo_url ? (
            <Image
              src={business.logo_url}
              alt=""
              width={36}
              height={36}
              className="h-9 w-9 rounded-lg object-cover"
              unoptimized
            />
          ) : (
            <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-stone-900 text-xs font-semibold text-white">
              {business.name.slice(0, 2).toUpperCase()}
            </span>
          )}
          <span className="truncate text-lg font-semibold tracking-tight text-stone-900">
            {business.name}
          </span>
        </Link>

        <nav className="hidden items-center gap-7 md:flex">
          {NAV_LINKS.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className="text-sm font-medium text-stone-600 transition-colors hover:text-stone-900"
            >
              {link.label}
            </Link>
          ))}
        </nav>

        <CartBadge />
      </div>

      {/* En mobile la navegación va debajo del logo, siempre visible */}
      <nav className="flex items-center gap-5 overflow-x-auto border-t border-stone-100 px-4 py-2 md:hidden">
        {NAV_LINKS.map((link) => (
          <Link
            key={link.href}
            href={link.href}
            className="whitespace-nowrap text-sm font-medium text-stone-600"
          >
            {link.label}
          </Link>
        ))}
      </nav>
    </header>
  );
}
