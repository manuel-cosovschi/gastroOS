/**
 * Contratación de un plan de GastroOS.
 *
 * Aparte de `types/index.ts` a propósito: esto no es parte del producto que usa
 * un negocio gastronómico, es el proceso comercial de SOVARE. En la instalación
 * de un cliente no existe.
 */

export type SignupStatus = 'esperando_comprobante' | 'en_revision' | 'aprobado' | 'rechazado';

export type AiVerdict = 'valido' | 'dudoso' | 'invalido';

/** Lo que la contratación le muestra a quien la inició. Nada interno. */
export interface SignupPublicView {
  token: string;
  business_name: string;
  contact_name: string | null;
  email: string;
  whatsapp: string | null;
  plan: string;
  plan_label: string;
  amount: number;
  currency: string;
  status: SignupStatus;
  has_receipt: boolean;
  onboarding_done: boolean;
  created_at: string;
}

export interface OnboardingAnswers {
  // Identidad
  legal_name: string;
  display_name: string;
  industry: string;
  city: string;
  address: string;

  // Marca
  palette: string;
  typography: string;
  brand_notes: string;
  logo_path: string | null;

  // Contacto público
  public_phone: string;
  public_email: string;
  instagram: string;

  // Operación
  delivery: string;
  delivery_zones: string;
  pickup_hours: string;
  advance_notice: string;

  // Catálogo
  catalog_size: string;
  uses_recipes: string;

  // Técnico
  domain: string;
  team: string;

  // Libre
  extra: string;
}
