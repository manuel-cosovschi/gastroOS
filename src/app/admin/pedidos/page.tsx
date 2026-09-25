'use client';

import { useEffect, useState, useTransition } from 'react';
import Link from 'next/link';
import { ClipboardList, Plus, Search } from 'lucide-react';
import { listOrders } from '@/actions/orders';
import { PageHeader } from '@/components/ui/page-header';
import { EmptyState } from '@/components/ui/empty-state';
import { Skeleton } from '@/components/ui/spinner';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { OrderStatusBadge } from '@/components/admin/orders/order-status-badge';
import { useMoney } from '@/components/admin/business-provider';
import { cn, formatDate, formatTime } from '@/lib/utils';
import { ORDER_STATUSES, ORDER_STATUS_LABELS, type Order, type OrderStatus } from '@/types';

type Scope = 'upcoming' | 'all' | 'history';

const SCOPES: { value: Scope; label: string }[] = [
  { value: 'upcoming', label: 'Próximos' },
  { value: 'all', label: 'Todos' },
  { value: 'history', label: 'Históricos' },
];

const PER_PAGE = 20;

export default function OrdersPage() {
  const money = useMoney();
  const [orders, setOrders] = useState<Order[]>([]);
  const [total, setTotal] = useState(0);
  const [scope, setScope] = useState<Scope>('upcoming');
  const [status, setStatus] = useState<'all' | OrderStatus>('all');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [, startTransition] = useTransition();

  // Debounce de la búsqueda: escribir no dispara una consulta por tecla.
  const [debouncedSearch, setDebouncedSearch] = useState('');
  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(search), 300);
    return () => clearTimeout(timer);
  }, [search]);

  useEffect(() => {
    let active = true;
    setLoading(true);

    listOrders({
      scope,
      status: status === 'all' ? undefined : status,
      search: debouncedSearch || undefined,
      page,
      per_page: PER_PAGE,
    }).then((result) => {
      if (!active) return;
      startTransition(() => {
        setOrders(result.orders);
        setTotal(result.total);
        setLoading(false);
      });
    });

    return () => {
      active = false;
    };
  }, [scope, status, debouncedSearch, page]);

  const totalPages = Math.max(1, Math.ceil(total / PER_PAGE));

  const resetPage = <T,>(setter: (value: T) => void) => (value: T) => {
    setter(value);
    setPage(1);
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Pedidos"
        description="Todo lo que entró, en qué estado está y cuándo se entrega."
        actions={
          <Button asChild>
            <Link href="/admin/pedidos/nuevo">
              <Plus className="h-4 w-4" />
              Nuevo pedido
            </Link>
          </Button>
        }
      />

      {/* Filtros: en una sola fila arriba de la tabla */}
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
        <div className="inline-flex rounded-lg border border-stone-200 bg-white p-0.5">
          {SCOPES.map((option) => (
            <button
              key={option.value}
              onClick={() => resetPage(setScope)(option.value)}
              className={cn(
                'rounded-md px-3 py-1.5 text-sm font-medium transition-colors',
                scope === option.value
                  ? 'bg-stone-900 text-white'
                  : 'text-stone-600 hover:text-stone-900'
              )}
            >
              {option.label}
            </button>
          ))}
        </div>

        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-stone-400" />
          <Input
            placeholder="Buscar por cliente, teléfono o email…"
            value={search}
            onChange={(event) => resetPage(setSearch)(event.target.value)}
            className="pl-9"
          />
        </div>

        <select
          value={status}
          onChange={(event) => resetPage(setStatus)(event.target.value as 'all' | OrderStatus)}
          className="h-10 rounded-md border border-stone-300 bg-white px-3 text-sm text-stone-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 lg:w-52"
        >
          <option value="all">Todos los estados</option>
          {ORDER_STATUSES.map((value) => (
            <option key={value} value={value}>
              {ORDER_STATUS_LABELS[value]}
            </option>
          ))}
        </select>
      </div>

      <div className="surface overflow-hidden">
        {loading ? (
          <div className="space-y-3 p-5">
            {Array.from({ length: 6 }).map((_, index) => (
              <Skeleton key={index} className="h-12 w-full" />
            ))}
          </div>
        ) : orders.length === 0 ? (
          <EmptyState
            icon={ClipboardList}
            title="No hay pedidos para mostrar"
            description={
              search || status !== 'all'
                ? 'Probá cambiando los filtros o el término de búsqueda.'
                : 'Cargá tu primer pedido y empezá a ver el movimiento del negocio.'
            }
            actionLabel={search || status !== 'all' ? undefined : 'Nuevo pedido'}
            actionHref="/admin/pedidos/nuevo"
          />
        ) : (
          <>
            {/* Tabla en desktop */}
            <div className="scroll-subtle hidden overflow-x-auto md:block">
              <table className="w-full text-sm">
                <thead className="border-b border-stone-200 bg-stone-50/80">
                  <tr className="text-left text-xs uppercase tracking-wide text-stone-500">
                    <th className="px-4 py-3 font-medium">#</th>
                    <th className="px-4 py-3 font-medium">Cliente</th>
                    <th className="px-4 py-3 font-medium">Entrega</th>
                    <th className="px-4 py-3 text-right font-medium">Total</th>
                    <th className="px-4 py-3 text-right font-medium">Saldo</th>
                    <th className="px-4 py-3 font-medium">Estado</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-stone-100">
                  {orders.map((order) => (
                    <tr key={order.id} className="transition-colors hover:bg-stone-50">
                      <td className="px-4 py-3">
                        <Link
                          href={`/admin/pedidos/${order.id}`}
                          className="font-medium text-stone-900 hover:text-brand-700"
                        >
                          #{order.order_number}
                        </Link>
                      </td>
                      <td className="px-4 py-3">
                        <Link href={`/admin/pedidos/${order.id}`} className="block">
                          <span className="font-medium text-stone-900">{order.contact_name}</span>
                          {order.phone && (
                            <span className="block text-xs text-stone-500">{order.phone}</span>
                          )}
                        </Link>
                      </td>
                      <td className="px-4 py-3 text-stone-600">
                        {formatDate(order.delivery_date)}
                        {order.delivery_time && (
                          <span className="ml-1 text-stone-400">{formatTime(order.delivery_time)}</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-right font-medium tabular text-stone-900">
                        {money(order.subtotal)}
                      </td>
                      <td className="px-4 py-3 text-right tabular">
                        <span className={order.balance_due > 0 ? 'text-amber-700' : 'text-stone-400'}>
                          {money(order.balance_due)}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <OrderStatusBadge status={order.status} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Tarjetas en mobile */}
            <ul className="divide-y divide-stone-100 md:hidden">
              {orders.map((order) => (
                <li key={order.id}>
                  <Link href={`/admin/pedidos/${order.id}`} className="block px-4 py-3 active:bg-stone-50">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="truncate font-medium text-stone-900">{order.contact_name}</p>
                        <p className="text-xs text-stone-500">
                          #{order.order_number} · {formatDate(order.delivery_date)}
                          {order.delivery_time ? ` · ${formatTime(order.delivery_time)}` : ''}
                        </p>
                      </div>
                      <OrderStatusBadge status={order.status} />
                    </div>
                    <div className="mt-2 flex items-center justify-between text-sm">
                      <span className="font-semibold tabular text-stone-900">
                        {money(order.subtotal)}
                      </span>
                      {order.balance_due > 0 && (
                        <span className="text-xs text-amber-700">
                          Saldo {money(order.balance_due)}
                        </span>
                      )}
                    </div>
                  </Link>
                </li>
              ))}
            </ul>
          </>
        )}
      </div>

      {totalPages > 1 && (
        <div className="flex items-center justify-between">
          <p className="text-sm text-stone-500">{total} pedidos</p>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage(page - 1)}>
              Anterior
            </Button>
            <span className="text-sm text-stone-500">
              {page} de {totalPages}
            </span>
            <Button
              variant="outline"
              size="sm"
              disabled={page >= totalPages}
              onClick={() => setPage(page + 1)}
            >
              Siguiente
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
