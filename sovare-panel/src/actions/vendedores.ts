'use server';

import { randomUUID } from 'node:crypto';
import { revalidatePath } from 'next/cache';
import { createServerClient, requireAdmin } from '@/lib/supabase/server';
import { mensajeDeError } from '@/lib/vendedores';
import { todayISO } from '@/lib/utils';
import type { VendorSale } from '@/types';

/**
 * Escrituras de la sección de vendedores.
 *
 * Todo lo que mueve plata (aprobar, anular, liquidar, deshacer, pagar) llama a una
 * función de la base y no arma UPDATEs desde acá. Cada una de esas funciones hace
 * todas sus escrituras en una transacción, y esa es la garantía de que el saldo
 * de un vendedor nunca queda a medias.
 */

type Result = { success: boolean; error?: string; id?: string };

const DENIED: Result = { success: false, error: 'No tenés permiso.' };

function refrescar(vendorId?: string, saleId?: string) {
  revalidatePath('/vendedores');
  if (vendorId) revalidatePath(`/vendedores/${vendorId}`);
  if (saleId) revalidatePath(`/vendedores/ventas/${saleId}`);
}

// ============================================
// Vendedores
// ============================================

export async function saveVendor(id: string | null, formData: FormData): Promise<Result> {
  if (!(await requireAdmin())) return DENIED;

  const text = (key: string) => ((formData.get(key) as string | null) ?? '').trim() || null;

  const name = text('name');
  if (!name) return { success: false, error: 'El nombre es obligatorio.' };

  // Acepta coma decimal: quien escribe "12,5" no tiene por qué saber que acá va punto.
  const rawPct = ((formData.get('commission_pct') as string | null) ?? '').trim().replace(',', '.');
  const commission = rawPct === '' ? 50 : Number(rawPct);
  if (!Number.isFinite(commission) || commission < 0 || commission > 100) {
    return { success: false, error: 'El porcentaje tiene que estar entre 0 y 100.' };
  }

  const email = text('email');
  if (email && !/^\S+@\S+\.\S+$/.test(email)) {
    return { success: false, error: 'El mail no parece válido.' };
  }

  const payload = {
    name,
    whatsapp: text('whatsapp'),
    email,
    city: text('city'),
    commission_pct: commission,
    payout_alias: text('payout_alias'),
    payout_holder: text('payout_holder'),
    notes: text('notes'),
    // En el alta no hay casilla: nace activo. Al editar, la casilla desmarcada
    // no viaja en el formulario, y eso es justamente "pausado".
    ...(id ? { is_active: formData.get('is_active') === 'on' } : {}),
  };

  const supabase = await createServerClient();

  if (id) {
    const { error } = await supabase.from('vendors').update(payload).eq('id', id);
    if (error) return { success: false, error: 'No se pudo guardar.' };
    refrescar(id);
    return { success: true, id };
  }

  const { data, error } = await supabase.from('vendors').insert(payload).select('id').single();
  if (error || !data) return { success: false, error: 'No se pudo agregar el vendedor.' };

  refrescar();
  return { success: true, id: data.id };
}

/**
 * Elimina un vendedor que todavía no hizo nada.
 *
 * Es para el alta equivocada: el nombre mal escrito, el que se creó para probar. En
 * cuanto cargó un cliente o tiene una liquidación ya no se puede borrar —la base lo
 * impide—, porque ahí hay plata de por medio y borrarlo borraría la explicación.
 * Para ese caso está pausarlo.
 */
export async function deleteVendor(id: string): Promise<Result> {
  if (!(await requireAdmin())) return DENIED;

  const supabase = await createServerClient();

  const [sales, settlements] = await Promise.all([
    supabase.from('vendor_sales').select('id', { count: 'exact', head: true }).eq('vendor_id', id),
    supabase
      .from('vendor_settlements')
      .select('id', { count: 'exact', head: true })
      .eq('vendor_id', id),
  ]);

  if ((sales.count ?? 0) > 0 || (settlements.count ?? 0) > 0) {
    return {
      success: false,
      error: 'Ya tiene clientes o liquidaciones, así que no se puede eliminar. Pausalo en cambio.',
    };
  }

  const { error } = await supabase.from('vendors').delete().eq('id', id);
  if (error) return { success: false, error: 'No se pudo eliminar al vendedor.' };

  refrescar();
  return { success: true };
}

/**
 * Cambia el link de un vendedor. El anterior deja de funcionar al instante.
 *
 * Es lo que se hace si el link se mandó al chat equivocado o si alguien que no
 * debía lo tiene: el vendedor no tiene contraseña que cambiar, el link es todo lo
 * que lo identifica.
 */
export async function regenerateVendorToken(id: string): Promise<Result> {
  if (!(await requireAdmin())) return DENIED;

  const token = randomUUID().replace(/-/g, '') + randomUUID().replace(/-/g, '');

  const supabase = await createServerClient();
  const { error } = await supabase.from('vendors').update({ token }).eq('id', id);
  if (error) return { success: false, error: 'No se pudo generar el link nuevo.' };

  refrescar(id);
  return { success: true, id };
}

// ============================================
// Ventas
// ============================================

export async function decideSale(
  saleId: string,
  decision: 'aprobada' | 'rechazada',
  options: { plan?: string | null; amount?: number | null; notes?: string | null } = {}
): Promise<Result> {
  if (!(await requireAdmin())) return DENIED;

  if (options.amount != null && (!Number.isFinite(options.amount) || options.amount < 0)) {
    return { success: false, error: 'El importe de la comisión no es válido.' };
  }

  const supabase = await createServerClient();
  const { data, error } = await supabase.rpc('decide_vendor_sale', {
    p_sale: saleId,
    p_decision: decision,
    p_plan: options.plan || null,
    p_amount: options.amount ?? null,
    p_notes: options.notes?.trim() || null,
  });

  if (error) {
    return { success: false, error: mensajeDeError(error, 'No se pudo guardar la decisión.') };
  }

  const sale = data as VendorSale;
  refrescar(sale.vendor_id, saleId);
  return { success: true, id: saleId };
}

export async function voidSale(saleId: string, notes: string): Promise<Result> {
  if (!(await requireAdmin())) return DENIED;

  const supabase = await createServerClient();
  const { data, error } = await supabase.rpc('void_vendor_sale', {
    p_sale: saleId,
    p_notes: notes.trim(),
  });

  if (error) return { success: false, error: mensajeDeError(error, 'No se pudo anular.') };

  refrescar((data as VendorSale).vendor_id, saleId);
  return { success: true, id: saleId };
}

/**
 * Convierte una venta aprobada en ficha de cliente.
 *
 * Es la misma idea que `convertSignupToClient`: lo que se sabe se copia, y queda
 * anotado quién lo trajo, que es el dato que después se discute si falta.
 */
export async function createClientFromSale(saleId: string): Promise<Result> {
  if (!(await requireAdmin())) return DENIED;

  const supabase = await createServerClient();

  const { data: sale } = await supabase
    .from('vendor_sales')
    .select('*, vendors(name)')
    .eq('id', saleId)
    .maybeSingle();

  if (!sale) return { success: false, error: 'No encontramos la venta.' };
  if (sale.client_id) return { success: false, error: 'Esta venta ya tiene su ficha.' };
  if (sale.status !== 'aprobada') {
    return { success: false, error: 'La ficha se crea cuando la venta está aprobada.' };
  }

  const vendor = Array.isArray(sale.vendors) ? sale.vendors[0] : sale.vendors;
  const vendorName: string = vendor?.name ?? 'un vendedor';

  const { data: plan } = await supabase
    .from('plans')
    .select('label, monthly, setup')
    .eq('code', sale.plan)
    .maybeSingle();

  const today = todayISO();
  const notes = [
    `Lo cargó ${vendorName} el ${new Intl.DateTimeFormat('es-AR', { dateStyle: 'medium' }).format(new Date(sale.submitted_at))}.`,
    sale.notes ? `Nota del vendedor: ${sale.notes}` : null,
  ]
    .filter(Boolean)
    .join('\n');

  const { data: client, error } = await supabase
    .from('clients')
    .insert({
      business_name: sale.business_name,
      contact_name: sale.contact_name,
      whatsapp: sale.whatsapp,
      email: sale.email,
      industry: sale.industry,
      city: sale.city,
      status: 'implementacion',
      source: `Vendedor: ${vendorName}`,
      started_at: today,
      plan: plan?.label || sale.plan,
      monthly_amount: plan?.monthly ?? null,
      setup_amount: plan?.setup ?? null,
      notes,
    })
    .select('id')
    .single();

  if (error || !client) return { success: false, error: 'No se pudo crear la ficha.' };

  const { error: linkError } = await supabase
    .from('vendor_sales')
    .update({ client_id: client.id })
    .eq('id', saleId);

  if (linkError) {
    // Sin el vínculo, otro clic crearía una segunda ficha del mismo cliente.
    await supabase.from('clients').delete().eq('id', client.id);
    return { success: false, error: 'No se pudo vincular la ficha a la venta.' };
  }

  refrescar(sale.vendor_id, saleId);
  revalidatePath('/clientes');
  return { success: true, id: client.id };
}

// ============================================
// Liquidaciones
// ============================================

export async function settlePeriod(vendorId: string, period: string): Promise<Result> {
  if (!(await requireAdmin())) return DENIED;

  const supabase = await createServerClient();
  const { error } = await supabase.rpc('settle_vendor_period', {
    p_vendor: vendorId,
    p_period: period,
  });

  if (error) return { success: false, error: mensajeDeError(error, 'No se pudo liquidar.') };

  refrescar(vendorId);
  return { success: true, id: vendorId };
}

export async function undoSettlement(settlementId: string, vendorId: string): Promise<Result> {
  if (!(await requireAdmin())) return DENIED;

  const supabase = await createServerClient();
  const { error } = await supabase.rpc('unsettle_vendor', { p_settlement: settlementId });

  if (error) {
    return { success: false, error: mensajeDeError(error, 'No se pudo deshacer la liquidación.') };
  }

  refrescar(vendorId);
  return { success: true, id: settlementId };
}

export async function markSettlementPaid(
  settlementId: string,
  vendorId: string,
  paid: boolean,
  reference?: string
): Promise<Result> {
  if (!(await requireAdmin())) return DENIED;

  const supabase = await createServerClient();
  const { error } = await supabase.rpc('mark_settlement_paid', {
    p_settlement: settlementId,
    p_paid: paid,
    p_reference: reference?.trim() || null,
  });

  if (error) return { success: false, error: mensajeDeError(error, 'No se pudo actualizar el pago.') };

  refrescar(vendorId);
  return { success: true, id: settlementId };
}
