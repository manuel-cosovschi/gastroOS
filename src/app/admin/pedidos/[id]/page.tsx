import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ArrowLeft, Pencil, UserRound } from 'lucide-react';
import { getOrder } from '@/actions/orders';
import { getCurrentBusiness } from '@/lib/business';
import { OrderStatusBadge } from '@/components/admin/orders/order-status-badge';
import { OrderStatusActions } from '@/components/admin/orders/order-status-actions';
import { Button } from '@/components/ui/button';
import {
  cn,
  formatDate,
  formatDateTime,
  formatPrice,
  formatTime,
  initials,
} from '@/lib/utils';
import {
  DELIVERY_METHOD_LABELS,
  ORDER_CHANNEL_LABELS,
  ORDER_STATUS_LABELS,
  PAYMENT_METHOD_LABELS,
} from '@/types';

export const metadata = { title: 'Detalle de pedido' };

export default async function OrderDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [order, business] = await Promise.all([getOrder(id), getCurrentBusiness()]);

  if (!order) notFound();

  const money = (value: number | null) =>
    formatPrice(value, { currency: business?.currency, locale: business?.locale });

  const margin =
    order.production_cost != null ? order.subtotal - Number(order.production_cost) : null;

  return (
    <div className="space-y-6">
      <Link
        href="/admin/pedidos"
        className="inline-flex items-center gap-1 text-sm text-stone-500 transition-colors hover:text-stone-900"
      >
        <ArrowLeft className="h-4 w-4" /> Volver a pedidos
      </Link>

      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-semibold tracking-tight text-stone-900">
              Pedido #{order.order_number}
            </h1>
            <OrderStatusBadge status={order.status} />
          </div>
          <p className="mt-1 text-sm text-stone-500">
            Creado el {formatDateTime(order.created_at, business?.locale)} ·{' '}
            {ORDER_CHANNEL_LABELS[order.channel]}
          </p>
        </div>

        <Button asChild variant="outline">
          <Link href={`/admin/pedidos/${order.id}/editar`}>
            <Pencil className="h-4 w-4" />
            Editar
          </Link>
        </Button>
      </div>

      <section className="surface p-5">
        <h2 className="mb-3 text-sm font-semibold text-stone-900">Estado del pedido</h2>
        <OrderStatusActions orderId={order.id} currentStatus={order.status} />
      </section>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          {/* Productos */}
          <section className="surface">
            <header className="border-b border-stone-200 px-5 py-4">
              <h2 className="text-sm font-semibold text-stone-900">Detalle</h2>
            </header>

            <ul className="divide-y divide-stone-100">
              {order.items.map((item) => (
                <li key={item.id} className="flex items-start justify-between gap-4 px-5 py-3">
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-stone-900">{item.item_name}</p>
                    <p className="text-xs text-stone-500">
                      {money(item.unit_price)} × {item.quantity}
                      {item.cost_subtotal != null && (
                        <span className="ml-2 text-stone-400">
                          costo {money(item.cost_subtotal)}
                        </span>
                      )}
                    </p>
                    {item.notes && <p className="mt-0.5 text-xs text-stone-500">{item.notes}</p>}
                  </div>
                  <p className="shrink-0 text-sm font-semibold tabular text-stone-900">
                    {money(item.subtotal)}
                  </p>
                </li>
              ))}
            </ul>

            <dl className="space-y-1.5 border-t border-stone-200 px-5 py-4 text-sm">
              <Row label="Total" value={money(order.subtotal)} strong />
              {order.deposit_amount > 0 && (
                <>
                  <Row label="Seña cobrada" value={money(order.deposit_amount)} />
                  <Row
                    label="Saldo pendiente"
                    value={money(order.balance_due)}
                    accent={order.balance_due > 0 ? 'warning' : undefined}
                    strong
                  />
                </>
              )}
              {order.production_cost != null && (
                <>
                  <Row label="Costo de producción" value={money(order.production_cost)} />
                  <Row
                    label="Margen estimado"
                    value={money(margin)}
                    accent={(margin ?? 0) >= 0 ? 'positive' : 'negative'}
                    strong
                  />
                </>
              )}
            </dl>
          </section>

          {/* Historial */}
          <section className="surface p-5">
            <h2 className="mb-4 text-sm font-semibold text-stone-900">Historial</h2>
            <ol className="space-y-3">
              {order.status_history.map((entry) => (
                <li key={entry.id} className="flex gap-3">
                  <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-stone-300" />
                  <div>
                    <p className="text-sm text-stone-900">
                      {entry.from_status
                        ? `${ORDER_STATUS_LABELS[entry.from_status]} → ${ORDER_STATUS_LABELS[entry.to_status]}`
                        : ORDER_STATUS_LABELS[entry.to_status]}
                    </p>
                    <p className="text-xs text-stone-500">
                      {formatDateTime(entry.created_at, business?.locale)}
                    </p>
                    {entry.notes && <p className="mt-0.5 text-xs text-stone-500">{entry.notes}</p>}
                  </div>
                </li>
              ))}
            </ol>
          </section>
        </div>

        <div className="space-y-6">
          {/* Cliente */}
          <section className="surface p-5">
            <h2 className="mb-4 text-sm font-semibold text-stone-900">Cliente</h2>
            <div className="flex items-center gap-3">
              <span className="flex h-10 w-10 items-center justify-center rounded-full bg-stone-100 text-sm font-semibold text-stone-600">
                {initials(order.contact_name) || <UserRound className="h-4 w-4" />}
              </span>
              <div className="min-w-0">
                {order.customer ? (
                  <Link
                    href={`/admin/clientes/${order.customer.id}`}
                    className="truncate text-sm font-medium text-stone-900 hover:text-brand-700"
                  >
                    {order.contact_name}
                  </Link>
                ) : (
                  <p className="truncate text-sm font-medium text-stone-900">{order.contact_name}</p>
                )}
                {order.phone && <p className="text-xs text-stone-500">{order.phone}</p>}
              </div>
            </div>

            <dl className="mt-4 space-y-1.5 text-sm">
              {order.email && <Row label="Email" value={order.email} />}
              {order.customer?.instagram && (
                <Row label="Instagram" value={`@${order.customer.instagram}`} />
              )}
            </dl>
          </section>

          {/* Entrega */}
          <section className="surface p-5">
            <h2 className="mb-4 text-sm font-semibold text-stone-900">Entrega</h2>
            <dl className="space-y-1.5 text-sm">
              <Row label="Método" value={DELIVERY_METHOD_LABELS[order.delivery_method]} />
              <Row label="Fecha" value={formatDate(order.delivery_date, business?.locale)} />
              {order.delivery_time && <Row label="Hora" value={formatTime(order.delivery_time)} />}
              {order.address && <Row label="Dirección" value={order.address} />}
              {order.payment_method && (
                <Row label="Pago" value={PAYMENT_METHOD_LABELS[order.payment_method]} />
              )}
            </dl>
          </section>

          {(order.observations || order.admin_notes) && (
            <section className="surface p-5">
              <h2 className="mb-3 text-sm font-semibold text-stone-900">Notas</h2>
              {order.observations && (
                <div className="mb-3">
                  <p className="text-xs uppercase tracking-wide text-stone-400">Del cliente</p>
                  <p className="mt-1 text-sm text-stone-700">{order.observations}</p>
                </div>
              )}
              {order.admin_notes && (
                <div>
                  <p className="text-xs uppercase tracking-wide text-stone-400">Interna</p>
                  <p className="mt-1 text-sm text-stone-700">{order.admin_notes}</p>
                </div>
              )}
            </section>
          )}
        </div>
      </div>
    </div>
  );
}

function Row({
  label,
  value,
  strong,
  accent,
}: {
  label: string;
  value: string;
  strong?: boolean;
  accent?: 'positive' | 'negative' | 'warning';
}) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <dt className="shrink-0 text-stone-500">{label}</dt>
      <dd
        className={cn(
          'min-w-0 truncate text-right tabular',
          strong ? 'font-semibold' : 'font-medium',
          accent === 'positive' && 'text-brand-700',
          accent === 'negative' && 'text-rose-600',
          accent === 'warning' && 'text-amber-700',
          !accent && 'text-stone-900'
        )}
      >
        {value}
      </dd>
    </div>
  );
}
