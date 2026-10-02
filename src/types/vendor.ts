/**
 * La página de un vendedor a comisión.
 *
 * Aparte de `types/index.ts` por el mismo motivo que `signup.ts`: esto es el
 * proceso comercial de SOVARE, no el producto que usa un negocio gastronómico. En
 * la instalación de un cliente no existe.
 */

export type VendorSaleStatus = 'pendiente' | 'aprobada' | 'rechazada' | 'anulada';

export type SettlementStatus = 'liquidada' | 'pagada';

/**
 * Lo que el vendedor ve de cada cliente que cargó.
 *
 * No incluye el teléfono ni el mail del cliente: los cargó él, no los necesita de
 * vuelta, y una página que se abre con un link que puede reenviarse no tiene por
 * qué devolver datos de terceros.
 */
export interface VendorSaleView {
  id: string;
  business_name: string;
  plan: string | null;
  status: VendorSaleStatus;
  submitted_at: string;
  /** El motivo, en un rechazo. Lo escribió el dueño pensando en que lo lea el vendedor. */
  decision_notes: string | null;
  /** Por qué se sacó del saldo una venta que estaba aprobada. */
  void_notes: string | null;
  commission_amount: number | null;
  /** Primer día del mes en que se aprobó. */
  period: string | null;
}

export interface VendorSettlementView {
  id: string;
  period: string;
  sales_count: number;
  total: number;
  status: SettlementStatus;
  paid_at: string | null;
}

export interface VendorPlanOption {
  code: string;
  label: string;
  monthly: number;
  /** Lo que ganaría con este plan, al porcentaje que tiene. Sólo orientativo. */
  commission: number;
}

export interface VendorPortalView {
  name: string;
  isActive: boolean;
  commissionPct: number;
  sales: VendorSaleView[];
  settlements: VendorSettlementView[];
  plans: VendorPlanOption[];
  summary: {
    /** Lo aprobado en el mes en curso. */
    thisMonth: number;
    /** Lo que se le debe y todavía no cobró: meses anteriores sin liquidar más lo liquidado sin pagar. */
    toCollect: number;
    /** Lo ya transferido. */
    collected: number;
    /** Primer día del mes en curso, hora argentina. */
    currentPeriod: string;
  };
}
