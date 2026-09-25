'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { toast } from 'sonner';
import { Loader2, Plus, Receipt, Search, Trash2 } from 'lucide-react';
import {
  createExpense,
  createExpenseCategory,
  deleteExpense,
  listExpenses,
} from '@/actions/expenses';
import { PageHeader } from '@/components/ui/page-header';
import { EmptyState } from '@/components/ui/empty-state';
import { StatCard } from '@/components/ui/stat-card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { formatDate, formatPrice, round2, todayISO } from '@/lib/utils';
import { PAYMENT_METHODS, PAYMENT_METHOD_LABELS } from '@/types';
import type { Expense, ExpenseCategory, PaymentMethod } from '@/types';

interface ExpensesClientProps {
  initialExpenses: Expense[];
  categories: ExpenseCategory[];
  initialRange: { from: string; to: string };
  currency?: string;
  locale?: string;
}

export function ExpensesClient({
  initialExpenses,
  categories,
  initialRange,
  currency,
  locale,
}: ExpensesClientProps) {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [expenses, setExpenses] = useState(initialExpenses);
  const [range, setRange] = useState(initialRange);
  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [loading, setLoading] = useState(false);
  // La acción rápida del topbar entra con ?nuevo=1 y abre el formulario directo.
  const [dialogOpen, setDialogOpen] = useState(searchParams.get('nuevo') === '1');

  const money = (value: number) => formatPrice(value, { currency, locale });

  const reload = async (nextRange = range) => {
    setLoading(true);
    const data = await listExpenses({ from_date: nextRange.from, to_date: nextRange.to });
    setExpenses(data);
    setLoading(false);
  };

  useEffect(() => {
    if (range.from !== initialRange.from || range.to !== initialRange.to) reload(range);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [range.from, range.to]);

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    return expenses.filter((expense) => {
      if (categoryFilter !== 'all' && expense.category_id !== categoryFilter) return false;
      if (!term) return true;
      return (
        expense.description.toLowerCase().includes(term) ||
        expense.supplier?.toLowerCase().includes(term)
      );
    });
  }, [expenses, search, categoryFilter]);

  const total = round2(filtered.reduce((sum, expense) => sum + Number(expense.amount), 0));
  const biggest = filtered.reduce<Expense | null>(
    (max, expense) => (!max || Number(expense.amount) > Number(max.amount) ? expense : max),
    null
  );

  const handleDelete = async (expense: Expense) => {
    if (!confirm(`¿Eliminar el gasto "${expense.description}"?`)) return;

    const result = await deleteExpense(expense.id);
    if (!result.success) {
      toast.error(result.error || 'No se pudo eliminar.');
      return;
    }
    toast.success('Gasto eliminado');
    setExpenses((current) => current.filter((item) => item.id !== expense.id));
    router.refresh();
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Gastos"
        description="Todo lo que sale del negocio, para saber cuánto estás ganando de verdad."
        actions={
          <Button onClick={() => setDialogOpen(true)}>
            <Plus className="h-4 w-4" />
            Registrar gasto
          </Button>
        }
      />

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard label="Total del período" value={money(total)} icon={Receipt} />
        <StatCard label="Gastos registrados" value={String(filtered.length)} />
        <StatCard
          label="Promedio"
          value={money(filtered.length ? total / filtered.length : 0)}
        />
        <StatCard
          label="Mayor gasto"
          value={biggest ? money(Number(biggest.amount)) : money(0)}
          hint={biggest?.description}
        />
      </div>

      {/* Filtros */}
      <div className="flex flex-col gap-3 lg:flex-row lg:items-end">
        <div className="flex gap-2">
          <div>
            <Label htmlFor="from" className="text-xs text-stone-500">
              Desde
            </Label>
            <Input
              id="from"
              type="date"
              value={range.from}
              onChange={(event) => setRange({ ...range, from: event.target.value })}
              className="mt-1"
            />
          </div>
          <div>
            <Label htmlFor="to" className="text-xs text-stone-500">
              Hasta
            </Label>
            <Input
              id="to"
              type="date"
              value={range.to}
              onChange={(event) => setRange({ ...range, to: event.target.value })}
              className="mt-1"
            />
          </div>
        </div>

        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-stone-400" />
          <Input
            placeholder="Buscar por descripción o proveedor…"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            className="pl-9"
          />
        </div>

        <select
          value={categoryFilter}
          onChange={(event) => setCategoryFilter(event.target.value)}
          className="h-10 rounded-md border border-stone-300 bg-white px-3 text-sm lg:w-52"
        >
          <option value="all">Todas las categorías</option>
          {categories.map((category) => (
            <option key={category.id} value={category.id}>
              {category.name}
            </option>
          ))}
        </select>
      </div>

      <div className="surface overflow-hidden">
        {loading ? (
          <div className="flex justify-center py-16">
            <Loader2 className="h-5 w-5 animate-spin text-stone-400" />
          </div>
        ) : filtered.length === 0 ? (
          <EmptyState
            icon={Receipt}
            title="No hay gastos en este período"
            description="Registrá lo que comprás (insumos, packaging, servicios) para ver la rentabilidad real."
            actionLabel="Registrar gasto"
            onAction={() => setDialogOpen(true)}
          />
        ) : (
          <div className="scroll-subtle overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="border-b border-stone-200 bg-stone-50/80">
                <tr className="text-left text-xs uppercase tracking-wide text-stone-500">
                  <th className="px-4 py-3 font-medium">Fecha</th>
                  <th className="px-4 py-3 font-medium">Descripción</th>
                  <th className="hidden px-4 py-3 font-medium sm:table-cell">Categoría</th>
                  <th className="hidden px-4 py-3 font-medium md:table-cell">Proveedor</th>
                  <th className="px-4 py-3 text-right font-medium">Monto</th>
                  <th className="w-10 px-4 py-3" />
                </tr>
              </thead>
              <tbody className="divide-y divide-stone-100">
                {filtered.map((expense) => (
                  <tr key={expense.id} className="transition-colors hover:bg-stone-50">
                    <td className="whitespace-nowrap px-4 py-3 text-stone-500">
                      {formatDate(expense.expense_date, locale)}
                    </td>
                    <td className="px-4 py-3">
                      <p className="font-medium text-stone-900">{expense.description}</p>
                      {expense.payment_method && (
                        <p className="text-xs text-stone-500">
                          {PAYMENT_METHOD_LABELS[expense.payment_method]}
                        </p>
                      )}
                    </td>
                    <td className="hidden px-4 py-3 sm:table-cell">
                      {expense.category ? (
                        <span
                          className="inline-flex items-center gap-1.5 text-stone-700"
                          title={expense.category.name}
                        >
                          <span
                            className="h-2 w-2 rounded-full"
                            style={{ backgroundColor: expense.category.color }}
                          />
                          {expense.category.name}
                        </span>
                      ) : (
                        <span className="text-stone-400">Sin categoría</span>
                      )}
                    </td>
                    <td className="hidden px-4 py-3 text-stone-500 md:table-cell">
                      {expense.supplier || '—'}
                    </td>
                    <td className="px-4 py-3 text-right font-semibold tabular text-stone-900">
                      {money(Number(expense.amount))}
                    </td>
                    <td className="px-4 py-3">
                      <button
                        onClick={() => handleDelete(expense)}
                        className="rounded-md p-1.5 text-stone-400 transition-colors hover:bg-rose-50 hover:text-rose-600"
                        aria-label={`Eliminar ${expense.description}`}
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <ExpenseDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        categories={categories}
        onSaved={() => reload()}
      />
    </div>
  );
}

function ExpenseDialog({
  open,
  onOpenChange,
  categories,
  onSaved,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  categories: ExpenseCategory[];
  onSaved: () => void;
}) {
  const router = useRouter();
  const [saving, setSaving] = useState(false);
  const [newCategory, setNewCategory] = useState('');
  const [form, setForm] = useState({
    description: '',
    amount: '',
    expense_date: todayISO(),
    category_id: '',
    supplier: '',
    payment_method: '' as PaymentMethod | '',
    notes: '',
  });

  const reset = () =>
    setForm({
      description: '',
      amount: '',
      expense_date: todayISO(),
      category_id: '',
      supplier: '',
      payment_method: '',
      notes: '',
    });

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();

    const amount = Number(form.amount);
    if (!form.description.trim()) return toast.error('Escribí una descripción.');
    if (!amount || amount <= 0) return toast.error('El monto tiene que ser mayor a cero.');

    setSaving(true);
    const result = await createExpense({
      description: form.description,
      amount,
      expense_date: form.expense_date,
      category_id: form.category_id || null,
      supplier: form.supplier || undefined,
      payment_method: form.payment_method || undefined,
      notes: form.notes || undefined,
    });
    setSaving(false);

    if (!result.success) {
      toast.error(result.error || 'No se pudo registrar el gasto.');
      return;
    }

    toast.success('Gasto registrado');
    reset();
    onOpenChange(false);
    onSaved();
    router.refresh();
  };

  const addCategory = async () => {
    if (!newCategory.trim()) return;

    const result = await createExpenseCategory(newCategory.trim());
    if (!result.success) {
      toast.error(result.error || 'No se pudo crear la categoría.');
      return;
    }
    toast.success('Categoría creada');
    setNewCategory('');
    router.refresh();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Registrar gasto</DialogTitle>
          <DialogDescription>
            Cargalo apenas ocurre: es lo que hace que el margen del mes sea real.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <Label htmlFor="description">Descripción *</Label>
            <Input
              id="description"
              value={form.description}
              onChange={(event) => setForm({ ...form, description: event.target.value })}
              placeholder="Compra de harina y azúcar"
              className="mt-1.5"
              required
              autoFocus
            />
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <Label htmlFor="amount">Monto *</Label>
              <Input
                id="amount"
                type="number"
                min={0}
                step="0.01"
                value={form.amount}
                onChange={(event) => setForm({ ...form, amount: event.target.value })}
                className="mt-1.5"
                required
              />
            </div>
            <div>
              <Label htmlFor="expense_date">Fecha *</Label>
              <Input
                id="expense_date"
                type="date"
                value={form.expense_date}
                onChange={(event) => setForm({ ...form, expense_date: event.target.value })}
                className="mt-1.5"
                required
              />
            </div>
          </div>

          <div>
            <Label htmlFor="category">Categoría</Label>
            <select
              id="category"
              value={form.category_id}
              onChange={(event) => setForm({ ...form, category_id: event.target.value })}
              className="mt-1.5 h-10 w-full rounded-md border border-stone-300 bg-white px-3 text-sm"
            >
              <option value="">Sin categoría</option>
              {categories.map((category) => (
                <option key={category.id} value={category.id}>
                  {category.name}
                </option>
              ))}
            </select>

            <div className="mt-2 flex gap-2">
              <Input
                value={newCategory}
                onChange={(event) => setNewCategory(event.target.value)}
                placeholder="Crear una categoría nueva"
                className="h-9 text-sm"
              />
              <Button type="button" variant="outline" size="sm" onClick={addCategory}>
                Agregar
              </Button>
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <Label htmlFor="supplier">Proveedor</Label>
              <Input
                id="supplier"
                value={form.supplier}
                onChange={(event) => setForm({ ...form, supplier: event.target.value })}
                className="mt-1.5"
              />
            </div>
            <div>
              <Label htmlFor="payment">Método de pago</Label>
              <select
                id="payment"
                value={form.payment_method}
                onChange={(event) =>
                  setForm({ ...form, payment_method: event.target.value as PaymentMethod | '' })
                }
                className="mt-1.5 h-10 w-full rounded-md border border-stone-300 bg-white px-3 text-sm"
              >
                <option value="">Sin definir</option>
                {PAYMENT_METHODS.map((method) => (
                  <option key={method} value={method}>
                    {PAYMENT_METHOD_LABELS[method]}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <Label htmlFor="notes">Notas</Label>
            <Textarea
              id="notes"
              value={form.notes}
              onChange={(event) => setForm({ ...form, notes: event.target.value })}
              rows={2}
              className="mt-1.5"
            />
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button type="submit" disabled={saving}>
              {saving && <Loader2 className="h-4 w-4 animate-spin" />}
              Guardar gasto
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
