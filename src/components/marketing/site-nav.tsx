'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Menu, X } from 'lucide-react';
import { Logo } from '@/components/brand/logo';
import { cn } from '@/lib/utils';
import { BookDemoButton, TryDemoButton } from './cta-buttons';
import { BOOKING_URL } from '@/lib/marketing';

const LINKS = [
  { href: '#producto', label: 'Producto' },
  { href: '#como-funciona', label: 'Cómo funciona' },
  { href: '#por-que', label: 'Por qué GastroOS' },
  { href: '#faq', label: 'Preguntas' },
];

export function SiteNav() {
  const [scrolled, setScrolled] = useState(false);
  const [open, setOpen] = useState(false);

  // La barra gana borde y fondo al salir del hero, para no competir con él.
  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 12);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  return (
    <header
      className={cn(
        'sticky top-0 z-50 transition-colors',
        scrolled ? 'border-b border-stone-200 bg-white/90 backdrop-blur' : 'bg-transparent'
      )}
    >
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-6 px-4 sm:px-6">
        <Link href="/" className="shrink-0">
          <Logo size="sm" />
        </Link>

        <nav className="hidden items-center gap-7 md:flex">
          {LINKS.map((link) => (
            <a
              key={link.href}
              href={link.href}
              className="text-sm font-medium text-stone-600 transition-colors hover:text-stone-900"
            >
              {link.label}
            </a>
          ))}
        </nav>

        <div className="hidden items-center gap-2 md:flex">
          <TryDemoButton size="md" />
          <BookDemoButton size="md" />
        </div>

        <button
          onClick={() => setOpen(!open)}
          className="rounded-lg p-2 text-stone-600 transition-colors hover:bg-stone-100 md:hidden"
          aria-label={open ? 'Cerrar menú' : 'Abrir menú'}
        >
          {open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
        </button>
      </div>

      {open && (
        <div className="border-t border-stone-200 bg-white px-4 py-4 md:hidden">
          <nav className="flex flex-col gap-1">
            {LINKS.map((link) => (
              <a
                key={link.href}
                href={link.href}
                onClick={() => setOpen(false)}
                className="rounded-lg px-3 py-2.5 text-sm font-medium text-stone-700 hover:bg-stone-50"
              >
                {link.label}
              </a>
            ))}
          </nav>
          <div className="mt-3 flex flex-col gap-2">
            <TryDemoButton className="w-full" />
            {BOOKING_URL && <BookDemoButton className="w-full" />}
          </div>
        </div>
      )}
    </header>
  );
}
