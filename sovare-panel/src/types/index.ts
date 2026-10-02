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

  /** El mensaje escrito para este negocio, que el botón de WhatsApp precarga. */
  outreach_message: string | null;
  /** El asunto del mail. Aparte del mensaje, porque un asunto no es una oración. */
  outreach_subject: string | null;
  /** Cuándo le escribimos por primera vez. NULL es "todavía no". */
  contacted_at: string | null;
  /** De dónde salió el contacto, para poder verificarlo. */
  source_url: string | null;

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

// ============================================
// Contrataciones desde la página
// ============================================

export const SIGNUP_STATUSES = [
  'esperando_comprobante',
  'en_revision',
  'aprobado',
  'rechazado',
] as const;

export type SignupStatus = (typeof SIGNUP_STATUSES)[number];

export const SIGNUP_STATUS_META: Record<
  SignupStatus,
  { label: string; badge: string; dot: string; help: string }
> = {
  esperando_comprobante: {
    label: 'Sin comprobante',
    badge: 'bg-stone-100 text-stone-700 border-stone-200',
    dot: 'bg-stone-400',
    help: 'Dejó los datos y todavía no subió nada.',
  },
  en_revision: {
    label: 'Para revisar',
    badge: 'bg-amber-50 text-amber-800 border-amber-200',
    dot: 'bg-amber-500',
    help: 'Subió el comprobante y no se pudo confirmar solo.',
  },
  aprobado: {
    label: 'Aprobada',
    badge: 'bg-emerald-50 text-emerald-800 border-emerald-200',
    dot: 'bg-emerald-500',
    help: 'El pago está confirmado.',
  },
  rechazado: {
    label: 'Rechazada',
    badge: 'bg-rose-50 text-rose-700 border-rose-200',
    dot: 'bg-rose-500',
    help: 'No se pudo confirmar el pago.',
  },
};

export type AiVerdict = 'valido' | 'dudoso' | 'invalido';

export const AI_VERDICT_META: Record<AiVerdict, { label: string; badge: string }> = {
  valido: { label: 'La IA lo dio por válido', badge: 'bg-emerald-50 text-emerald-800 border-emerald-200' },
  dudoso: { label: 'La IA no se definió', badge: 'bg-amber-50 text-amber-800 border-amber-200' },
  invalido: { label: 'La IA lo dio por inválido', badge: 'bg-rose-50 text-rose-700 border-rose-200' },
};

export interface Signup {
  id: string;
  token: string;
  business_name: string;
  contact_name: string | null;
  email: string;
  whatsapp: string | null;
  city: string | null;
  industry: string | null;
  plan: string;
  includes_setup: boolean;
  amount: number;
  currency: string;
  status: SignupStatus;
  receipt_path: string | null;
  receipt_uploaded_at: string | null;
  ai_verdict: AiVerdict | null;
  ai_confidence: number | null;
  ai_summary: string | null;
  ai_extracted: Record<string, unknown> | null;
  ai_checked_at: string | null;
  decided_by: string | null;
  decided_at: string | null;
  decision_notes: string | null;
  client_id: string | null;
  onboarding: Record<string, string | null> | null;
  onboarding_at: string | null;
  notified_at: string | null;
  /** El negocio y la cuenta que se crearon al aprobar el pago (planes de autoservicio). */
  business_id: string | null;
  owner_user_id: string | null;
  store_slug: string | null;
  provisioned_at: string | null;
  provision_error: string | null;
  password_set_at: string | null;
  /** Cuándo se le avisó que su sistema está listo (planes con puesta a punto). */
  ready_notified_at: string | null;
  created_at: string;
}

export interface Plan {
  code: string;
  label: string;
  monthly: number;
  setup: number;
  currency: string;
  sort_order: number;
  is_active: boolean;
}

// ============================================
// Vendedores a comisión
// ============================================

export interface Vendor {
  id: string;
  /** Es la llave de su página: quien tiene el link entra como él. */
  token: string;
  name: string;
  whatsapp: string | null;
  email: string | null;
  city: string | null;
  /** Porcentaje de la cuota del primer mes que se le acredita por venta. */
  commission_pct: number;
  payout_alias: string | null;
  payout_holder: string | null;
  is_active: boolean;
  notes: string | null;
  created_at: string;
}

export const VENDOR_SALE_STATUSES = ['pendiente', 'aprobada', 'rechazada', 'anulada'] as const;
export type VendorSaleStatus = (typeof VENDOR_SALE_STATUSES)[number];

export const VENDOR_SALE_STATUS_META: Record<
  VendorSaleStatus,
  { label: string; badge: string; help: string }
> = {
  pendiente: {
    label: 'Para aprobar',
    badge: 'bg-amber-50 text-amber-800 border-amber-200',
    help: 'El vendedor lo cargó y falta que lo revises.',
  },
  aprobada: {
    label: 'Aprobada',
    badge: 'bg-emerald-50 text-emerald-800 border-emerald-200',
    help: 'La comisión está acreditada en su saldo.',
  },
  rechazada: {
    label: 'Rechazada',
    badge: 'bg-rose-50 text-rose-700 border-rose-200',
    help: 'No se aprobó. El vendedor ve el motivo.',
  },
  anulada: {
    label: 'Anulada',
    badge: 'bg-stone-100 text-stone-500 border-stone-200',
    help: 'Estaba aprobada y se dio de baja antes de liquidarla.',
  },
};

export interface VendorSale {
  id: string;
  vendor_id: string;
  business_name: string;
  contact_name: string | null;
  whatsapp: string | null;
  email: string | null;
  city: string | null;
  industry: string | null;
  plan: string | null;
  notes: string | null;
  status: VendorSaleStatus;
  submitted_at: string;
  decided_at: string | null;
  decision_notes: string | null;
  /** Lo que se congeló al aprobar: la cuota del plan, el porcentaje y el importe. */
  plan_monthly: number | null;
  commission_pct: number | null;
  commission_amount: number | null;
  /** Primer día del mes en que se aprobó: es el mes del saldo. */
  period: string | null;
  settlement_id: string | null;
  voided_at: string | null;
  void_notes: string | null;
  client_id: string | null;
}

export type SettlementStatus = 'liquidada' | 'pagada' | 'anulada';

export const SETTLEMENT_STATUS_META: Record<SettlementStatus, { label: string; badge: string }> = {
  liquidada: { label: 'A transferir', badge: 'bg-amber-50 text-amber-800 border-amber-200' },
  pagada: { label: 'Pagada', badge: 'bg-emerald-50 text-emerald-800 border-emerald-200' },
  anulada: { label: 'Deshecha', badge: 'bg-stone-100 text-stone-500 border-stone-200' },
};

export interface VendorSettlement {
  id: string;
  vendor_id: string;
  period: string;
  sales_count: number;
  total: number;
  currency: string;
  status: SettlementStatus;
  settled_at: string;
  paid_at: string | null;
  paid_reference: string | null;
}

/** Una fila de `sovare.vendor_period_balances`: lo aprobado de un vendedor en un mes. */
export interface VendorBalance {
  vendor_id: string;
  period: string;
  is_current: boolean;
  sales_count: number;
  accrued: number;
  unsettled: number;
  unsettled_count: number;
}

export interface SaleMatch {
  kind: 'venta' | 'contratacion' | 'cliente';
  ref_id: string;
  label: string;
  status: string;
  detail: string;
}
