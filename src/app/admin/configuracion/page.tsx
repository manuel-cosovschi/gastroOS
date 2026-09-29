import { getBusiness } from '@/actions/business';
import { PageHeader } from '@/components/ui/page-header';
import { BusinessSettingsForm } from '@/components/admin/settings/business-settings-form';
import { NotificationSettings } from '@/components/admin/notifications';
import { VAPID_PUBLIC_KEY, pushConfigured } from '@/lib/push';

export const metadata = { title: 'Configuración' };

export default async function SettingsPage() {
  const business = await getBusiness();

  return (
    <div className="space-y-6">
      <PageHeader
        title="Configuración"
        description="Los datos de tu negocio. Se usan en toda la aplicación y en la tienda pública."
      />

      {business ? (
        <BusinessSettingsForm business={business} />
      ) : (
        <div className="surface p-8 text-center">
          <p className="text-sm text-stone-500">
            No encontramos un negocio asociado a tu usuario. Ejecutá el seed de instalación
            (<code className="rounded bg-stone-100 px-1 py-0.5">npm run demo:seed</code>) o creá el
            negocio desde la base de datos.
          </p>
        </div>
      )}

      {/*
        Las notificaciones sólo aparecen si están configuradas del lado del
        servidor. Un interruptor que pide permiso al navegador y después no
        manda nunca nada es peor que no ofrecerlo.
      */}
      {pushConfigured() && (
        <section className="surface p-6">
          <h2 className="text-sm font-semibold text-stone-900">Notificaciones</h2>
          <p className="mb-5 mt-1 text-sm leading-relaxed text-stone-500">
            Un aviso en el teléfono cuando entra un pedido por la tienda, sin tener que estar
            mirando la pantalla.
          </p>
          <NotificationSettings vapidKey={VAPID_PUBLIC_KEY} />
        </section>
      )}
    </div>
  );
}
