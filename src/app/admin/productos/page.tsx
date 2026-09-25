import Link from 'next/link';
import Image from 'next/image';
import { Package, Plus, Tags } from 'lucide-react';
import { listProductsWithMargin } from '@/actions/products';
import { getCurrentBusiness } from '@/lib/business';
import { PageHeader } from '@/components/ui/page-header';
import { EmptyState } from '@/components/ui/empty-state';
import { Button } from '@/components/ui/button';
import { cn, formatPrice } from '@/lib/utils';

export const metadata = { title: 'Productos' };

export default async function ProductsPage() {
  const [products, business] = await Promise.all([
    listProductsWithMargin(),
    getCurrentBusiness(),
  ]);

  const money = (value: number) =>
    formatPrice(value, { currency: business?.currency, locale: business?.locale });

  return (
    <div className="space-y-6">
      <PageHeader
        title="Productos"
        description="Tu catálogo, con el precio, el costo y el margen de cada cosa."
        actions={
          <>
            <Button asChild variant="outline">
              <Link href="/admin/categorias">
                <Tags className="h-4 w-4" />
                Categorías
              </Link>
            </Button>
            <Button asChild>
              <Link href="/admin/productos/nuevo">
                <Plus className="h-4 w-4" />
                Nuevo producto
              </Link>
            </Button>
          </>
        }
      />

      <div className="surface overflow-hidden">
        {products.length === 0 ? (
          <EmptyState
            icon={Package}
            title="Todavía no cargaste productos"
            description="Cargá lo que vendés con su precio y su costo para que GastroOS calcule tu margen solo."
            actionLabel="Crear el primero"
            actionHref="/admin/productos/nuevo"
          />
        ) : (
          <div className="scroll-subtle overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="border-b border-stone-200 bg-stone-50/80">
                <tr className="text-left text-xs uppercase tracking-wide text-stone-500">
                  <th className="px-4 py-3 font-medium">Producto</th>
                  <th className="hidden px-4 py-3 font-medium sm:table-cell">Categoría</th>
                  <th className="px-4 py-3 text-right font-medium">Precio</th>
                  <th className="hidden px-4 py-3 text-right font-medium md:table-cell">Costo</th>
                  <th className="px-4 py-3 text-right font-medium">Margen</th>
                  <th className="hidden px-4 py-3 text-right font-medium lg:table-cell">Stock</th>
                  <th className="px-4 py-3 font-medium">Estado</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-stone-100">
                {products.map((product) => (
                  <tr key={product.id} className="transition-colors hover:bg-stone-50">
                    <td className="px-4 py-3">
                      <Link
                        href={`/admin/productos/${product.id}`}
                        className="flex items-center gap-3"
                      >
                        {product.image_url ? (
                          <Image
                            src={product.image_url}
                            alt=""
                            width={36}
                            height={36}
                            className="h-9 w-9 shrink-0 rounded-lg object-cover"
                            unoptimized
                          />
                        ) : (
                          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-stone-100">
                            <Package className="h-4 w-4 text-stone-400" />
                          </span>
                        )}
                        <span className="font-medium text-stone-900">{product.name}</span>
                      </Link>
                    </td>
                    <td className="hidden px-4 py-3 text-stone-500 sm:table-cell">
                      {product.category?.name || '—'}
                    </td>
                    <td className="px-4 py-3 text-right font-medium tabular text-stone-900">
                      {money(product.price)}
                    </td>
                    <td className="hidden px-4 py-3 text-right tabular text-stone-500 md:table-cell">
                      {product.unit_cost > 0 ? money(product.unit_cost) : '—'}
                    </td>
                    <td className="px-4 py-3 text-right tabular">
                      {product.unit_cost > 0 ? (
                        <span
                          className={cn(
                            'font-medium',
                            product.margin_pct >= 40
                              ? 'text-brand-700'
                              : product.margin_pct >= 20
                                ? 'text-amber-700'
                                : 'text-rose-600'
                          )}
                        >
                          {product.margin_pct}%
                        </span>
                      ) : (
                        <span className="text-xs text-stone-400">sin costo</span>
                      )}
                    </td>
                    <td className="hidden px-4 py-3 text-right tabular lg:table-cell">
                      <span
                        className={
                          product.min_stock_quantity > 0 &&
                          product.stock_quantity < product.min_stock_quantity
                            ? 'text-amber-700'
                            : 'text-stone-500'
                        }
                      >
                        {product.stock_quantity}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={cn(
                          'inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ring-1 ring-inset',
                          product.is_active
                            ? 'bg-brand-50 text-brand-800 ring-brand-200'
                            : 'bg-stone-100 text-stone-600 ring-stone-200'
                        )}
                      >
                        {product.is_active ? 'Activo' : 'Inactivo'}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
