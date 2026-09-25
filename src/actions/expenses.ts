'use server';

import { revalidatePath } from 'next/cache';
import { createServerClient } from '@/lib/supabase/server';
import { requireBusinessId } from '@/lib/business';
import { round2 } from '@/lib/utils';
import type {
  CreateExpenseInput,
  Expense,
  ExpenseCategory,
  ExpenseFilters,
  UpdateExpenseInput,
} from '@/types';

// ============================================
// Gastos
// ============================================

export async function listExpenses(filters: ExpenseFilters = {}): Promise<Expense[]> {
  const businessId = await requireBusinessId();
  const supabase = await createServerClient();

  let query = supabase
    .from('expenses')
    .select('*, category:expense_categories(*)')
    .eq('business_id', businessId)
    .order('expense_date', { ascending: false })
    .order('created_at', { ascending: false });

  if (filters.category_id) query = query.eq('category_id', filters.category_id);
  if (filters.from_date) query = query.gte('expense_date', filters.from_date);
  if (filters.to_date) query = query.lte('expense_date', filters.to_date);
  if (filters.search?.trim()) {
    const term = `%${filters.search.trim()}%`;
    query = query.or(`description.ilike.${term},supplier.ilike.${term}`);
  }

  const { data } = await query;
  return (data as Expense[]) || [];
}

export async function createExpense(
  input: CreateExpenseInput
): Promise<{ success: boolean; error?: string }> {
  const error = validateExpense(input);
  if (error) return { success: false, error };

  const businessId = await requireBusinessId();
  const supabase = await createServerClient();

  const { error: insertError } = await supabase.from('expenses').insert({
    business_id: businessId,
    category_id: input.category_id || null,
    description: input.description.trim(),
    amount: round2(input.amount),
    expense_date: input.expense_date,
    supplier: input.supplier?.trim() || null,
    payment_method: input.payment_method || null,
    notes: input.notes?.trim() || null,
  });

  if (insertError) return { success: false, error: 'No se pudo registrar el gasto.' };

  revalidateExpenseViews();
  return { success: true };
}

export async function updateExpense(
  id: string,
  input: UpdateExpenseInput
): Promise<{ success: boolean; error?: string }> {
  const businessId = await requireBusinessId();
  const supabase = await createServerClient();

  const { error } = await supabase
    .from('expenses')
    .update({
      ...input,
      amount: input.amount !== undefined ? round2(input.amount) : undefined,
    })
    .eq('id', id)
    .eq('business_id', businessId);

  if (error) return { success: false, error: 'No se pudo actualizar el gasto.' };

  revalidateExpenseViews();
  return { success: true };
}

export async function deleteExpense(id: string): Promise<{ success: boolean; error?: string }> {
  const businessId = await requireBusinessId();
  const supabase = await createServerClient();

  const { error } = await supabase
    .from('expenses')
    .delete()
    .eq('id', id)
    .eq('business_id', businessId);

  if (error) return { success: false, error: 'No se pudo eliminar el gasto.' };

  revalidateExpenseViews();
  return { success: true };
}

// ============================================
// Categorías de gasto
// ============================================

export async function listExpenseCategories(): Promise<ExpenseCategory[]> {
  const businessId = await requireBusinessId();
  const supabase = await createServerClient();

  const { data } = await supabase
    .from('expense_categories')
    .select('*')
    .eq('business_id', businessId)
    .order('sort_order')
    .order('name');

  return (data as ExpenseCategory[]) || [];
}

export async function createExpenseCategory(
  name: string,
  color?: string
): Promise<{ success: boolean; error?: string }> {
  if (!name.trim()) return { success: false, error: 'El nombre es obligatorio.' };

  const businessId = await requireBusinessId();
  const supabase = await createServerClient();

  const { error } = await supabase.from('expense_categories').insert({
    business_id: businessId,
    name: name.trim(),
    color: color || '#64748b',
  });

  if (error) {
    if (error.code === '23505') return { success: false, error: 'Ya existe una categoría con ese nombre.' };
    return { success: false, error: 'No se pudo crear la categoría.' };
  }

  revalidateExpenseViews();
  return { success: true };
}

export async function updateExpenseCategory(
  id: string,
  patch: { name?: string; color?: string; is_active?: boolean }
): Promise<{ success: boolean; error?: string }> {
  const businessId = await requireBusinessId();
  const supabase = await createServerClient();

  const { error } = await supabase
    .from('expense_categories')
    .update(patch)
    .eq('id', id)
    .eq('business_id', businessId);

  if (error) return { success: false, error: 'No se pudo actualizar la categoría.' };

  revalidateExpenseViews();
  return { success: true };
}

export async function deleteExpenseCategory(
  id: string
): Promise<{ success: boolean; error?: string }> {
  const businessId = await requireBusinessId();
  const supabase = await createServerClient();

  // Los gastos quedan sin categoría (ON DELETE SET NULL), no se borran.
  const { error } = await supabase
    .from('expense_categories')
    .delete()
    .eq('id', id)
    .eq('business_id', businessId);

  if (error) return { success: false, error: 'No se pudo eliminar la categoría.' };

  revalidateExpenseViews();
  return { success: true };
}

function validateExpense(input: CreateExpenseInput): string | null {
  if (!input.description?.trim()) return 'La descripción es obligatoria.';
  if (!input.amount || input.amount <= 0) return 'El monto tiene que ser mayor a cero.';
  if (!input.expense_date) return 'La fecha es obligatoria.';
  return null;
}

function revalidateExpenseViews() {
  revalidatePath('/admin');
  revalidatePath('/admin/gastos');
  revalidatePath('/admin/estadisticas');
}
