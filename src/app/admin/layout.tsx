import { redirect } from 'next/navigation';
import { getCurrentBusiness, isDemoSession } from '@/lib/business';
import { AdminShell } from '@/components/layout/admin-shell';
import { BusinessProvider } from '@/components/admin/business-provider';
import { InstallBanner, ServiceWorkerRegistration } from '@/components/admin/pwa';

/** Un negocio es "nuevo" durante su primera semana: la guía se le ofrece sola. */
const NEW_BUSINESS_DAYS = 7;

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
  const [business, demo] = await Promise.all([getCurrentBusiness(), isDemoSession()]);

  // Sesión válida pero sin negocio: es una demo que venció y se limpió
  // mientras la cookie seguía viva. No hay panel que mostrar, y cada pantalla
  // fallaría por su cuenta con un error distinto. Se cierra la sesión y vuelve
  // al inicio, donde "Entrar a la demo" le arma una nueva. Va por `/salir` y
  // no directo a `/login` porque el middleware, viendo la sesión todavía
  // abierta, lo mandaría de vuelta acá en un círculo sin fin.
  if (!business) redirect('/salir');

  return (
    <BusinessProvider business={business}>
      <ServiceWorkerRegistration />
      <AdminShell
        business={business}
        demo={demo}
        autoStartTour={demo || isNewBusiness(business.created_at)}
      >
        <InstallBanner />
        {children}
      </AdminShell>
    </BusinessProvider>
  );
}

function isNewBusiness(createdAt: string | null | undefined): boolean {
  if (!createdAt) return false;
  const age = Date.now() - new Date(createdAt).getTime();
  return age >= 0 && age < NEW_BUSINESS_DAYS * 24 * 60 * 60 * 1000;
}
