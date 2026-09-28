export const CLIENT_STATUSES = [
  'prospecto',
  'implementacion',
  'activo',
  'pausado',
  'baja',
] as const;

export type ClientStatus = (typeof CLIENT_STATUSES)[number];

/**
 * Cómo se ve cada estado y qué significa.
 *
 * Los colores van escritos completos y no armados por interpolación: Tailwind
 * lee las clases del código fuente y una clase construida en runtime nunca
 * llega a la hoja de estilos.
 */
export const CLIENT_STATUS_META: Record<
  ClientStatus,
  { label: string; badge: string; dot: string; help: string }
> = {
  prospecto: {
    label: 'Prospecto',
    badge: 'bg-stone-100 text-stone-700 border-stone-200',
    dot: 'bg-stone-400',
    help: 'Habló con nosotros y todavía no cerró.',
  },
  implementacion: {
    label: 'En implementación',
    badge: 'bg-amber-50 text-amber-800 border-amber-200',
    dot: 'bg-amber-500',
    help: 'Cerró y estamos armando su instalación.',
  },
  activo: {
    label: 'Activo',
    badge: 'bg-emerald-50 text-emerald-800 border-emerald-200',
    dot: 'bg-emerald-500',
    help: 'Usando el sistema y facturando.',
  },
  pausado: {
    label: 'Pausado',
    badge: 'bg-sky-50 text-sky-800 border-sky-200',
    dot: 'bg-sky-500',
    help: 'Suspendido temporalmente, sin cobro.',
  },
  baja: {
    label: 'Baja',
    badge: 'bg-rose-50 text-rose-800 border-rose-200',
    dot: 'bg-rose-500',
    help: 'Dejó de usarlo.',
  },
};

/** Estados que cuentan para el ingreso recurrente. */
export const BILLABLE_STATUSES: ClientStatus[] = ['activo'];

export const PAYMENT_STATUSES = ['pendiente', 'pagado', 'vencido', 'anulado'] as const;
export type PaymentStatus = (typeof PAYMENT_STATUSES)[number];

export const PAYMENT_STATUS_META: Record<PaymentStatus, { label: string; badge: string }> = {
  pendiente: { label: 'Pendiente', badge: 'bg-stone-100 text-stone-700 border-stone-200' },
  pagado: { label: 'Pagado', badge: 'bg-emerald-50 text-emerald-800 border-emerald-200' },
  vencido: { label: 'Vencido', badge: 'bg-rose-50 text-rose-800 border-rose-200' },
  anulado: { label: 'Anulado', badge: 'bg-stone-50 text-stone-400 border-stone-200' },
};

export interface Client {
  id: string;
  business_name: string;
  contact_name: string | null;
  whatsapp: string | null;
  email: string | null;
  industry: string | null;
  city: string | null;
  status: ClientStatus;
  source: string | null;
  first_contact_at: string;
  started_at: string | null;
  churned_at: string | null;
  panel_url: string | null;
  storefront_url: string | null;
  supabase_ref: string | null;
  vercel_project: string | null;
  repo_url: string | null;
  plan: string | null;
  monthly_amount: number | null;
  setup_amount: number | null;
  currency: string;
  billing_day: number | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface Payment {
  id: string;
  client_id: string;
  period: string;
  concept: string;
  amount: number;
  currency: string;
  due_date: string;
  paid_at: string | null;
  status: PaymentStatus;
  method: string | null;
  notes: string | null;
  created_at: string;
}

export interface Activity {
  id: string;
  client_id: string;
  happened_at: string;
  kind: string;
  body: string;
  next_step: string | null;
  next_step_at: string | null;
  created_at: string;
}

export const ACTIVITY_KINDS = ['nota', 'llamada', 'reunión', 'whatsapp', 'mail', 'soporte'] as const;
