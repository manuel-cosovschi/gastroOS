'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { CalendarDays, ChevronLeft, ChevronRight, Plus } from 'lucide-react';
import { getCalendarOrders } from '@/actions/stats';
import { PageHeader } from '@/components/ui/page-header';
import { EmptyState } from '@/components/ui/empty-state';
import { Skeleton } from '@/components/ui/spinner';
import { Button } from '@/components/ui/button';
import { OrderStatusBadge } from '@/components/admin/orders/order-status-badge';
import { useMoney } from '@/components/admin/business-provider';
import { cn, toISODate, todayISO } from '@/lib/utils';
import { ORDER_STATUS_DOTS, type CalendarOrder } from '@/types';

const WEEKDAYS = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'];

export default function CalendarPage() {
  const money = useMoney();
  const today = todayISO();

  const [cursor, setCursor] = useState(() => {
    const now = new Date();
    return { year: now.getFullYear(), month: now.getMonth() };
  });
  const [orders, setOrders] = useState<CalendarOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<string>(today);

  useEffect(() => {
    let active = true;
    setLoading(true);

    getCalendarOrders(cursor.year, cursor.month).then((data) => {
      if (!active) return;
      setOrders(data);
      setLoading(false);
    });

    return () => {
      active = false;
    };
  }, [cursor]);

  const ordersByDate = useMemo(() => {
    const map = new Map<string, CalendarOrder[]>();
    for (const order of orders) {
      const list = map.get(order.delivery_date) || [];
      list.push(order);
      map.set(order.delivery_date, list);
    }
    return map;
  }, [orders]);

  // La grilla arranca en lunes: getDay() devuelve 0 para domingo, así que se rota.
  const cells = useMemo(() => {
    const first = new Date(cursor.year, cursor.month, 1);
    const offset = (first.getDay() + 6) % 7;
    const daysInMonth = new Date(cursor.year, cursor.month + 1, 0).getDate();

    const result: (string | null)[] = Array.from({ length: offset }, () => null);
    for (let day = 1; day <= daysInMonth; day += 1) {
      result.push(toISODate(new Date(cursor.year, cursor.month, day)));
    }
    return result;
  }, [cursor]);

  const monthLabel = new Intl.DateTimeFormat('es-AR', { month: 'long', year: 'numeric' }).format(
    new Date(cursor.year, cursor.month, 1)
  );

  const shift = (delta: number) => {
    const next = new Date(cursor.year, cursor.month + delta, 1);
    setCursor({ year: next.getFullYear(), month: next.getMonth() });
  };

  const goToday = () => {
    const now = new Date();
    setCursor({ year: now.getFullYear(), month: now.getMonth() });
    setSelected(today);
  };

  const selectedOrders = ordersByDate.get(selected) || [];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Calendario"
        description="Qué entregás cada día. Tocá un pedido para abrirlo."
        actions={
          <Button asChild>
            <Link href="/admin/pedidos/nuevo">
              <Plus className="h-4 w-4" />
              Nuevo pedido
            </Link>
          </Button>
        }
      />

      <div className="grid gap-6 lg:grid-cols-3">
        <section className="surface p-4 lg:col-span-2">
          <header className="mb-4 flex items-center justify-between">
            <h2 className="text-sm font-semibold text-stone-900 first-letter:uppercase">{monthLabel}</h2>
            <div className="flex items-center gap-1">
              <Button variant="ghost" size="sm" onClick={goToday}>
                Hoy
              </Button>
              <button
                onClick={() => shift(-1)}
                className="rounded-md p-1.5 text-stone-500 transition-colors hover:bg-stone-100 hover:text-stone-900"
                aria-label="Mes anterior"
              >
                <ChevronLeft className="h-4 w-4" />
              </button>
              <button
                onClick={() => shift(1)}
                className="rounded-md p-1.5 text-stone-500 transition-colors hover:bg-stone-100 hover:text-stone-900"
                aria-label="Mes siguiente"
              >
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>
          </header>

          <div className="mb-1 grid grid-cols-7 gap-1">
            {WEEKDAYS.map((day) => (
              <span
                key={day}
                className="py-1 text-center text-[11px] font-medium uppercase tracking-wide text-stone-400"
              >
                {day}
              </span>
            ))}
          </div>

          {loading ? (
            <Skeleton className="h-80 w-full" />
          ) : (
            <div className="grid grid-cols-7 gap-1">
              {cells.map((date, index) => {
                if (!date) return <span key={`empty-${index}`} />;

                const dayOrders = ordersByDate.get(date) || [];
                const isToday = date === today;
                const isSelected = date === selected;

                return (
                  <button
                    key={date}
                    onClick={() => setSelected(date)}
                    className={cn(
                      'flex min-h-[64px] flex-col items-start gap-1 rounded-lg border p-1.5 text-left transition-colors sm:min-h-[80px]',
                      isSelected
                        ? 'border-brand-600 bg-brand-50'
                        : 'border-transparent hover:border-stone-200 hover:bg-stone-50'
                    )}
                  >
                    <span
                      className={cn(
                        'flex h-6 w-6 items-center justify-center rounded-full text-xs font-medium tabular',
                        isToday ? 'bg-stone-900 text-white' : 'text-stone-600'
                      )}
                    >
                      {Number(date.slice(8, 10))}
                    </span>

                    {dayOrders.length > 0 && (
                      <span className="flex flex-wrap gap-0.5">
                        {dayOrders.slice(0, 4).map((order) => (
                          <span
                            key={order.id}
                            className={cn('h-1.5 w-1.5 rounded-full', ORDER_STATUS_DOTS[order.status])}
                          />
                        ))}
                        {dayOrders.length > 4 && (
                          <span className="text-[10px] leading-none text-stone-400">
                            +{dayOrders.length - 4}
                          </span>
                        )}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          )}
        </section>

        <section className="surface">
          <header className="border-b border-stone-200 px-5 py-4">
            <h2 className="text-sm font-semibold text-stone-900">
              {selected === today ? 'Entregas de hoy' : `Entregas del ${formatDay(selected)}`}
            </h2>
            <p className="mt-0.5 text-xs text-stone-500">
              {selectedOrders.length === 0
                ? 'Sin entregas'
                : `${selectedOrders.length} ${selectedOrders.length === 1 ? 'pedido' : 'pedidos'}`}
            </p>
          </header>

          {selectedOrders.length === 0 ? (
            <EmptyState
              icon={CalendarDays}
              title="No hay entregas este día"
              description="Elegí otro día del calendario o cargá un pedido nuevo."
            />
          ) : (
            <ul className="divide-y divide-stone-100">
              {selectedOrders.map((order) => (
                <li key={order.id}>
                  <Link
                    href={`/admin/pedidos/${order.id}`}
                    className="block px-5 py-3 transition-colors hover:bg-stone-50"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium text-stone-900">
                          {order.customer_name}
                        </p>
                        <p className="text-xs text-stone-500">
                          #{order.order_number}
                          {order.delivery_time ? ` · ${order.delivery_time}` : ''}
                        </p>
                      </div>
                      <span className="shrink-0 text-sm font-semibold tabular text-stone-900">
                        {money(order.total)}
                      </span>
                    </div>
                    <OrderStatusBadge status={order.status} className="mt-2" />
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </div>
  );
}

function formatDay(date: string): string {
  const [year, month, day] = date.split('-').map(Number);
  return new Intl.DateTimeFormat('es-AR', { day: 'numeric', month: 'long' }).format(
    new Date(year, month - 1, day, 12)
  );
}
