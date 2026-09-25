'use client';

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { Check, Loader2, Minus, Plus, Search, Trash2, UserRound } from 'lucide-react';
import { createOrder, updateOrder } from '@/actions/orders';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { useMoney } from '@/components/admin/business-provider';
import { cn, round2, todayISO } from '@/lib/utils';
import {
  DELIVERY_METHODS,
  DELIVERY_METHOD_LABELS,
  ORDER_STATUSES,
  ORDER_STATUS_LABELS,
  PAYMENT_METHODS,
  PAYMENT_METHOD_LABELS,
} from '@/types';
import type {
  CreateOrderInput,
  Customer,
  DeliveryMethod,
  OrderDetail,
  OrderStatus,
  Package,
  PaymentMethod,
  Product,
} from '@/types';

interface CatalogEntry {
  key: string;
  id: string;
  kind: 'product' | 'package';
  name: string;
  price: number;
  category?: string | null;
}

interface Line extends CatalogEntry {
  quantity: number;
  notes: string;
}

interface OrderFormProps {
  customers: Customer[];
  products: Product[];
  packages: Package[];
  /** Si viene, el formulario edita en vez de crear. */
  order?: OrderDetail;
}

/**
 * Alta y edición de pedidos.
 *
 * La prioridad es la velocidad de carga: cliente por buscador (o nombre libre),
 * productos con un clic, y el total siempre a la vista. Todo el catálogo llega
 * precargado desde el servidor, así que agregar un ítem no espera ninguna red.
 */
export function OrderForm({ customers, products, packages, order }: OrderFormProps) {
  const router = useRouter();
  const money = useMoney();
  const isEditing = !!order;

  const catalog = useMemo<CatalogEntry[]>(
    () => [
      ...products.map((product) => ({
        key: `product:${product.id}`,
        id: product.id,
        kind: 'product' as const,
        name: product.name,
        price: Number(product.price),
        category: product.category?.name ?? null,
      })),
      ...packages.map((pkg) => ({
        key: `package:${pkg.id}`,
        id: pkg.id,
        kind: 'package' as const,
        name: pkg.name,
        price: Number(pkg.price),
        category: 'Combos',
      })),
    ],
    [products, packages]
  );

  const [lines, setLines] = useState<Line[]>(() => {
    if (!order) return [];
    return order.items
      .map((item) => {
        const entry = catalog.find(
          (candidate) =>
            candidate.id === (item.product_id || item.package_id) &&
            candidate.kind === (item.product_id ? 'product' : 'package')
        );
        if (!entry) return null;
        return { ...entry, quantity: item.quantity, notes: item.notes || '' };
      })
      .filter((line): line is Line => line !== null);
  });

  const [customerId, setCustomerId] = useState(order?.customer_id || '');
  const [contactName, setContactName] = useState(order?.contact_name || '');
  const [phone, setPhone] = useState(order?.phone || '');
  const [email, setEmail] = useState(order?.email || '');
  const [customerQuery, setCustomerQuery] = useState('');

  const [deliveryMethod, setDeliveryMethod] = useState<DeliveryMethod>(
    order?.delivery_method || 'pickup'
  );
  const [address, setAddress] = useState(order?.address || '');
  const [deliveryDate, setDeliveryDate] = useState(order?.delivery_date || todayISO());
  const [deliveryTime, setDeliveryTime] = useState(order?.delivery_time?.slice(0, 5) || '');

  const [depositAmount, setDepositAmount] = useState(String(order?.deposit_amount ?? 0));
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod | ''>(
    order?.payment_method || ''
  );
  const [status, setStatus] = useState<OrderStatus>(order?.status || 'pending');
  const [observations, setObservations] = useState(order?.observations || '');
  const [adminNotes, setAdminNotes] = useState(order?.admin_notes || '');

  const [productQuery, setProductQuery] = useState('');
  const [saving, setSaving] = useState(false);

  const subtotal = round2(lines.reduce((sum, line) => sum + line.price * line.quantity, 0));
  const deposit = Number(depositAmount) || 0;
  const balance = round2(subtotal - deposit);

  const filteredCustomers = useMemo(() => {
    if (!customerQuery.trim()) return [];
    const term = customerQuery.toLowerCase();
    return customers
      .filter(
        (customer) =>
          customer.full_name.toLowerCase().includes(term) ||
          customer.phone?.includes(term) ||
          customer.email?.toLowerCase().includes(term)
      )
      .slice(0, 6);
  }, [customers, customerQuery]);

  const filteredCatalog = useMemo(() => {
    const term = productQuery.trim().toLowerCase();
    if (!term) return catalog.slice(0, 18);
    return catalog.filter((entry) => entry.name.toLowerCase().includes(term)).slice(0, 18);
  }, [catalog, productQuery]);

  const selectCustomer = (customer: Customer) => {
    setCustomerId(customer.id);
    setContactName(customer.full_name);
    setPhone(customer.phone || '');
    setEmail(customer.email || '');
    if (customer.address) setAddress(customer.address);
    setCustomerQuery('');
  };

  const addLine = (entry: CatalogEntry) => {
    setLines((current) => {
      const existing = current.find((line) => line.key === entry.key);
      if (existing) {
        return current.map((line) =>
          line.key === entry.key ? { ...line, quantity: line.quantity + 1 } : line
        );
      }
      return [...current, { ...entry, quantity: 1, notes: '' }];
    });
  };

  const setQuantity = (key: string, quantity: number) => {
    setLines((current) =>
      quantity <= 0
        ? current.filter((line) => line.key !== key)
        : current.map((line) => (line.key === key ? { ...line, quantity } : line))
    );
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();

    if (!contactName.trim()) return toast.error('Indicá el nombre del cliente.');
    if (lines.length === 0) return toast.error('Agregá al menos un producto.');
    if (deliveryMethod === 'delivery' && !address.trim()) {
      return toast.error('La dirección es obligatoria para envíos a domicilio.');
    }

    const payload: CreateOrderInput = {
      customer_id: customerId || undefined,
      contact_name: contactName,
      phone: phone || undefined,
      email: email || undefined,
      delivery_method: deliveryMethod,
      address: address || undefined,
      delivery_date: deliveryDate,
      delivery_time: deliveryTime || undefined,
      deposit_amount: deposit,
      payment_method: paymentMethod || undefined,
      observations: observations || undefined,
      admin_notes: adminNotes || undefined,
      status,
      items: lines.map((line) => ({
        product_id: line.kind === 'product' ? line.id : undefined,
        package_id: line.kind === 'package' ? line.id : undefined,
        quantity: line.quantity,
        notes: line.notes || undefined,
      })),
    };

    setSaving(true);

    let savedId = order?.id;
    let error: string | undefined;

    if (isEditing) {
      const result = await updateOrder(order.id, payload);
      error = result.success ? undefined : result.error || 'No se pudo guardar el pedido.';
    } else {
      const result = await createOrder(payload);
      error = result.success ? undefined : result.error || 'No se pudo guardar el pedido.';
      savedId = result.order?.id;
    }

    setSaving(false);

    if (error) {
      toast.error(error);
      return;
    }

    toast.success(isEditing ? 'Pedido actualizado' : 'Pedido creado');
    router.push(savedId ? `/admin/pedidos/${savedId}` : '/admin/pedidos');
    router.refresh();
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6 pb-24">
      <div className="grid gap-6 lg:grid-cols-5">
        {/* ---------- Cliente y entrega ---------- */}
        <div className="space-y-6 lg:col-span-2">
          <section className="surface p-5">
            <h2 className="mb-4 text-sm font-semibold text-stone-900">Cliente</h2>

            <div className="space-y-4">
              <div className="relative">
                <Label htmlFor="customer-search">Buscar cliente existente</Label>
                <div className="relative mt-1.5">
                  <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-stone-400" />
                  <Input
                    id="customer-search"
                    value={customerQuery}
                    onChange={(event) => setCustomerQuery(event.target.value)}
                    placeholder="Nombre, teléfono o email"
                    className="pl-9"
                    autoComplete="off"
                  />
                </div>

                {filteredCustomers.length > 0 && (
                  <ul className="absolute z-20 mt-1 w-full overflow-hidden rounded-lg border border-stone-200 bg-white shadow-lift">
                    {filteredCustomers.map((customer) => (
                      <li key={customer.id}>
                        <button
                          type="button"
                          onClick={() => selectCustomer(customer)}
                          className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm transition-colors hover:bg-stone-50"
                        >
                          <UserRound className="h-4 w-4 shrink-0 text-stone-400" />
                          <span className="min-w-0 flex-1 truncate">{customer.full_name}</span>
                          {customer.phone && (
                            <span className="shrink-0 text-xs text-stone-400">{customer.phone}</span>
                          )}
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </div>

              <div>
                <Label htmlFor="contact-name">Nombre *</Label>
                <Input
                  id="contact-name"
                  value={contactName}
                  onChange={(event) => {
                    setContactName(event.target.value);
                    setCustomerId('');
                  }}
                  placeholder="Nombre y apellido"
                  className="mt-1.5"
                  required
                />
                {customerId && (
                  <p className="mt-1 inline-flex items-center gap-1 text-xs text-brand-700">
                    <Check className="h-3 w-3" /> Asociado a un cliente existente
                  </p>
                )}
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <Label htmlFor="phone">Teléfono</Label>
                  <Input
                    id="phone"
                    value={phone}
                    onChange={(event) => setPhone(event.target.value)}
                    className="mt-1.5"
                    inputMode="tel"
                  />
                </div>
                <div>
                  <Label htmlFor="email">Email</Label>
                  <Input
                    id="email"
                    type="email"
                    value={email}
                    onChange={(event) => setEmail(event.target.value)}
                    className="mt-1.5"
                  />
                </div>
              </div>
            </div>
          </section>

          <section className="surface p-5">
            <h2 className="mb-4 text-sm font-semibold text-stone-900">Entrega</h2>

            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-2">
                {DELIVERY_METHODS.map((method) => (
                  <button
                    key={method}
                    type="button"
                    onClick={() => setDeliveryMethod(method)}
                    className={cn(
                      'rounded-lg border px-3 py-2 text-sm font-medium transition-colors',
                      deliveryMethod === method
                        ? 'border-brand-600 bg-brand-50 text-brand-800'
                        : 'border-stone-200 text-stone-600 hover:border-stone-300'
                    )}
                  >
                    {DELIVERY_METHOD_LABELS[method]}
                  </button>
                ))}
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <Label htmlFor="delivery-date">Fecha *</Label>
                  <Input
                    id="delivery-date"
                    type="date"
                    value={deliveryDate}
                    onChange={(event) => setDeliveryDate(event.target.value)}
                    className="mt-1.5"
                    required
                  />
                </div>
                <div>
                  <Label htmlFor="delivery-time">Hora</Label>
                  <Input
                    id="delivery-time"
                    type="time"
                    value={deliveryTime}
                    onChange={(event) => setDeliveryTime(event.target.value)}
                    className="mt-1.5"
                  />
                </div>
              </div>

              {deliveryMethod === 'delivery' && (
                <div className="animate-fade-in">
                  <Label htmlFor="address">Dirección *</Label>
                  <Input
                    id="address"
                    value={address}
                    onChange={(event) => setAddress(event.target.value)}
                    placeholder="Calle, número, piso"
                    className="mt-1.5"
                  />
                </div>
              )}

              <div>
                <Label htmlFor="observations">Notas del pedido</Label>
                <Textarea
                  id="observations"
                  value={observations}
                  onChange={(event) => setObservations(event.target.value)}
                  placeholder="Sin nueces, mensaje en la torta, entregar en portería…"
                  rows={2}
                  className="mt-1.5"
                />
              </div>
            </div>
          </section>
        </div>

        {/* ---------- Productos y totales ---------- */}
        <div className="space-y-6 lg:col-span-3">
          <section className="surface p-5">
            <h2 className="mb-4 text-sm font-semibold text-stone-900">Productos</h2>

            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-stone-400" />
              <Input
                value={productQuery}
                onChange={(event) => setProductQuery(event.target.value)}
                placeholder="Buscar producto o combo…"
                className="pl-9"
                autoComplete="off"
              />
            </div>

            <div className="mt-3 flex flex-wrap gap-2">
              {filteredCatalog.map((entry) => (
                <button
                  key={entry.key}
                  type="button"
                  onClick={() => addLine(entry)}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-stone-200 bg-white px-3 py-1.5 text-sm text-stone-700 transition-colors hover:border-brand-500 hover:bg-brand-50 hover:text-brand-800"
                >
                  <Plus className="h-3.5 w-3.5" />
                  {entry.name}
                  <span className="text-xs text-stone-400">{money(entry.price)}</span>
                </button>
              ))}
              {filteredCatalog.length === 0 && (
                <p className="py-2 text-sm text-stone-500">
                  No hay productos que coincidan con la búsqueda.
                </p>
              )}
            </div>

            <div className="mt-5 border-t border-stone-100 pt-4">
              {lines.length === 0 ? (
                <p className="py-6 text-center text-sm text-stone-500">
                  Elegí productos de la lista para armar el pedido.
                </p>
              ) : (
                <ul className="divide-y divide-stone-100">
                  {lines.map((line) => (
                    <li key={line.key} className="flex items-center gap-3 py-3">
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium text-stone-900">{line.name}</p>
                        <p className="text-xs text-stone-500">{money(line.price)} c/u</p>
                      </div>

                      <div className="flex items-center gap-1 rounded-lg border border-stone-200">
                        <button
                          type="button"
                          onClick={() => setQuantity(line.key, line.quantity - 1)}
                          className="p-1.5 text-stone-500 transition-colors hover:text-stone-900"
                          aria-label={`Quitar una unidad de ${line.name}`}
                        >
                          <Minus className="h-3.5 w-3.5" />
                        </button>
                        <span className="w-8 text-center text-sm font-medium tabular">
                          {line.quantity}
                        </span>
                        <button
                          type="button"
                          onClick={() => setQuantity(line.key, line.quantity + 1)}
                          className="p-1.5 text-stone-500 transition-colors hover:text-stone-900"
                          aria-label={`Agregar una unidad de ${line.name}`}
                        >
                          <Plus className="h-3.5 w-3.5" />
                        </button>
                      </div>

                      <span className="w-24 shrink-0 text-right text-sm font-semibold tabular text-stone-900">
                        {money(line.price * line.quantity)}
                      </span>

                      <button
                        type="button"
                        onClick={() => setQuantity(line.key, 0)}
                        className="p-1.5 text-stone-400 transition-colors hover:text-rose-600"
                        aria-label={`Eliminar ${line.name}`}
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </section>

          <section className="surface p-5">
            <h2 className="mb-4 text-sm font-semibold text-stone-900">Pago y estado</h2>

            <div className="grid gap-4 sm:grid-cols-3">
              <div>
                <Label htmlFor="deposit">Seña</Label>
                <Input
                  id="deposit"
                  type="number"
                  min={0}
                  step="0.01"
                  value={depositAmount}
                  onChange={(event) => setDepositAmount(event.target.value)}
                  className="mt-1.5"
                />
              </div>

              <div>
                <Label htmlFor="payment-method">Método de pago</Label>
                <select
                  id="payment-method"
                  value={paymentMethod}
                  onChange={(event) => setPaymentMethod(event.target.value as PaymentMethod | '')}
                  className="mt-1.5 h-10 w-full rounded-md border border-stone-300 bg-white px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500"
                >
                  <option value="">Sin definir</option>
                  {PAYMENT_METHODS.map((method) => (
                    <option key={method} value={method}>
                      {PAYMENT_METHOD_LABELS[method]}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <Label htmlFor="status">Estado</Label>
                <select
                  id="status"
                  value={status}
                  onChange={(event) => setStatus(event.target.value as OrderStatus)}
                  disabled={isEditing}
                  className="mt-1.5 h-10 w-full rounded-md border border-stone-300 bg-white px-3 text-sm disabled:bg-stone-50 disabled:text-stone-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500"
                >
                  {ORDER_STATUSES.filter((value) => value !== 'cancelled').map((value) => (
                    <option key={value} value={value}>
                      {ORDER_STATUS_LABELS[value]}
                    </option>
                  ))}
                </select>
                {isEditing && (
                  <p className="mt-1 text-xs text-stone-500">
                    El estado se cambia desde el detalle del pedido.
                  </p>
                )}
              </div>
            </div>

            <div className="mt-4">
              <Label htmlFor="admin-notes">Nota interna</Label>
              <Textarea
                id="admin-notes"
                value={adminNotes}
                onChange={(event) => setAdminNotes(event.target.value)}
                placeholder="No la ve el cliente."
                rows={2}
                className="mt-1.5"
              />
            </div>
          </section>
        </div>
      </div>

      {/* Barra fija con el total: siempre visible mientras se arma el pedido */}
      <div className="fixed inset-x-0 bottom-0 z-30 border-t border-stone-200 bg-white/95 backdrop-blur lg:pl-64">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-3 px-4 py-3 sm:px-6 lg:px-8">
          <div className="flex items-center gap-5 text-sm">
            <div>
              <p className="text-xs text-stone-500">Total</p>
              <p className="text-lg font-semibold tabular text-stone-900">{money(subtotal)}</p>
            </div>
            {deposit > 0 && (
              <div>
                <p className="text-xs text-stone-500">Saldo</p>
                <p className="text-lg font-semibold tabular text-amber-700">{money(balance)}</p>
              </div>
            )}
            <p className="hidden text-xs text-stone-500 sm:block">
              {lines.length} {lines.length === 1 ? 'ítem' : 'ítems'}
            </p>
          </div>

          <div className="flex items-center gap-2">
            <Button type="button" variant="outline" onClick={() => router.back()}>
              Cancelar
            </Button>
            <Button type="submit" disabled={saving}>
              {saving && <Loader2 className="h-4 w-4 animate-spin" />}
              {isEditing ? 'Guardar cambios' : 'Crear pedido'}
            </Button>
          </div>
        </div>
      </div>
    </form>
  );
}
