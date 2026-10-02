'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Check, Loader2, Undo2, Wallet } from 'lucide-react';
import { toast } from 'sonner';
import { markSettlementPaid, settlePeriod, undoSettlement } from '@/actions/vendedores';
import { money } from '@/lib/utils';
import type { VendorSettlement } from '@/types';

/**
 * Liquidar un mes: juntar lo aprobado y sin liquidar de ese mes en una sola
 * cifra, la que después se transfiere.
 *
 * Pide una confirmación a la vista y no un `window.confirm`: ese cuadro del
 * navegador no dice qué se va a juntar, y acá lo importante es leer el importe
 * antes de apretar.
 */
export function SettleButton({
  vendorId,
  period,
  monthLabel,
  amount,
  count,
  isCurrent,
}: {
  vendorId: string;
  period: string;
  monthLabel: string;
  amount: number;
  count: number;
  isCurrent: boolean;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);

  const settle = async () => {
    setBusy(true);
    const result = await settlePeriod(vendorId, period);
    setBusy(false);

    if (!result.success) {
      toast.error(result.error ?? 'No se pudo liquidar.');
      return;
    }
    toast.success(`${monthLabel} liquidado: ${money(amount)}.`);
    setOpen(false);
    router.refresh();
  };

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex h-8 shrink-0 items-center gap-1.5 rounded-lg border border-stone-300 bg-white px-3 text-xs font-medium text-stone-700 transition-colors hover:border-brand-400 hover:bg-stone-50"
      >
        <Wallet className="h-3.5 w-3.5" />
        Liquidar
      </button>
    );
  }

  return (
    <div className="w-full rounded-lg border border-stone-200 bg-stone-50 px-3 py-2.5 sm:w-auto sm:max-w-xs">
      <p className="text-xs leading-relaxed text-stone-700">
        Se juntan <strong>{count === 1 ? '1 cliente' : `${count} clientes`}</strong> de{' '}
        {monthLabel} en una liquidación de <strong>{money(amount)}</strong>.
        {isCurrent &&
          ' El mes sigue abierto: lo que apruebes después va a otra liquidación.'}
      </p>
      <div className="mt-2 flex items-center gap-3">
        <button
          type="button"
          onClick={settle}
          disabled={busy}
          className="inline-flex h-8 items-center gap-1.5 rounded-md bg-brand-800 px-3 text-xs font-medium text-white disabled:opacity-60"
        >
          {busy && <Loader2 className="h-3 w-3 animate-spin" />}
          Liquidar {money(amount)}
        </button>
        <button
          type="button"
          onClick={() => setOpen(false)}
          className="text-xs text-stone-500 hover:text-stone-800"
        >
          Cancelar
        </button>
      </div>
    </div>
  );
}

/**
 * Lo que se puede hacer con una liquidación según en qué punto esté:
 * a transferir (se paga o se deshace) o pagada (se puede desmarcar si fue un error).
 */
export function SettlementActions({
  settlement,
  vendorId,
}: {
  settlement: VendorSettlement;
  vendorId: string;
}) {
  const router = useRouter();
  const [mode, setMode] = useState<'idle' | 'paying' | 'undoing'>('idle');
  const [reference, setReference] = useState('');
  const [busy, setBusy] = useState(false);

  const run = async (action: () => Promise<{ success: boolean; error?: string }>, done: string) => {
    setBusy(true);
    const result = await action();
    setBusy(false);

    if (!result.success) {
      toast.error(result.error ?? 'No se pudo completar.');
      return;
    }
    toast.success(done);
    setMode('idle');
    setReference('');
    router.refresh();
  };

  if (settlement.status === 'anulada') return null;

  if (settlement.status === 'pagada') {
    return (
      <button
        type="button"
        disabled={busy}
        onClick={() =>
          run(
            () => markSettlementPaid(settlement.id, vendorId, false),
            'Quedó otra vez como pendiente de transferir.'
          )
        }
        className="inline-flex shrink-0 items-center gap-1 text-xs text-stone-400 transition-colors hover:text-stone-700 disabled:opacity-60"
      >
        <Undo2 className="h-3 w-3" />
        Deshacer pago
      </button>
    );
  }

  if (mode === 'paying') {
    return (
      <div className="w-full space-y-2 rounded-lg border border-stone-200 bg-stone-50 px-3 py-2.5 sm:w-72">
        <label className="block text-xs font-medium text-stone-700" htmlFor={`ref-${settlement.id}`}>
          Número de operación (opcional)
        </label>
        <input
          id={`ref-${settlement.id}`}
          value={reference}
          onChange={(event) => setReference(event.target.value)}
          placeholder="Para encontrar la transferencia después"
          className="field h-9"
        />
        <div className="flex items-center gap-3">
          <button
            type="button"
            disabled={busy}
            onClick={() =>
              run(
                () => markSettlementPaid(settlement.id, vendorId, true, reference),
                `Marcada como pagada: ${money(Number(settlement.total))}.`
              )
            }
            className="inline-flex h-8 items-center gap-1.5 rounded-md bg-emerald-700 px-3 text-xs font-medium text-white disabled:opacity-60"
          >
            {busy ? <Loader2 className="h-3 w-3 animate-spin" /> : <Check className="h-3 w-3" />}
            Ya la transferí
          </button>
          <button
            type="button"
            onClick={() => setMode('idle')}
            className="text-xs text-stone-500 hover:text-stone-800"
          >
            Cancelar
          </button>
        </div>
      </div>
    );
  }

  if (mode === 'undoing') {
    return (
      <div className="w-full space-y-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2.5 sm:w-72">
        <p className="text-xs leading-relaxed text-stone-700">
          Los clientes de esta liquidación vuelven al saldo del vendedor y vas a poder liquidarlos
          de nuevo. Queda anotado que se deshizo.
        </p>
        <div className="flex items-center gap-3">
          <button
            type="button"
            disabled={busy}
            onClick={() =>
              run(() => undoSettlement(settlement.id, vendorId), 'Liquidación deshecha.')
            }
            className="inline-flex h-8 items-center gap-1.5 rounded-md bg-stone-900 px-3 text-xs font-medium text-white disabled:opacity-60"
          >
            {busy && <Loader2 className="h-3 w-3 animate-spin" />}
            Sí, deshacerla
          </button>
          <button
            type="button"
            onClick={() => setMode('idle')}
            className="text-xs text-stone-500 hover:text-stone-800"
          >
            Cancelar
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex shrink-0 items-center gap-3">
      <button
        type="button"
        onClick={() => setMode('paying')}
        className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-stone-300 bg-white px-3 text-xs font-medium text-stone-700 transition-colors hover:border-emerald-300 hover:text-emerald-700"
      >
        <Check className="h-3.5 w-3.5" />
        Marcar pagada
      </button>
      <button
        type="button"
        onClick={() => setMode('undoing')}
        className="text-xs text-stone-400 transition-colors hover:text-stone-700"
      >
        Deshacer
      </button>
    </div>
  );
}
