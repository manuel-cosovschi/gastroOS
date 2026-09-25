import Link from 'next/link';
import { AlertTriangle, Boxes, Plus, ShoppingCart, Warehouse } from 'lucide-react';
import { listIngredients } from '@/actions/ingredients';
import { generateStockAlerts, getInventoryValuation, getPurchaseSuggestions } from '@/actions/inventory';
import { getCurrentBusiness } from '@/lib/business';
import { PageHeader } from '@/components/ui/page-header';
import { StatCard } from '@/components/ui/stat-card';
import { EmptyState } from '@/components/ui/empty-state';
import { Button } from '@/components/ui/button';
import { cn, formatPrice } from '@/lib/utils';

export const metadata = { title: 'Stock' };

/**
 * Stock de insumos: qué hay, qué falta y cuánto vale el inventario.
 * La lista de compra sale sola de los insumos por debajo del mínimo.
 */
export default async function StockPage() {
  const [ingredients, alerts, valuation, suggestions, business] = await Promise.all([
    listIngredients(),
    generateStockAlerts(),
    getInventoryValuation(),
    getPurchaseSuggestions(),
    getCurrentBusiness(),
  ]);

  const money = (value: number) =>
    formatPrice(value, { currency: business?.currency, locale: business?.locale });

  const lowStock = alerts.filter((alert) => alert.type !== 'missing_recipe');
  const purchaseTotal = suggestions.reduce((sum, item) => sum + item.estimated_cost, 0);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Stock"
        description="Insumos, mínimos y valorización del inventario."
        actions={
          <Button asChild>
            <Link href="/admin/stock/nuevo">
              <Plus className="h-4 w-4" />
              Nuevo insumo
            </Link>
          </Button>
        }
      />

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard label="Insumos activos" value={String(ingredients.filter((i) => i.is_active).length)} icon={Boxes} />
        <StatCard
          label="Bajo el mínimo"
          value={String(lowStock.length)}
          icon={AlertTriangle}
          accent={lowStock.length > 0 ? 'warning' : 'default'}
        />
        <StatCard label="Valor en insumos" value={money(valuation.ingredients_value)} icon={Warehouse} />
        <StatCard
          label="Reposición estimada"
          value={money(purchaseTotal)}
          icon={ShoppingCart}
          hint={suggestions.length > 0 ? `${suggestions.length} insumos a reponer` : 'Todo en orden'}
        />
      </div>

      {suggestions.length > 0 && (
        <section className="rounded-xl border border-amber-200 bg-amber-50">
          <header className="flex items-center gap-2 border-b border-amber-200 px-5 py-3">
            <ShoppingCart className="h-4 w-4 text-amber-600" />
            <h2 className="text-sm font-semibold text-amber-900">Lista de compra sugerida</h2>
          </header>
          <ul className="divide-y divide-amber-100">
            {suggestions.map((item) => (
              <li
                key={item.ingredient_id}
                className="flex items-center justify-between gap-3 px-5 py-2.5 text-sm"
              >
                <Link
                  href={`/admin/stock/${item.ingredient_id}`}
                  className="font-medium text-stone-900 hover:underline"
                >
                  {item.ingredient_name}
                </Link>
                <span className="text-stone-600">
                  comprar {item.to_buy} {item.unit}
                </span>
                <span className="w-24 text-right font-semibold tabular text-stone-900">
                  {money(item.estimated_cost)}
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}

      <div className="surface overflow-hidden">
        {ingredients.length === 0 ? (
          <EmptyState
            icon={Warehouse}
            title="Todavía no cargaste insumos"
            description="Cargá harina, azúcar, packaging y todo lo que consumís para que GastroOS te avise cuando se está por acabar."
            actionLabel="Cargar el primero"
            actionHref="/admin/stock/nuevo"
          />
        ) : (
          <div className="scroll-subtle overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="border-b border-stone-200 bg-stone-50/80">
                <tr className="text-left text-xs uppercase tracking-wide text-stone-500">
                  <th className="px-4 py-3 font-medium">Insumo</th>
                  <th className="hidden px-4 py-3 font-medium sm:table-cell">Categoría</th>
                  <th className="px-4 py-3 text-right font-medium">Stock</th>
                  <th className="px-4 py-3 text-right font-medium">Mínimo</th>
                  <th className="hidden px-4 py-3 text-right font-medium md:table-cell">
                    Costo unit.
                  </th>
                  <th className="hidden px-4 py-3 font-medium lg:table-cell">Proveedor</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-stone-100">
                {ingredients.map((ingredient) => {
                  const isLow =
                    Number(ingredient.stock_quantity) < Number(ingredient.min_stock_quantity);
                  const isOut = Number(ingredient.stock_quantity) <= 0;

                  return (
                    <tr key={ingredient.id} className="transition-colors hover:bg-stone-50">
                      <td className="px-4 py-3">
                        <Link
                          href={`/admin/stock/${ingredient.id}`}
                          className="flex items-center gap-2 font-medium text-stone-900 hover:text-brand-700"
                        >
                          {isLow && (
                            <span
                              className={cn(
                                'h-2 w-2 shrink-0 rounded-full',
                                isOut ? 'bg-rose-500' : 'bg-amber-500'
                              )}
                              title={isOut ? 'Sin stock' : 'Bajo el mínimo'}
                            />
                          )}
                          {ingredient.name}
                        </Link>
                      </td>
                      <td className="hidden px-4 py-3 text-stone-500 sm:table-cell">
                        {ingredient.category || '—'}
                      </td>
                      <td
                        className={cn(
                          'px-4 py-3 text-right font-medium tabular',
                          isOut ? 'text-rose-600' : isLow ? 'text-amber-700' : 'text-stone-900'
                        )}
                      >
                        {ingredient.stock_quantity} {ingredient.unit}
                      </td>
                      <td className="px-4 py-3 text-right tabular text-stone-500">
                        {ingredient.min_stock_quantity} {ingredient.unit}
                      </td>
                      <td className="hidden px-4 py-3 text-right tabular text-stone-600 md:table-cell">
                        {money(Number(ingredient.cost_per_unit))}
                      </td>
                      <td className="hidden px-4 py-3 text-stone-500 lg:table-cell">
                        {ingredient.supplier || '—'}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
