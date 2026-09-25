import { PackageOpen } from 'lucide-react';
import { getActivePackages } from '@/actions/catalog';
import { PackageCard } from '@/components/catalog/package-card';

export const metadata = { title: 'Combos' };

export default async function PackagesPage() {
  const packages = await getActivePackages();

  return (
    <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6">
      <h1 className="text-3xl font-semibold tracking-tight text-stone-900">Combos</h1>
      <p className="mt-2 text-stone-500">Opciones ya armadas, listas para pedir.</p>

      <div className="mt-8">
        {packages.length === 0 ? (
          <div className="flex flex-col items-center py-16 text-center">
            <span className="mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-stone-100">
              <PackageOpen className="h-5 w-5 text-stone-400" />
            </span>
            <p className="text-sm text-stone-500">
              Todavía no hay combos publicados. Mirá el catálogo completo.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {packages.map((pkg) => (
              <PackageCard key={pkg.id} pkg={pkg} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
