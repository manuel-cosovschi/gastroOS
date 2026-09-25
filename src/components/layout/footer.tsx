import Link from 'next/link';
import { AtSign, Instagram, MapPin, Phone } from 'lucide-react';
import { APP_NAME } from '@/lib/constants';
import type { Business } from '@/types';

export function StorefrontFooter({ business }: { business: Business }) {
  const hasContact = business.phone || business.email || business.instagram || business.address;

  return (
    <footer className="border-t border-stone-200 bg-stone-50">
      <div className="mx-auto max-w-6xl px-4 py-12 sm:px-6">
        <div className="grid gap-8 md:grid-cols-3">
          <div>
            <h3 className="text-base font-semibold tracking-tight text-stone-900">
              {business.name}
            </h3>
            {business.industry && (
              <p className="mt-1.5 text-sm text-stone-500">{business.industry}</p>
            )}
          </div>

          <div>
            <h4 className="text-sm font-semibold text-stone-900">Navegación</h4>
            <ul className="mt-3 space-y-2 text-sm">
              <li>
                <Link href="/catalogo" className="text-stone-500 transition-colors hover:text-stone-900">
                  Catálogo
                </Link>
              </li>
              <li>
                <Link href="/paquetes" className="text-stone-500 transition-colors hover:text-stone-900">
                  Combos
                </Link>
              </li>
              <li>
                <Link href="/pedido" className="text-stone-500 transition-colors hover:text-stone-900">
                  Hacer un pedido
                </Link>
              </li>
            </ul>
          </div>

          {hasContact && (
            <div>
              <h4 className="text-sm font-semibold text-stone-900">Contacto</h4>
              <ul className="mt-3 space-y-2 text-sm text-stone-500">
                {business.phone && (
                  <li className="flex items-center gap-2">
                    <Phone className="h-3.5 w-3.5 shrink-0" />
                    {business.phone}
                  </li>
                )}
                {business.email && (
                  <li className="flex items-center gap-2">
                    <AtSign className="h-3.5 w-3.5 shrink-0" />
                    {business.email}
                  </li>
                )}
                {business.instagram && (
                  <li className="flex items-center gap-2">
                    <Instagram className="h-3.5 w-3.5 shrink-0" />@{business.instagram}
                  </li>
                )}
                {business.address && (
                  <li className="flex items-center gap-2">
                    <MapPin className="h-3.5 w-3.5 shrink-0" />
                    {business.address}
                  </li>
                )}
              </ul>
            </div>
          )}
        </div>

        <div className="mt-10 flex flex-wrap items-center justify-between gap-3 border-t border-stone-200 pt-6">
          <p className="text-xs text-stone-400">
            &copy; {new Date().getFullYear()} {business.name}
          </p>
          <p className="text-xs text-stone-400">
            Gestionado con{' '}
            <Link href="/admin" className="font-medium text-stone-500 transition-colors hover:text-stone-900">
              {APP_NAME}
            </Link>
          </p>
        </div>
      </div>
    </footer>
  );
}
