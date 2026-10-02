'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { saveVendor } from '@/actions/vendedores';
import { Field } from '@/components/ui';
import type { Vendor } from '@/types';

/**
 * Alta y edición de un vendedor.
 *
 * Sólo el nombre es obligatorio: lo mínimo para tener a quién mandarle el link. El
 * porcentaje arranca en 50 porque es lo acordado, pero está acá y no fijo en el
 * código porque es lo primero que se negocia distinto con cada uno.
 */
export function VendorForm({ vendor }: { vendor?: Vendor }) {
  const router = useRouter();
  const [saving, setSaving] = useState(false);

  // Se envía con onSubmit y no con `action={función}`. En React 19 un formulario
  // con `action` vacía sus campos al terminar la acción, aunque la acción haya
  // devuelto un error: quien se equivoca en el porcentaje vería el formulario
  // limpio y tendría que escribir todo de nuevo.
  const submit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);

    setSaving(true);
    const result = await saveVendor(vendor?.id ?? null, formData);
    setSaving(false);

    if (!result.success) {
      toast.error(result.error ?? 'No se pudo guardar.');
      return;
    }

    toast.success(vendor ? 'Cambios guardados.' : 'Vendedor agregado.');
    router.push(`/vendedores/${result.id}`);
    router.refresh();
  };

  return (
    <form onSubmit={submit} className="space-y-5">
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Nombre" className="sm:col-span-2">
          <input name="name" className="field" defaultValue={vendor?.name} required />
        </Field>
        <Field label="WhatsApp" hint="Con código de área. Con esto le mandás su link desde acá.">
          <input
            name="whatsapp"
            className="field"
            defaultValue={vendor?.whatsapp ?? ''}
            placeholder="223 538-3082"
          />
        </Field>
        <Field label="Mail">
          <input name="email" type="email" className="field" defaultValue={vendor?.email ?? ''} />
        </Field>
        <Field label="Ciudad">
          <input name="city" className="field" defaultValue={vendor?.city ?? ''} />
        </Field>
        <Field
          label="Comisión (%)"
          hint="Del primer mes de cada cliente. Un cambio vale desde la próxima venta que apruebes: lo ya acreditado no se mueve."
        >
          <input
            name="commission_pct"
            type="number"
            min="0"
            max="100"
            step="0.5"
            className="field"
            defaultValue={vendor?.commission_pct ?? 50}
          />
        </Field>
      </div>

      <div className="grid gap-4 border-t border-stone-100 pt-5 sm:grid-cols-2">
        <Field
          label="Alias o CBU/CVU"
          hint="A dónde le transferís. Sólo lo ves vos; en su página no aparece."
        >
          <input
            name="payout_alias"
            className="field"
            defaultValue={vendor?.payout_alias ?? ''}
          />
        </Field>
        <Field label="Titular de la cuenta">
          <input
            name="payout_holder"
            className="field"
            defaultValue={vendor?.payout_holder ?? ''}
          />
        </Field>
        <Field label="Notas" className="sm:col-span-2">
          <textarea
            name="notes"
            rows={3}
            className="field h-auto py-2"
            defaultValue={vendor?.notes ?? ''}
          />
        </Field>
      </div>

      {vendor && (
        <label className="flex items-start gap-3 rounded-lg border border-stone-200 bg-stone-50 px-4 py-3">
          <input
            type="checkbox"
            name="is_active"
            defaultChecked={vendor.is_active}
            className="mt-0.5 h-4 w-4 rounded border-stone-300"
          />
          <span className="text-sm leading-relaxed text-stone-700">
            <span className="font-medium text-stone-900">Puede cargar clientes.</span> Si lo
            desmarcás queda pausado: ve su historial pero no puede cargar nada nuevo. Su saldo no
            se toca.
          </span>
        </label>
      )}

      <div className="flex items-center gap-3">
        <button
          type="submit"
          disabled={saving}
          className="inline-flex h-10 items-center gap-2 rounded-lg bg-brand-800 px-5 text-sm font-medium text-white transition-colors hover:bg-brand-900 disabled:opacity-60"
        >
          {saving && <Loader2 className="h-4 w-4 animate-spin" />}
          {vendor ? 'Guardar cambios' : 'Agregar vendedor'}
        </button>
        {!vendor && (
          <Link
            href="/vendedores"
            className="text-sm text-stone-500 transition-colors hover:text-stone-900"
          >
            Cancelar
          </Link>
        )}
      </div>
    </form>
  );
}
