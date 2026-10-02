'use server';

import { createSovareClient } from '@/lib/supabase/service';
import { isVendorToken, vendorsEnabled } from '@/lib/vendors';
import { vendorSaleSchema, type VendorSaleValues } from '@/lib/validations/vendor';
import { sendMail } from '@/lib/mailer';
import { buildVendorSaleNotice } from '@/lib/vendor-mail';
import { CONTACT_EMAIL, SOVARE_PANEL_URL } from '@/lib/marketing';

/**
 * Lo que un vendedor puede hacer desde su página: cargar un cliente.
 *
 * Es lo único. Aprobar, rechazar y liquidar no están acá ni pueden estarlo: la
 * service role con la que corre esto recibe permiso de lectura y de insertar
 * ventas, y nada más. Que el vendedor pueda escribir solo "una venta pendiente"
 * es lo que garantiza que ninguna comisión se acredita sin que la mire el dueño.
 */

type Result<T> = { success: true; data: T } | { success: false; error: string };

/**
 * Cuántos clientes puede tener esperando aprobación a la vez.
 *
 * El link de un vendedor es todo lo que hace falta para escribir en su nombre; si
 * se filtra, esto es lo que impide que alguien llene el panel de basura. Un
 * vendedor real no junta más de unos pocos sin aprobar.
 */
const MAX_PENDING = 25;

export async function submitVendorSale(
  token: string,
  input: VendorSaleValues
): Promise<Result<{ business: string }>> {
  if (!vendorsEnabled() || !isVendorToken(token)) return fail('Este link no es válido.');

  const parsed = vendorSaleSchema.safeParse(input);
  if (!parsed.success) {
    return fail(parsed.error.issues[0]?.message || 'Revisá los datos del cliente.');
  }
  const sale = parsed.data;

  const supabase = createSovareClient();
  if (!supabase) return fail('No está disponible en este momento.');

  const { data: vendor } = await supabase
    .from('vendors')
    .select('id, name, is_active')
    .eq('token', token)
    .maybeSingle();

  if (!vendor) return fail('Este link no es válido.');
  if (!vendor.is_active) return fail('Tu acceso está pausado. Escribinos y lo vemos.');

  // El plan se valida contra la tabla: lo que llega del navegador es sólo un texto.
  const { data: plan } = await supabase
    .from('plans')
    .select('code, label')
    .eq('code', sale.plan)
    .eq('is_active', true)
    .maybeSingle();
  if (!plan) return fail('Ese plan no existe. Volvé a elegir uno.');

  const { count } = await supabase
    .from('vendor_sales')
    .select('id', { count: 'exact', head: true })
    .eq('vendor_id', vendor.id)
    .eq('status', 'pendiente');

  if ((count ?? 0) >= MAX_PENDING) {
    return fail(
      'Tenés muchos clientes esperando aprobación. Cuando revisemos los que ya cargaste, podés seguir.'
    );
  }

  const clean = (value?: string) => (value && value.trim() ? value.trim() : null);

  const { data: inserted, error } = await supabase
    .from('vendor_sales')
    .insert({
      vendor_id: vendor.id,
      business_name: sale.business_name,
      contact_name: clean(sale.contact_name),
      whatsapp: clean(sale.whatsapp),
      email: clean(sale.email)?.toLowerCase() ?? null,
      city: clean(sale.city),
      industry: clean(sale.industry),
      plan: plan.code,
      notes: clean(sale.notes),
    })
    .select('id')
    .single();

  if (error || !inserted) {
    // La base no deja al mismo vendedor tener dos veces al mismo negocio
    // pendiente o aprobado. Es lo que atrapa el doble clic en "Cargar".
    if (error?.code === '23505') return fail('Ya cargaste a este cliente.');
    console.error('[submitVendorSale] no se pudo guardar la venta:', error);
    return fail('No pudimos guardarlo. Probá de nuevo.');
  }

  await notifyOwner({
    saleId: inserted.id,
    vendorName: vendor.name,
    business: sale.business_name,
    planLabel: plan.label,
    contact: clean(sale.contact_name),
    whatsapp: clean(sale.whatsapp),
    email: clean(sale.email),
    city: clean(sale.city),
    notes: clean(sale.notes),
  });

  return { success: true, data: { business: sale.business_name } };
}

/**
 * Le avisa al dueño que hay algo para aprobar.
 *
 * Sin esto, cada cliente cargado esperaría hasta la próxima vez que alguien abra
 * el panel. Si el mail no sale no pasa nada grave: la venta ya está guardada y
 * aparece en el panel con su contador. Por eso nunca lanza.
 */
async function notifyOwner(params: {
  saleId: string;
  vendorName: string;
  business: string;
  planLabel: string;
  contact: string | null;
  whatsapp: string | null;
  email: string | null;
  city: string | null;
  notes: string | null;
}) {
  if (!CONTACT_EMAIL) return;

  const panel = SOVARE_PANEL_URL ? SOVARE_PANEL_URL.replace(/\/$/, '') : '';

  const notice = buildVendorSaleNotice({
    vendorName: params.vendorName,
    business: params.business,
    planLabel: params.planLabel,
    contact: params.contact,
    whatsapp: params.whatsapp,
    email: params.email,
    city: params.city,
    notes: params.notes,
    reviewUrl: panel ? `${panel}/vendedores/ventas/${params.saleId}` : '',
  });

  const result = await sendMail({ to: CONTACT_EMAIL, ...notice });

  if (!result.sent) {
    console.error('[submitVendorSale] no salió el aviso al dueño:', result.reason);
  }
}

// ============================================
// Helpers
// ============================================

function fail(error: string): { success: false; error: string } {
  return { success: false, error };
}
