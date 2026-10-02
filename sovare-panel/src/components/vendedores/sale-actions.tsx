'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Loader2, UserPlus } from 'lucide-react';
import { toast } from 'sonner';
import { createClientFromSale, voidSale } from '@/actions/vendedores';

/**
 * Anular una venta aprobada, mientras no esté liquidada.
 *
 * Pide el motivo: una comisión que se acreditó y después se sacó es exactamente lo
 * que el vendedor va a preguntar, y la respuesta tiene que estar escrita.
 */
export function VoidSale({ saleId }: { saleId: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);

  const confirm = async () => {
    setBusy(true);
    const result = await voidSale(saleId, reason);
    setBusy(false);

    if (!result.success) {
      toast.error(result.error ?? 'No se pudo anular.');
      return;
    }
    toast.success('Anulada. Salió del saldo del vendedor.');
    setOpen(false);
    router.refresh();
  };

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex h-9 items-center rounded-lg border border-stone-300 bg-white px-3 text-sm font-medium text-stone-600 transition-colors hover:border-rose-300 hover:text-rose-600"
      >
        Anular esta venta
      </button>
    );
  }

  return (
    <div className="space-y-2 rounded-lg border border-rose-200 bg-rose-50 p-3">
      <label htmlFor="motivo-anulacion" className="text-sm font-medium text-stone-900">
        ¿Por qué se anula?
      </label>
      <p className="text-xs leading-relaxed text-stone-600">
        La comisión sale del saldo del vendedor. Anotá el motivo: es lo que le vas a contestar si
        pregunta.
      </p>
      <textarea
        id="motivo-anulacion"
        value={reason}
        onChange={(event) => setReason(event.target.value)}
        rows={2}
        placeholder="El cliente nunca pagó, se dio de baja antes de empezar…"
        className="field h-auto w-full bg-white py-2"
      />
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={confirm}
          disabled={busy || !reason.trim()}
          className="inline-flex h-9 items-center gap-2 rounded-lg bg-rose-600 px-4 text-sm font-medium text-white transition-colors hover:bg-rose-700 disabled:opacity-50"
        >
          {busy && <Loader2 className="h-4 w-4 animate-spin" />}
          Anular la venta
        </button>
        <button
          type="button"
          onClick={() => setOpen(false)}
          className="text-sm text-stone-500 hover:text-stone-800"
        >
          Cancelar
        </button>
      </div>
    </div>
  );
}

/** Crea la ficha de cliente a partir de la venta, anotando quién lo trajo. */
export function CreateClientFromSale({ saleId }: { saleId: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  const create = async () => {
    setBusy(true);
    const result = await createClientFromSale(saleId);
    setBusy(false);

    if (!result.success || !result.id) {
      toast.error(result.error ?? 'No se pudo crear la ficha.');
      return;
    }
    router.push(`/clientes/${result.id}`);
  };

  return (
    <button
      type="button"
      onClick={create}
      disabled={busy}
      className="inline-flex h-9 items-center gap-2 rounded-lg bg-brand-800 px-4 text-sm font-medium text-white transition-colors hover:bg-brand-900 disabled:opacity-60"
    >
      {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <UserPlus className="h-4 w-4" />}
      Crear la ficha de cliente
    </button>
  );
}
