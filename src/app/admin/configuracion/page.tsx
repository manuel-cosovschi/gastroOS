import { getBusiness } from '@/actions/business';
import { PageHeader } from '@/components/ui/page-header';
import { BusinessSettingsForm } from '@/components/admin/settings/business-settings-form';

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
    </div>
  );
}
