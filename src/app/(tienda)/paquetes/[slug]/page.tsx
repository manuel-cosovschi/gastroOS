import { notFound } from 'next/navigation';
import Image from 'next/image';
import Link from 'next/link';
import { getPackageBySlug } from '@/actions/catalog';
import { formatPrice } from '@/lib/utils';
import { ArrowLeft, ImageIcon } from 'lucide-react';
import { AddPackageToCartButton } from './add-package-button';

interface Props {
  params: Promise<{ slug: string }>;
}

export default async function PackageDetailPage({ params }: Props) {
  const { slug } = await params;
  const pkg = await getPackageBySlug(slug);

  if (!pkg) notFound();

  return (
    <>
      <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        <Link
          href="/paquetes"
          className="inline-flex items-center text-sm text-stone-500 hover:text-stone-900 mb-6"
        >
          <ArrowLeft className="mr-1 h-4 w-4" /> Volver a paquetes
        </Link>

        <div className="grid grid-cols-1 gap-8 lg:grid-cols-2">
          <div className="relative aspect-[4/3] overflow-hidden rounded-lg bg-stone-100">
            {pkg.image_url ? (
              <Image src={pkg.image_url} alt={pkg.name} fill className="object-cover" priority />
            ) : (
              <div className="flex h-full items-center justify-center text-stone-300">
                <ImageIcon className="h-10 w-10 text-stone-300" />
              </div>
            )}
          </div>

          <div className="space-y-6">
            <h1 className="text-3xl font-bold text-stone-900">{pkg.name}</h1>
            <p className="text-3xl font-bold text-stone-900">{formatPrice(pkg.price)}</p>

            {pkg.description && (
              <p className="text-lg text-stone-600">{pkg.description}</p>
            )}

            {pkg.items.length > 0 && (
              <div>
                <h3 className="text-sm font-semibold text-stone-900 uppercase tracking-wide mb-3">
                  Incluye
                </h3>
                <ul className="space-y-2">
                  {pkg.items.map((item) => (
                    <li key={item.id} className="flex items-center justify-between text-sm">
                      <span className="text-stone-700">
                        {item.product?.name || 'Producto'}
                      </span>
                      <span className="text-stone-500">x{item.quantity}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {pkg.is_editable && (
              <p className="text-sm text-stone-500 italic">
                Este paquete es personalizable — podés ajustar las cantidades.
              </p>
            )}

            <AddPackageToCartButton pkg={pkg} />
          </div>
        </div>
      </main>
    </>
  );
}
