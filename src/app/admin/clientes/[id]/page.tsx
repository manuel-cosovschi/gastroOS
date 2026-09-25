import Link from 'next/link';
import { notFound } from 'next/navigation';
import {
  ArrowLeft,
  AtSign,
  ClipboardList,
  Instagram,
  MapPin,
  Pencil,
  Phone,
  Plus,
} from 'lucide-react';
import { getCustomer } from '@/actions/customers';
import { getCurrentBusiness } from '@/lib/business';
import { StatCard } from '@/components/ui/stat-card';
import { EmptyState } from '@/components/ui/empty-state';
import { Button } from '@/components/ui/button';
import { OrderStatusBadge } from '@/components/admin/orders/order-status-badge';
import { formatDate, formatPrice, initials } from '@/lib/utils';

export const metadata = { title: 'Cliente' };

export default async function CustomerDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const [result, business] = await Promise.all([getCustomer(id), getCurrentBusiness()]);

  if (!result) notFound();
  const { customer, orders } = result;

  const money = (value: number) =>
    formatPrice(value, { currency: business?.currency, locale: business?.locale });

  return (
    <div className="space-y-6">
      <Link
        href="/admin/clientes"
        className="inline-flex items-center gap-1 text-sm text-stone-500 transition-colors hover:text-stone-900"
      >
        <ArrowLeft className="h-4 w-4" /> Volver a clientes
      </Link>

      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-4">
          <span className="flex h-14 w-14 items-center justify-center rounded-full bg-stone-100 text-lg font-semibold text-stone-600">
            {initials(customer.full_name)}
          </span>
          <div>
            <h1 className="text-2xl font-semibold tracking-tight text-stone-900">
              {customer.full_name}
            </h1>
            <p className="mt-0.5 text-sm text-stone-500">
              Cliente desde {formatDate(customer.created_at, business?.locale)}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Button asChild variant="outline">
            <Link href={`/admin/clientes/${customer.id}/editar`}>
              <Pencil className="h-4 w-4" />
              Editar
            </Link>
          </Button>
          <Button asChild>
            <Link href="/admin/pedidos/nuevo">
              <Plus className="h-4 w-4" />
              Nuevo pedido
            </Link>
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard label="Pedidos" value={String(customer.orders_count)} />
        <StatCard label="Total gastado" value={money(customer.total_spent)} accent="positive" />
        <StatCard label="Ticket promedio" value={money(customer.average_ticket)} />
        <StatCard
          label="Último pedido"
          value={
            customer.last_order_date ? formatDate(customer.last_order_date, business?.locale) : '—'
          }
        />
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <section className="surface lg:col-span-2">
          <header className="border-b border-stone-200 px-5 py-4">
            <h2 className="text-sm font-semibold text-stone-900">Historial de pedidos</h2>
          </header>

          {orders.length === 0 ? (
            <EmptyState
              icon={ClipboardList}
              title="Todavía no hizo ningún pedido"
              description="Cuando cargues un pedido a su nombre va a aparecer acá."
              actionLabel="Cargar un pedido"
              actionHref="/admin/pedidos/nuevo"
            />
          ) : (
            <ul className="divide-y divide-stone-100">
              {orders.map((order) => (
                <li key={order.id}>
                  <Link
                    href={`/admin/pedidos/${order.id}`}
                    className="flex items-center justify-between gap-3 px-5 py-3 transition-colors hover:bg-stone-50"
                  >
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-stone-900">
                        Pedido #{order.order_number}
                      </p>
                      <p className="text-xs text-stone-500">
                        Entrega {formatDate(order.delivery_date, business?.locale)}
                      </p>
                    </div>
                    <span className="shrink-0 text-sm font-semibold tabular text-stone-900">
                      {money(order.subtotal)}
                    </span>
                    <OrderStatusBadge status={order.status} className="shrink-0" />
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>

        <div className="space-y-6">
          <section className="surface p-5">
            <h2 className="mb-4 text-sm font-semibold text-stone-900">Contacto</h2>
            <ul className="space-y-3 text-sm">
              <ContactRow icon={Phone} value={customer.phone} href={`tel:${customer.phone}`} />
              <ContactRow icon={AtSign} value={customer.email} href={`mailto:${customer.email}`} />
              <ContactRow
                icon={Instagram}
                value={customer.instagram ? `@${customer.instagram}` : null}
                href={`https://instagram.com/${customer.instagram}`}
              />
              <ContactRow icon={MapPin} value={customer.address} />
            </ul>
            {!customer.phone && !customer.email && !customer.instagram && !customer.address && (
              <p className="text-sm text-stone-500">Sin datos de contacto cargados.</p>
            )}
          </section>

          {customer.notes && (
            <section className="surface p-5">
              <h2 className="mb-2 text-sm font-semibold text-stone-900">Notas</h2>
              <p className="whitespace-pre-line text-sm text-stone-700">{customer.notes}</p>
            </section>
          )}
        </div>
      </div>
    </div>
  );
}

function ContactRow({
  icon: Icon,
  value,
  href,
}: {
  icon: React.ComponentType<{ className?: string }>;
  value: string | null;
  href?: string;
}) {
  if (!value) return null;

  const content = (
    <>
      <Icon className="h-4 w-4 shrink-0 text-stone-400" />
      <span className="min-w-0 truncate">{value}</span>
    </>
  );

  return (
    <li>
      {href ? (
        <a
          href={href}
          target={href.startsWith('http') ? '_blank' : undefined}
          rel="noreferrer"
          className="flex items-center gap-2.5 text-stone-700 transition-colors hover:text-brand-700"
        >
          {content}
        </a>
      ) : (
        <span className="flex items-center gap-2.5 text-stone-700">{content}</span>
      )}
    </li>
  );
}
