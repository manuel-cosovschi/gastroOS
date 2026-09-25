import { listExpenseCategories, listExpenses } from '@/actions/expenses';
import { getCurrentBusiness } from '@/lib/business';
import { ExpensesClient } from '@/components/admin/expenses/expenses-client';
import { addDays, toISODate, todayISO } from '@/lib/utils';

export const metadata = { title: 'Gastos' };

/**
 * Por defecto se muestran los últimos 30 días: es el período en el que un
 * negocio chico realmente revisa lo que gastó.
 */
export default async function ExpensesPage() {
  const from = toISODate(addDays(new Date(), -29));
  const to = todayISO();

  const [expenses, categories, business] = await Promise.all([
    listExpenses({ from_date: from, to_date: to }),
    listExpenseCategories(),
    getCurrentBusiness(),
  ]);

  return (
    <ExpensesClient
      initialExpenses={expenses}
      categories={categories}
      initialRange={{ from, to }}
      currency={business?.currency}
      locale={business?.locale}
    />
  );
}
