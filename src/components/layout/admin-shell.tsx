'use client';

import { useEffect, useState } from 'react';
import { usePathname } from 'next/navigation';
import { AdminSidebar } from '@/components/layout/admin-sidebar';
import { AdminTopbar } from '@/components/layout/admin-topbar';
import { TourOverlay } from '@/components/admin/tour/tour-overlay';
import { TourProvider, useTour } from '@/components/admin/tour/tour-provider';

/**
 * Cáscara del panel.
 *
 * El estado del menú mobile vive acá y no dentro del sidebar porque el botón
 * de hamburguesa va dentro de la barra superior: si fuese `fixed` se montaría
 * encima del cartel de modo demo.
 */
export function AdminShell({
  business,
  demo,
  autoStartTour,
  children,
}: {
  business: Parameters<typeof AdminSidebar>[0]['business'];
  /** La sesión es una copia de la demo, no un negocio de verdad. */
  demo: boolean;
  /** Abrir la guía sola la primera vez (demo o negocio recién creado). */
  autoStartTour: boolean;
  children: React.ReactNode;
}) {
  return (
    <TourProvider demo={demo} autoStart={autoStartTour}>
      <AdminShellInner business={business} demo={demo}>
        {children}
      </AdminShellInner>
      <TourOverlay />
    </TourProvider>
  );
}

function AdminShellInner({
  business,
  demo,
  children,
}: {
  business: Parameters<typeof AdminSidebar>[0]['business'];
  demo: boolean;
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const [menuOpen, setMenuOpen] = useState(false);
  const { needsSidebar } = useTour();

  // Navegar cierra el menú: si no, tapa la pantalla recién abierta.
  useEffect(() => {
    setMenuOpen(false);
  }, [pathname]);

  // Cuando la guía señala algo del menú, el menú tiene que estar abierto. Se
  // resuelve con un `or` y no con un `setState` para que los dos efectos no
  // se peleen: el de arriba lo cierra al navegar y la guía lo volvería a
  // abrir, dejando el menú parpadeando.
  const sidebarOpen = menuOpen || needsSidebar;

  return (
    <div className="min-h-screen bg-stone-50">
      <AdminSidebar business={business} open={sidebarOpen} onClose={() => setMenuOpen(false)} />
      <div className="lg:pl-64">
        <AdminTopbar demo={demo} onOpenMenu={() => setMenuOpen(true)} />
        <main className="mx-auto max-w-7xl p-4 pb-16 sm:p-6 lg:p-8">{children}</main>
      </div>
    </div>
  );
}
