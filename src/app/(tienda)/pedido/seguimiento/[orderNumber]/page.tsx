import Link from 'next/link';
import { ArrowLeft, CheckCircle2, Clock, Package, Truck } from 'lucide-react';
import { getOrderTracking, getStorefront } from '@/actions/catalog';
import { formatDate, formatDateTime, formatPrice } from '@/lib/utils';
import {
  DELIVERY_METHOD_LABELS,
  ORDER_STATUS_COLORS,
  ORDER_STATUS_LABELS,
  type OrderStatus,
} from '@/types';

export const metadata = { title: 'Seguimiento de pedido' };

/** Íconos de la línea de tiempo, por estado. */
const STATUS_ICONS: Record<OrderStatus, React.ComponentType<{ className?: string }>> = {
  pending: Clock,
  confirmed: CheckCircle2,
  in_preparation: Package,
  ready: Package,
  delivered: Truck,
  cancelled: Clock,
};

export default async function OrderTrackingPage({
  params,
}: {
  params: Promise<{ orderNumber: string }>;
}) {
  const { orderNumber } = await params;
  const [tracking, business] = await Promise.all([
    getOrderTracking(Number(orderNumber)),
    getStorefront(),
  ]);

  if (!tracking) {
    return (
      <div className="mx-auto max-w-md px-4 py-20 text-center">
        <h1 className="text-xl font-semibold text-stone-900">Pedido no encontrado</h1>
        <p className="mt-2 text-sm text-stone-500">
          No encontramos un pedido con el número #{orderNumber}.
        </p>
        <Link
          href="/pedido/seguimiento"
          className="mt-6 inline-flex items-center gap-2 text-sm font-medium text-stone-600 transition-colors hover:text-stone-900"
        >
          <ArrowLeft className="h-4 w-4" /> Probar con otro número
        </Link>
      </div>
    );
  }

  const money = (value: number) =>
    formatPrice(value, { currency: business?.currency, locale: business?.locale });

  return (
    <div className="mx-auto max-w-2xl px-4 py-10 sm:px-6">
      <Link
        href="/pedido/seguimiento"
        className="inline-flex items-center gap-1 text-sm text-stone-500 transition-colors hover:text-stone-900"
      >
        <ArrowLeft className="h-4 w-4" /> Buscar otro pedido
      </Link>

      <div className="mt-5 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-stone-900">
            Pedido #{tracking.order_number}
          </h1>
          <p className="mt-1 text-sm text-stone-500">
            A nombre de {tracking.contact_name} · {formatDate(tracking.created_at)}
          </p>
        </div>
        <span
          className={`inline-flex items-center rounded-full px-3 py-1 text-sm font-medium ring-1 ring-inset ${ORDER_STATUS_COLORS[tracking.status]}`}
        >
          {ORDER_STATUS_LABELS[tracking.status]}
        </span>
      </div>

      <section className="surface mt-6 p-5">
        <h2 className="mb-4 text-sm font-semibold text-stone-900">Tu pedido</h2>
        <ul className="divide-y divide-stone-100">
          {tracking.items.map((item, index) => (
            <li key={index} className="flex items-center justify-between gap-3 py-2.5">
              <div>
                <p className="text-sm font-medium text-stone-900">{item.name}</p>
                <p className="text-xs text-stone-500">
                  {money(item.unit_price)} × {item.quantity}
                </p>
              </div>
              <p className="text-sm font-semibold tabular text-stone-900">{money(item.subtotal)}</p>
            </li>
          ))}
        </ul>

        <div className="mt-4 flex items-center justify-between border-t border-stone-200 pt-4">
          <span className="font-semibold text-stone-900">Total</span>
          <span className="text-lg font-semibold tabular text-stone-900">
            {money(tracking.subtotal)}
          </span>
        </div>
      </section>

      <section className="surface mt-6 p-5">
        <h2 className="mb-4 text-sm font-semibold text-stone-900">Entrega</h2>
        <dl className="space-y-2 text-sm">
          <div className="flex justify-between">
            <dt className="text-stone-500">Modalidad</dt>
            <dd className="font-medium text-stone-900">
              {DELIVERY_METHOD_LABELS[tracking.delivery_method]}
            </dd>
          </div>
          <div className="flex justify-between">
            <dt className="text-stone-500">Fecha</dt>
            <dd className="font-medium text-stone-900">{formatDate(tracking.delivery_date)}</dd>
          </div>
        </dl>
      </section>

      <section className="surface mt-6 p-5">
        <h2 className="mb-4 text-sm font-semibold text-stone-900">Estado</h2>
        <ol className="space-y-4">
          {tracking.timeline.map((entry, index) => {
            const status = entry.status as OrderStatus;
            const Icon = STATUS_ICONS[status] ?? Clock;
            const isLast = index === tracking.timeline.length - 1;

            return (
              <li key={index} className="flex gap-3">
                <span
                  className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full ${
                    isLast ? 'bg-brand-600 text-white' : 'bg-stone-100 text-stone-500'
                  }`}
                >
                  <Icon className="h-4 w-4" />
                </span>
                <div>
                  <p className="text-sm font-medium text-stone-900">
                    {ORDER_STATUS_LABELS[status] ?? status}
                  </p>
                  <p className="text-xs text-stone-500">{formatDateTime(entry.date)}</p>
                  {entry.notes && <p className="mt-0.5 text-xs text-stone-500">{entry.notes}</p>}
                </div>
              </li>
            );
          })}
        </ol>
      </section>
    </div>
  );
}
