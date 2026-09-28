'use client';

import { useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { usePathname } from 'next/navigation';
import { CreditCard, LayoutDashboard, LogOut, Menu, Plus, UserCog, Users, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { createClient } from '@/lib/supabase/client';

const LINKS = [
  { href: '/', label: 'Resumen', icon: LayoutDashboard },
  { href: '/clientes', label: 'Clientes', icon: Users },
  { href: '/cobros', label: 'Cobros', icon: CreditCard },
];

export function Shell({ email, children }: { email: string; children: React.ReactNode }) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  const isActive = (href: string) => (href === '/' ? pathname === '/' : pathname.startsWith(href));

  const logout = async () => {
    await createClient().auth.signOut();
    window.location.href = '/login';
  };

  return (
    <div className="min-h-screen bg-stone-50">
      {open && (
        <div
          className="fixed inset-0 z-40 bg-stone-900/40 backdrop-blur-sm lg:hidden"
          onClick={() => setOpen(false)}
        />
      )}

      <aside
        className={cn(
          'fixed inset-y-0 left-0 z-50 flex w-60 flex-col border-r border-stone-200 bg-white transition-transform duration-200 lg:translate-x-0',
          open ? 'translate-x-0' : '-translate-x-full'
        )}
      >
        <div className="flex items-center justify-between border-b border-stone-200 px-4 py-4">
          <Link href="/" className="flex items-center gap-2.5" onClick={() => setOpen(false)}>
            <Image src="/sovare.webp" alt="" width={214} height={256} className="h-7 w-auto" />
            <span className="text-sm font-semibold tracking-[0.22em] text-stone-800">SOVARE</span>
          </Link>
          <button
            className="rounded-md p-1.5 text-stone-500 hover:bg-stone-100 lg:hidden"
            onClick={() => setOpen(false)}
            aria-label="Cerrar menú"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <nav className="flex-1 space-y-1 p-3">
          {LINKS.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              onClick={() => setOpen(false)}
              className={cn(
                'flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors',
                isActive(link.href)
                  ? 'bg-brand-100 text-brand-900'
                  : 'text-stone-600 hover:bg-stone-100 hover:text-stone-900'
              )}
            >
              <link.icon
                className={cn('h-4 w-4', isActive(link.href) ? 'text-brand-700' : 'text-stone-400')}
              />
              {link.label}
            </Link>
          ))}
        </nav>

        <div className="border-t border-stone-200 p-3">
          <Link
            href="/cuenta"
            onClick={() => setOpen(false)}
            className={cn(
              'flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors',
              isActive('/cuenta')
                ? 'bg-brand-100 text-brand-900'
                : 'text-stone-600 hover:bg-stone-100 hover:text-stone-900'
            )}
          >
            <UserCog
              className={cn('h-4 w-4', isActive('/cuenta') ? 'text-brand-700' : 'text-stone-400')}
            />
            <span className="min-w-0 flex-1 truncate">{email}</span>
          </Link>
          <button
            onClick={logout}
            className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium text-stone-500 transition-colors hover:bg-stone-100 hover:text-stone-900"
          >
            <LogOut className="h-4 w-4" />
            Cerrar sesión
          </button>
        </div>
      </aside>

      <div className="lg:pl-60">
        <header className="sticky top-0 z-30 flex h-14 items-center gap-2 border-b border-stone-200 bg-white/80 px-4 backdrop-blur lg:px-6">
          <button
            onClick={() => setOpen(true)}
            className="-ml-1 rounded-lg p-2 text-stone-600 hover:bg-stone-100 lg:hidden"
            aria-label="Abrir menú"
          >
            <Menu className="h-5 w-5" />
          </button>
          <div className="flex-1" />
          <Link
            href="/clientes/nuevo"
            className="inline-flex h-9 items-center gap-2 rounded-lg bg-brand-800 px-4 text-sm font-medium text-white shadow-sm transition-colors hover:bg-brand-900"
          >
            <Plus className="h-4 w-4" />
            Nuevo cliente
          </Link>
        </header>

        <main className="mx-auto max-w-6xl p-4 pb-16 sm:p-6 lg:p-8">{children}</main>
      </div>
    </div>
  );
}
