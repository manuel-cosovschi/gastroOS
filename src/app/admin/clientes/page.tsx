'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { Plus, Search, Users } from 'lucide-react';
import { listCustomers } from '@/actions/customers';
import { PageHeader } from '@/components/ui/page-header';
import { EmptyState } from '@/components/ui/empty-state';
import { Skeleton } from '@/components/ui/spinner';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { useMoney } from '@/components/admin/business-provider';
import { formatDate, initials } from '@/lib/utils';
import type { CustomerWithStats } from '@/types';

export default function CustomersPage() {
  const money = useMoney();
  const [customers, setCustomers] = useState<CustomerWithStats[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  useEffect(() => {
    listCustomers().then((data) => {
      setCustomers(data);
      setLoading(false);
    });
  }, []);

  // El filtro es en memoria: la lista de clientes de un negocio chico entra
  // entera y así el buscador responde sin ida y vuelta al servidor.
  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return customers;
    return customers.filter(
      (customer) =>
        customer.full_name.toLowerCase().includes(term) ||
        customer.phone?.includes(term) ||
        customer.email?.toLowerCase().includes(term) ||
        customer.instagram?.toLowerCase().includes(term)
    );
  }, [customers, search]);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Clientes"
        description="Quiénes te compran, cuánto gastaron y cuándo fue la última vez."
        actions={
          <Button asChild>
            <Link href="/admin/clientes/nuevo">
              <Plus className="h-4 w-4" />
              Nuevo cliente
            </Link>
          </Button>
        }
      />

      <div className="relative max-w-md">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-stone-400" />
        <Input
          placeholder="Buscar por nombre, teléfono, email o Instagram…"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          className="pl-9"
        />
      </div>

      <div className="surface overflow-hidden">
        {loading ? (
          <div className="space-y-3 p-5">
            {Array.from({ length: 5 }).map((_, index) => (
              <Skeleton key={index} className="h-12 w-full" />
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <EmptyState
            icon={Users}
            title={search ? 'Ningún cliente coincide' : 'Todavía no hay clientes'}
            description={
              search
                ? 'Probá con otro nombre o número de teléfono.'
                : 'Cada pedido que cargues da de alta al cliente automáticamente. También podés cargarlos vos.'
            }
            actionLabel={search ? undefined : 'Nuevo cliente'}
            actionHref="/admin/clientes/nuevo"
          />
        ) : (
          <>
            <div className="scroll-subtle hidden overflow-x-auto md:block">
              <table className="w-full text-sm">
                <thead className="border-b border-stone-200 bg-stone-50/80">
                  <tr className="text-left text-xs uppercase tracking-wide text-stone-500">
                    <th className="px-4 py-3 font-medium">Cliente</th>
                    <th className="px-4 py-3 font-medium">Contacto</th>
                    <th className="px-4 py-3 text-right font-medium">Pedidos</th>
                    <th className="px-4 py-3 text-right font-medium">Total gastado</th>
                    <th className="px-4 py-3 text-right font-medium">Ticket prom.</th>
                    <th className="px-4 py-3 font-medium">Último pedido</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-stone-100">
                  {filtered.map((customer) => (
                    <tr key={customer.id} className="transition-colors hover:bg-stone-50">
                      <td className="px-4 py-3">
                        <Link
                          href={`/admin/clientes/${customer.id}`}
                          className="flex items-center gap-3"
                        >
                          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-stone-100 text-xs font-semibold text-stone-600">
                            {initials(customer.full_name)}
                          </span>
                          <span className="font-medium text-stone-900">{customer.full_name}</span>
                        </Link>
                      </td>
                      <td className="px-4 py-3 text-stone-600">
                        {customer.phone || customer.email || '—'}
                      </td>
                      <td className="px-4 py-3 text-right tabular text-stone-900">
                        {customer.orders_count}
                      </td>
                      <td className="px-4 py-3 text-right font-medium tabular text-stone-900">
                        {money(customer.total_spent)}
                      </td>
                      <td className="px-4 py-3 text-right tabular text-stone-600">
                        {money(customer.average_ticket)}
                      </td>
                      <td className="px-4 py-3 text-stone-500">
                        {customer.last_order_date ? formatDate(customer.last_order_date) : '—'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <ul className="divide-y divide-stone-100 md:hidden">
              {filtered.map((customer) => (
                <li key={customer.id}>
                  <Link
                    href={`/admin/clientes/${customer.id}`}
                    className="flex items-center gap-3 px-4 py-3 active:bg-stone-50"
                  >
                    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-stone-100 text-xs font-semibold text-stone-600">
                      {initials(customer.full_name)}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-medium text-stone-900">{customer.full_name}</p>
                      <p className="truncate text-xs text-stone-500">
                        {customer.orders_count} {customer.orders_count === 1 ? 'pedido' : 'pedidos'}
                        {customer.phone ? ` · ${customer.phone}` : ''}
                      </p>
                    </div>
                    <span className="shrink-0 text-sm font-semibold tabular text-stone-900">
                      {money(customer.total_spent)}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          </>
        )}
      </div>
    </div>
  );
}
