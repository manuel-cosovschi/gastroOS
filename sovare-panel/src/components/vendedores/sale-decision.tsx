'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Check, Loader2, X } from 'lucide-react';
import { toast } from 'sonner';
import { decideSale } from '@/actions/vendedores';
import { Field } from '@/components/ui';
import { comisionSugerida } from '@/lib/vendedores';
import { money } from '@/lib/utils';
import type { Plan } from '@/types';

/**
 * Aprobar o rechazar una venta que cargó un vendedor.
 *
 * Lo que se ve es lo que se acredita: el importe de la comisión está a la vista y
 * se puede corregir antes de aprobar. Arranca en el porcentaje del vendedor sobre
 * la cuota del plan y sigue al plan si se cambia, hasta que se lo toca a mano; a
 * partir de ahí es el que se escribió, no el calculado.
 *
 * Aprobar sin tocar nada es el camino corto. El plan es el que dijo el vendedor
 * pero se puede corregir: lo que cuenta es lo que contrató el cliente.
 */
export function SaleDecision({
  saleId,
  initialPlan,
  plans,
  vendorPct,
  vendorName,
}: {
  saleId: string;
  initialPlan: string | null;
  plans: Plan[];
  vendorPct: number;
  vendorName: string;
}) {
  const router = useRouter();
  const [plan, setPlan] = useState(
    initialPlan && plans.some((p) => p.code === initialPlan) ? initialPlan : ''
  );
  const [typedAmount, setTypedAmount] = useState<string | null>(null);
  const [notes, setNotes] = useState('');
  const [rejecting, setRejecting] = useState(false);
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);

  const selected = plans.find((p) => p.code === plan) ?? null;
  const suggested = selected ? comisionSugerida(Number(selected.monthly), vendorPct) : null;
  const shown = typedAmount ?? (suggested !== null ? String(suggested) : '');
  const value = shown.trim() === '' ? null : Number(shown.replace(',', '.'));
  const valid = value !== null && Number.isFinite(value) && value >= 0;

  const approve = async () => {
    if (!plan) {
      toast.error('Elegí el plan que contrató.');
      return;
    }
    if (!valid) {
      toast.error('Poné un importe válido para la comisión.');
      return;
    }

    setBusy(true);
    const result = await decideSale(saleId, 'aprobada', { plan, amount: value, notes });
    setBusy(false);

    if (!result.success) {
      toast.error(result.error ?? 'No se pudo aprobar.');
      return;
    }
    toast.success(`Aprobada. ${money(value)} sumados al saldo de ${vendorName}.`);
    router.refresh();
  };

  const reject = async () => {
    setBusy(true);
    const result = await decideSale(saleId, 'rechazada', { notes: reason });
    setBusy(false);

    if (!result.success) {
      toast.error(result.error ?? 'No se pudo rechazar.');
      return;
    }
    toast.success('Rechazada. El vendedor va a ver el motivo.');
    router.refresh();
  };

  return (
    <div className="space-y-5">
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Plan que contrató" hint="Corregilo si el vendedor eligió otro.">
          <select
            className="field"
            value={plan}
            onChange={(event) => {
              setPlan(event.target.value);
              // Cambiar de plan vuelve a calcular la comisión, salvo que ya se
              // haya escrito una a mano.
            }}
          >
            <option value="" disabled>
              Elegí un plan
            </option>
            {plans.map((p) => (
              <option key={p.code} value={p.code}>
                {p.label} · {money(Number(p.monthly))} por mes
              </option>
            ))}
          </select>
        </Field>

        <Field
          label="Comisión a acreditar"
          hint={
            selected
              ? `${vendorPct}% de ${money(Number(selected.monthly))}, la cuota del primer mes.`
              : 'Elegí el plan para calcularla.'
          }
        >
          <input
            className="field tabular"
            inputMode="decimal"
            value={shown}
            onChange={(event) => setTypedAmount(event.target.value)}
            aria-label="Importe de la comisión"
          />
        </Field>

        <Field label="Nota (opcional)" className="sm:col-span-2">
          <input
            className="field"
            value={notes}
            onChange={(event) => setNotes(event.target.value)}
            placeholder="Por ejemplo, por qué se corrigió el importe"
          />
        </Field>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={approve}
          disabled={busy || rejecting}
          className="inline-flex h-10 items-center gap-2 rounded-lg bg-emerald-700 px-4 text-sm font-medium text-white transition-colors hover:bg-emerald-800 disabled:opacity-50"
        >
          {busy && !rejecting ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Check className="h-4 w-4" />
          )}
          {valid ? `Aprobar y sumar ${money(value)} al saldo` : 'Aprobar'}
        </button>
        <button
          type="button"
          onClick={() => setRejecting((open) => !open)}
          disabled={busy}
          className="inline-flex h-10 items-center gap-2 rounded-lg border border-stone-300 bg-white px-4 text-sm font-medium text-stone-600 transition-colors hover:bg-stone-50 disabled:opacity-50"
        >
          <X className="h-4 w-4" />
          Rechazar
        </button>
      </div>

      {rejecting && (
        <div className="space-y-2 rounded-lg border border-stone-200 bg-stone-50 p-3">
          <label htmlFor="motivo-rechazo" className="text-sm font-medium text-stone-900">
            ¿Por qué se rechaza?
          </label>
          <p className="text-xs leading-relaxed text-stone-500">
            Lo lee {vendorName} en su página, así que escribilo como se lo dirías.
          </p>
          <textarea
            id="motivo-rechazo"
            value={reason}
            onChange={(event) => setReason(event.target.value)}
            rows={2}
            placeholder="Ese negocio no produce a pedido, ya era cliente nuestro…"
            className="field h-auto w-full py-2"
          />
          <button
            type="button"
            onClick={reject}
            disabled={busy || !reason.trim()}
            className="inline-flex h-9 items-center gap-2 rounded-lg bg-rose-600 px-4 text-sm font-medium text-white transition-colors hover:bg-rose-700 disabled:opacity-50"
          >
            {busy && <Loader2 className="h-4 w-4 animate-spin" />}
            Confirmar el rechazo
          </button>
        </div>
      )}
    </div>
  );
}
