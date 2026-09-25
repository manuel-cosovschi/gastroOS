'use client';

import { useEffect, useState } from 'react';
import { usePathname } from 'next/navigation';
import { AdminSidebar } from '@/components/layout/admin-sidebar';
import { AdminTopbar } from '@/components/layout/admin-topbar';

/**
 * Cáscara del panel.
 *
 * El estado del menú mobile vive acá y no dentro del sidebar porque el botón
 * de hamburguesa va dentro de la barra superior: si fuese `fixed` se montaría
 * encima del cartel de modo demo.
 */
export function AdminShell({
  business,
  children,
}: {
  business: Parameters<typeof AdminSidebar>[0]['business'];
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const [menuOpen, setMenuOpen] = useState(false);

  // Navegar cierra el menú: si no, tapa la pantalla recién abierta.
  useEffect(() => {
    setMenuOpen(false);
  }, [pathname]);

  return (
    <div className="min-h-screen bg-stone-50">
      <AdminSidebar business={business} open={menuOpen} onClose={() => setMenuOpen(false)} />
      <div className="lg:pl-64">
        <AdminTopbar onOpenMenu={() => setMenuOpen(true)} />
        <main className="mx-auto max-w-7xl p-4 pb-16 sm:p-6 lg:p-8">{children}</main>
      </div>
    </div>
  );
}
