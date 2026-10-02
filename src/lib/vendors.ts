import { createSovareClient } from '@/lib/supabase/service';
import type {
  VendorPlanOption,
  VendorPortalView,
  VendorSaleView,
  VendorSettlementView,
} from '@/types/vendor';

/**
 * Lectura de la página de un vendedor.
 *
 * Corre con la service role, porque quien abre el link no tiene sesión. Eso la
 * hace peligrosa en un sentido concreto: saltea RLS, así que lo único que separa a
 * un vendedor de los datos de otro es esta función. Por eso todo lo que se lee
 * lleva el `vendor_id` del dueño del token, y ninguna consulta toma un id que
 * venga del navegador.
 *
 * La service role sólo tiene permiso de lectura sobre estas tablas (y de insertar
 * ventas): ni un error acá puede aprobar una comisión.
 */

export function vendorsEnabled(): boolean {
  return Boolean(createSovareClient());
}

/** El token son 64 caracteres hexadecimales. Se valida antes de tocar la base. */
export function isVendorToken(value: string): boolean {
  return /^[0-9a-f]{32,64}$/.test(value);
}

const sum = (values: number[]) => values.reduce((total, value) => total + value, 0);

/** "Octubre 2026" a partir de un primer día de mes (`2026-10-01`). */
export function monthLabel(period: string): string {
  const label = new Intl.DateTimeFormat('es-AR', {
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC',
  }).format(new Date(`${period}T12:00:00Z`));
  // Mayúscula sólo en la primera letra; `capitalize` de CSS la pondría en cada palabra.
  return label.charAt(0).toUpperCase() + label.slice(1);
}

/** Primer día del mes en curso, en hora argentina. Sólo para mostrarlo. */
export function currentPeriod(now = new Date()): string {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Argentina/Buenos_Aires',
    year: 'numeric',
    month: '2-digit',
  }).formatToParts(now);
  const year = parts.find((part) => part.type === 'year')?.value;
  const month = parts.find((part) => part.type === 'month')?.value;
  return `${year}-${month}-01`;
}

export async function getVendorPortal(token: string): Promise<VendorPortalView | null> {
  if (!isVendorToken(token)) return null;

  const supabase = createSovareClient();
  if (!supabase) return null;

  const { data: vendor, error } = await supabase
    .from('vendors')
    .select('id, name, is_active, commission_pct')
    .eq('token', token)
    .maybeSingle();

  if (error) throw new Error(`No se pudo leer al vendedor: ${error.message}`);
  if (!vendor) return null;

  const [salesRes, balancesRes, settlementsRes, plansRes] = await Promise.all([
    supabase
      .from('vendor_sales')
      .select(
        'id, business_name, plan, status, submitted_at, decision_notes, void_notes, commission_amount, period'
      )
      .eq('vendor_id', vendor.id)
      .order('submitted_at', { ascending: false })
      .limit(200),
    supabase
      .from('vendor_period_balances')
      .select('period, is_current, accrued, unsettled')
      .eq('vendor_id', vendor.id),
    supabase
      .from('vendor_settlements')
      .select('id, period, sales_count, total, status, paid_at')
      .eq('vendor_id', vendor.id)
      .neq('status', 'anulada')
      .order('settled_at', { ascending: false }),
    supabase.from('plans').select('code, label, monthly').eq('is_active', true).order('sort_order'),
  ]);

  // Una lectura que falla no puede mostrarse como "no cargaste nada": es la plata
  // de alguien, y una pantalla vacía por un error se lee como un saldo en cero.
  const failed = [salesRes, balancesRes, settlementsRes, plansRes].find((res) => res.error);
  if (failed?.error) throw new Error(`No se pudo leer la página del vendedor: ${failed.error.message}`);

  const balances = (balancesRes.data ?? []) as {
    period: string;
    is_current: boolean;
    accrued: number | string;
    unsettled: number | string;
  }[];

  const settlements: VendorSettlementView[] = (settlementsRes.data ?? []).map((row) => ({
    id: row.id,
    period: row.period,
    sales_count: Number(row.sales_count),
    total: Number(row.total),
    status: row.status,
    paid_at: row.paid_at,
  }));

  const sales: VendorSaleView[] = (salesRes.data ?? []).map((row) => ({
    id: row.id,
    business_name: row.business_name,
    plan: row.plan,
    status: row.status,
    submitted_at: row.submitted_at,
    decision_notes: row.decision_notes,
    void_notes: row.void_notes,
    commission_amount: row.commission_amount === null ? null : Number(row.commission_amount),
    period: row.period,
  }));

  const pct = Number(vendor.commission_pct);
  const plans: VendorPlanOption[] = (plansRes.data ?? []).map((row) => ({
    code: row.code,
    label: row.label,
    monthly: Number(row.monthly),
    commission: Math.round((Number(row.monthly) * pct) / 100),
  }));

  return {
    name: vendor.name,
    isActive: vendor.is_active,
    commissionPct: pct,
    sales,
    settlements,
    plans,
    summary: {
      thisMonth: sum(balances.filter((b) => b.is_current).map((b) => Number(b.accrued))),
      toCollect:
        sum(balances.filter((b) => !b.is_current).map((b) => Number(b.unsettled))) +
        sum(settlements.filter((s) => s.status === 'liquidada').map((s) => s.total)),
      collected: sum(settlements.filter((s) => s.status === 'pagada').map((s) => s.total)),
      currentPeriod: currentPeriod(),
    },
  };
}
