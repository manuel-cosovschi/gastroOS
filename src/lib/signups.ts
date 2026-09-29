import { createSovareClient } from '@/lib/supabase/service';

/**
 * Contratación de planes de GastroOS desde la página.
 *
 * Esto es de SOVARE, no del producto: en la instalación de un cliente no tiene
 * ningún sentido que exista una pantalla para venderle GastroOS a alguien. Por
 * eso todo cuelga de que estén cargadas las variables de acá abajo; sin ellas
 * las rutas devuelven 404 y los botones de los planes no aparecen.
 */

export interface PlanAmount {
  code: string;
  label: string;
  monthly: number;
  setup: number;
  currency: string;
}

export interface TransferDetails {
  holder: string;
  bank: string;
  alias: string;
  cbu: string;
  cuit: string | null;
}

/**
 * Datos de la transferencia. Van por entorno y no en el código: son los datos
 * bancarios de una persona, y el repositorio es la plantilla que se forkea por
 * cliente.
 *
 * Si falta alguno de los tres esenciales devuelve null, y la pantalla pide
 * coordinar por WhatsApp en vez de mostrar un alias a medio cargar. Inventar un
 * CBU para que la pantalla "se vea completa" sería la peor opción posible.
 */
export function getTransferDetails(): TransferDetails | null {
  const holder = process.env.TRANSFER_HOLDER?.trim();
  const bank = process.env.TRANSFER_BANK?.trim();
  const alias = process.env.TRANSFER_ALIAS?.trim();
  const cbu = process.env.TRANSFER_CBU?.trim();
  if (!holder || !alias || !cbu) return null;

  return {
    holder,
    bank: bank || '',
    alias,
    cbu,
    cuit: process.env.TRANSFER_CUIT?.trim() || null,
  };
}

/** La contratación existe sólo si están el esquema de SOVARE y los datos de pago. */
export function signupsEnabled(): boolean {
  return Boolean(createSovareClient() && getTransferDetails());
}

/**
 * Los precios salen de `sovare.plans` y no de `marketing.ts`. Son el número que
 * se le pide transferir a alguien: tiene que haber uno solo, y tiene que poder
 * cambiarse sin desplegar. Lo que queda en el código son las palabras.
 */
export async function getPlanAmounts(): Promise<PlanAmount[]> {
  const supabase = createSovareClient();
  if (!supabase) return [];

  const { data, error } = await supabase
    .from('plans')
    .select('code, label, monthly, setup, currency')
    .eq('is_active', true)
    .order('sort_order');

  if (error) {
    console.error('[getPlanAmounts] no se pudieron leer los planes:', error);
    return [];
  }

  return (data || []).map((plan) => ({
    code: plan.code,
    label: plan.label,
    monthly: Number(plan.monthly),
    setup: Number(plan.setup),
    currency: plan.currency,
  }));
}

export async function getPlanAmount(code: string): Promise<PlanAmount | null> {
  const plans = await getPlanAmounts();
  return plans.find((plan) => plan.code === code) || null;
}

/**
 * El primer pago: la puesta a punto más el primer mes. El monto se calcula acá,
 * del lado del servidor, a partir de la tabla: si viniera del formulario,
 * cualquiera podría contratar el plan más caro por mil pesos.
 */
export function firstPayment(plan: PlanAmount, includesSetup: boolean): number {
  return includesSetup ? plan.setup + plan.monthly : plan.monthly;
}

export const SIGNUP_STATUS_LABELS: Record<string, string> = {
  esperando_comprobante: 'Esperando el comprobante',
  en_revision: 'En revisión',
  aprobado: 'Aprobada',
  rechazado: 'Rechazada',
};
