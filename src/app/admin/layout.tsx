import { getCurrentBusiness } from '@/lib/business';
import { AdminShell } from '@/components/layout/admin-shell';
import { BusinessProvider } from '@/components/admin/business-provider';
import { InstallBanner, ServiceWorkerRegistration } from '@/components/admin/pwa';

/**
 * Shell del panel.
 *
 * El negocio se resuelve una sola vez acá y baja por contexto: ninguna página
 * tiene que volver a pedirlo sólo para saber en qué moneda mostrar un importe.
 * La pantalla de login vive bajo /admin pero no usa este shell — tiene su
 * propio layout, así que acá siempre hay sesión.
 *
 * El service worker se registra sólo acá: el panel es lo que se instala en el
 * teléfono y lo que recibe las notificaciones. La tienda es una página que se
 * comparte por link y no gana nada con uno.
 */
export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const business = await getCurrentBusiness();

  return (
    <BusinessProvider business={business}>
      <ServiceWorkerRegistration />
      <AdminShell business={business}>
        <InstallBanner />
        {children}
      </AdminShell>
    </BusinessProvider>
  );
}
