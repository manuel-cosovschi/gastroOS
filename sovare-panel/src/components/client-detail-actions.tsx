'use client';

import { useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Check, Loader2, Plus, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { deleteClientRecord, setClientStatus } from '@/actions/clients';
import {
  createActivity,
  createPayment,
  deleteActivity,
  deletePayment,
  setPaymentStatus,
} from '@/actions/payments';
import { Field } from '@/components/ui';
import {
  ACTIVITY_KINDS,
  CLIENT_STATUSES,
  CLIENT_STATUS_META,
  PAYMENT_STATUSES,
  PAYMENT_STATUS_META,
  type Client,
  type ClientStatus,
  type PaymentStatus,
} from '@/types';
import { monthStart, todayISO } from '@/lib/utils';

/** Cambiar el estado desde la ficha, sin entrar a editar todo. */
export function StatusSelect({ client }: { client: Client }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  const change = async (status: ClientStatus) => {
    setBusy(true);
    const result = await setClientStatus(client.id, status);
    setBusy(false);
    if (!result.success) {
      toast.error(result.error ?? 'No se pudo cambiar.');
      return;
    }
    toast.success(`Ahora está en ${CLIENT_STATUS_META[status].label.toLowerCase()}.`);
    router.refresh();
  };

  return (
    <select
      value={client.status}
      disabled={busy}
      onChange={(event) => change(event.target.value as ClientStatus)}
      className="field h-9 w-auto pr-8 text-sm"
      aria-label="Estado del cliente"
    >
      {CLIENT_STATUSES.map((status) => (
        <option key={status} value={status}>
          {CLIENT_STATUS_META[status].label}
        </option>
      ))}
    </select>
  );
}

export function DeleteClient({ client }: { client: Client }) {
  const router = useRouter();
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);

  const remove = async () => {
    setBusy(true);
    const result = await deleteClientRecord(client.id);
    setBusy(false);
    if (!result.success) {
      toast.error(result.error ?? 'No se pudo eliminar.');
      return;
    }
    toast.success('Cliente eliminado.');
    router.push('/clientes');
    router.refresh();
  };

  if (!confirming) {
    return (
      <button
        onClick={() => setConfirming(true)}
        className="inline-flex h-9 items-center gap-2 rounded-lg border border-stone-300 px-3 text-sm text-stone-500 transition-colors hover:border-rose-300 hover:text-rose-600"
      >
        <Trash2 className="h-4 w-4" />
        Eliminar
      </button>
    );
  }

  return (
    <div className="flex items-center gap-2 rounded-lg border border-rose-200 bg-rose-50 px-3 py-1.5">
      <span className="text-xs text-rose-800">
        Se borran también sus cobros y notas. ¿Seguro?
      </span>
      <button
        onClick={remove}
        disabled={busy}
        className="inline-flex h-7 items-center gap-1.5 rounded-md bg-rose-600 px-2.5 text-xs font-medium text-white disabled:opacity-60"
      >
        {busy && <Loader2 className="h-3 w-3 animate-spin" />}
        Sí, eliminar
      </button>
      <button
        onClick={() => setConfirming(false)}
        className="text-xs text-stone-500 hover:text-stone-800"
      >
        No
      </button>
    </div>
  );
}

// ============================================
// Cobros
// ============================================

export function PaymentForm({ client }: { client: Client }) {
  const router = useRouter();
  const formRef = useRef<HTMLFormElement>(null);
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);

  const submit = async (formData: FormData) => {
    setBusy(true);
    const result = await createPayment(formData);
    setBusy(false);
    if (!result.success) {
      toast.error(result.error ?? 'No se pudo registrar.');
      return;
    }
    toast.success('Cobro registrado.');
    formRef.current?.reset();
    setOpen(false);
    router.refresh();
  };

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-1.5 text-sm text-stone-500 transition-colors hover:text-stone-900"
      >
        <Plus className="h-4 w-4" />
        Agregar
      </button>
    );
  }

  const today = todayISO();

  return (
    <form ref={formRef} action={submit} className="w-full border-t border-stone-200 bg-stone-50 p-5">
      <input type="hidden" name="client_id" value={client.id} />
      <input type="hidden" name="currency" value={client.currency} />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Field label="Concepto">
          <input name="concept" className="field" defaultValue="Mensualidad" required />
        </Field>
        <Field label="Período" hint="Cualquier día del mes que cubre">
          <input name="period" type="date" className="field" defaultValue={monthStart()} required />
        </Field>
        <Field label="Importe">
          <input
            name="amount"
            type="number"
            min="0"
            step="100"
            className="field"
            defaultValue={client.monthly_amount ?? ''}
            required
          />
        </Field>
        <Field label="Vence">
          <input name="due_date" type="date" className="field" defaultValue={today} required />
        </Field>
        <Field label="Estado">
          <select name="status" className="field" defaultValue="pendiente">
            {PAYMENT_STATUSES.map((status) => (
              <option key={status} value={status}>
                {PAYMENT_STATUS_META[status].label}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Método">
          <input name="method" className="field" placeholder="Transferencia, efectivo…" />
        </Field>
        <Field label="Nota" className="sm:col-span-2">
          <input name="notes" className="field" />
        </Field>
      </div>

      <div className="mt-4 flex items-center gap-3">
        <button
          type="submit"
          disabled={busy}
          className="inline-flex h-9 items-center gap-2 rounded-lg bg-brand-800 px-4 text-sm font-medium text-white disabled:opacity-60"
        >
          {busy && <Loader2 className="h-4 w-4 animate-spin" />}
          Registrar
        </button>
        <button
          type="button"
          onClick={() => setOpen(false)}
          className="text-sm text-stone-500 hover:text-stone-900"
        >
          Cancelar
        </button>
      </div>
    </form>
  );
}

export function PaymentActions({
  id,
  clientId,
  status,
}: {
  id: string;
  clientId: string;
  status: PaymentStatus;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  const change = async (next: PaymentStatus) => {
    setBusy(true);
    const result = await setPaymentStatus(id, clientId, next);
    setBusy(false);
    if (!result.success) {
      toast.error(result.error ?? 'No se pudo cambiar.');
      return;
    }
    router.refresh();
  };

  const remove = async () => {
    setBusy(true);
    const result = await deletePayment(id, clientId);
    setBusy(false);
    if (!result.success) {
      toast.error(result.error ?? 'No se pudo eliminar.');
      return;
    }
    toast.success('Cobro eliminado.');
    router.refresh();
  };

  return (
    <div className="flex shrink-0 items-center gap-1">
      {status !== 'pagado' && (
        <button
          onClick={() => change('pagado')}
          disabled={busy}
          title="Marcar como pagado"
          className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-stone-300 bg-white px-2.5 text-xs font-medium text-stone-700 transition-colors hover:border-emerald-300 hover:text-emerald-700 disabled:opacity-60"
        >
          <Check className="h-3.5 w-3.5" />
          Cobrado
        </button>
      )}
      {status === 'pagado' && (
        <button
          onClick={() => change('pendiente')}
          disabled={busy}
          className="text-xs text-stone-400 transition-colors hover:text-stone-700"
        >
          Deshacer
        </button>
      )}
      <button
        onClick={remove}
        disabled={busy}
        title="Eliminar"
        className="rounded-lg p-1.5 text-stone-300 transition-colors hover:bg-stone-100 hover:text-rose-600"
      >
        <Trash2 className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}

// ============================================
// Seguimiento
// ============================================

export function ActivityForm({ clientId }: { clientId: string }) {
  const router = useRouter();
  const formRef = useRef<HTMLFormElement>(null);
  const [busy, setBusy] = useState(false);

  const submit = async (formData: FormData) => {
    setBusy(true);
    const result = await createActivity(formData);
    setBusy(false);
    if (!result.success) {
      toast.error(result.error ?? 'No se pudo guardar.');
      return;
    }
    formRef.current?.reset();
    router.refresh();
  };

  return (
    <form ref={formRef} action={submit} className="border-b border-stone-200 bg-stone-50 p-5">
      <input type="hidden" name="client_id" value={clientId} />

      <textarea
        name="body"
        rows={2}
        required
        placeholder="Qué pasó: la llamada, lo que pidió, en qué quedaron…"
        className="field h-auto w-full py-2"
      />

      <div className="mt-3 grid gap-3 sm:grid-cols-4">
        <select name="kind" className="field" defaultValue="nota" aria-label="Tipo">
          {ACTIVITY_KINDS.map((kind) => (
            <option key={kind} value={kind}>
              {kind[0].toUpperCase() + kind.slice(1)}
            </option>
          ))}
        </select>
        <input
          name="happened_at"
          type="date"
          className="field"
          defaultValue={todayISO()}
          aria-label="Cuándo"
        />
        <input name="next_step" className="field" placeholder="Próximo paso" />
        <input name="next_step_at" type="date" className="field" aria-label="Fecha del próximo paso" />
      </div>

      <button
        type="submit"
        disabled={busy}
        className="mt-3 inline-flex h-9 items-center gap-2 rounded-lg bg-brand-800 px-4 text-sm font-medium text-white disabled:opacity-60"
      >
        {busy && <Loader2 className="h-4 w-4 animate-spin" />}
        Guardar
      </button>
    </form>
  );
}

export function ActivityDelete({ id, clientId }: { id: string; clientId: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  const remove = async () => {
    setBusy(true);
    const result = await deleteActivity(id, clientId);
    setBusy(false);
    if (!result.success) {
      toast.error(result.error ?? 'No se pudo eliminar.');
      return;
    }
    router.refresh();
  };

  return (
    <button
      onClick={remove}
      disabled={busy}
      title="Eliminar nota"
      className="rounded-lg p-1.5 text-stone-300 transition-colors hover:bg-stone-100 hover:text-rose-600"
    >
      <Trash2 className="h-3.5 w-3.5" />
    </button>
  );
}
