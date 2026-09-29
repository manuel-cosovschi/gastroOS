'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Check, ExternalLink, Loader2, UserPlus, X } from 'lucide-react';
import { convertSignupToClient, decideSignup, getReceiptUrl } from '@/actions/signups';
import { cn } from '@/lib/utils';

/**
 * Decisión manual de una contratación.
 *
 * Rechazar pide un motivo y aprobar no: aprobar es lo que la persona quería que
 * pasara, y rechazar es lo que después hay que poder explicar por WhatsApp tres
 * semanas más tarde.
 */
export function SignupDecision({ id, status }: { id: string; status: string }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [asking, setAsking] = useState(false);
  const [notes, setNotes] = useState('');
  const [error, setError] = useState<string | null>(null);

  const decide = (decision: 'aprobado' | 'rechazado', motivo?: string) => {
    setError(null);
    startTransition(async () => {
      const result = await decideSignup(id, decision, motivo);
      if (!result.success) setError(result.error || 'No se pudo guardar.');
      else {
        setAsking(false);
        setNotes('');
        router.refresh();
      }
    });
  };

  if (status === 'aprobado' || status === 'rechazado') {
    return (
      <div className="flex flex-wrap gap-2">
        <button
          onClick={() => decide(status === 'aprobado' ? 'rechazado' : 'aprobado')}
          disabled={pending}
          className="inline-flex h-9 items-center gap-2 rounded-lg border border-stone-300 bg-white px-3 text-sm font-medium text-stone-600 transition-colors hover:bg-stone-50 disabled:opacity-50"
        >
          {pending && <Loader2 className="h-4 w-4 animate-spin" />}
          {status === 'aprobado' ? 'Marcar como rechazada' : 'Marcar como aprobada'}
        </button>
        {error && <p className="w-full text-sm text-rose-600">{error}</p>}
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2">
        <button
          onClick={() => decide('aprobado')}
          disabled={pending}
          className="inline-flex h-9 items-center gap-2 rounded-lg bg-emerald-700 px-4 text-sm font-medium text-white transition-colors hover:bg-emerald-800 disabled:opacity-50"
        >
          {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
          Aprobar el pago
        </button>
        <button
          onClick={() => setAsking((open) => !open)}
          disabled={pending}
          className="inline-flex h-9 items-center gap-2 rounded-lg border border-stone-300 bg-white px-4 text-sm font-medium text-stone-600 transition-colors hover:bg-stone-50 disabled:opacity-50"
        >
          <X className="h-4 w-4" />
          Rechazar
        </button>
      </div>

      {asking && (
        <div className="space-y-2 rounded-lg border border-stone-200 bg-stone-50 p-3">
          <label htmlFor="motivo" className="text-sm font-medium text-stone-900">
            ¿Por qué se rechaza?
          </label>
          <textarea
            id="motivo"
            value={notes}
            onChange={(event) => setNotes(event.target.value)}
            rows={2}
            placeholder="El comprobante es de otra operación, el monto no coincide…"
            className="w-full rounded-md border border-stone-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
          />
          <button
            onClick={() => decide('rechazado', notes)}
            disabled={pending || !notes.trim()}
            className="inline-flex h-9 items-center gap-2 rounded-lg bg-rose-600 px-4 text-sm font-medium text-white transition-colors hover:bg-rose-700 disabled:opacity-50"
          >
            {pending && <Loader2 className="h-4 w-4 animate-spin" />}
            Confirmar el rechazo
          </button>
        </div>
      )}

      {error && <p className="text-sm text-rose-600">{error}</p>}
    </div>
  );
}

/** Convierte la contratación en ficha de cliente y lleva a la ficha nueva. */
export function ConvertToClient({ id }: { id: string }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  return (
    <div>
      <button
        onClick={() =>
          startTransition(async () => {
            const result = await convertSignupToClient(id);
            if (!result.success) setError(result.error || 'No se pudo crear el cliente.');
            else if (result.clientId) router.push(`/clientes/${result.clientId}`);
          })
        }
        disabled={pending}
        className="inline-flex h-9 items-center gap-2 rounded-lg bg-brand-800 px-4 text-sm font-medium text-white transition-colors hover:bg-brand-900 disabled:opacity-50"
      >
        {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : <UserPlus className="h-4 w-4" />}
        Crear la ficha de cliente
      </button>
      {error && <p className="mt-2 text-sm text-rose-600">{error}</p>}
    </div>
  );
}

/**
 * Abre el comprobante.
 *
 * La URL se pide al hacer clic y no al dibujar la página: dura diez minutos, y
 * si se generara al cargar el listado ya estaría vencida para cuando alguien se
 * decide a mirarla.
 */
export function ReceiptLink({ path, className }: { path: string; className?: string }) {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState(false);

  const open = async () => {
    setPending(true);
    setError(false);
    const url = await getReceiptUrl(path);
    setPending(false);

    if (!url) {
      setError(true);
      return;
    }
    window.open(url, '_blank', 'noopener');
  };

  return (
    <div>
      <button
        onClick={open}
        disabled={pending}
        className={cn(
          'inline-flex h-9 items-center gap-2 rounded-lg border border-stone-300 bg-white px-4 text-sm font-medium text-stone-700 transition-colors hover:bg-stone-50 disabled:opacity-50',
          className
        )}
      >
        {pending ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : (
          <ExternalLink className="h-4 w-4" />
        )}
        Ver el comprobante
      </button>
      {error && <p className="mt-2 text-sm text-rose-600">No se pudo abrir el archivo.</p>}
    </div>
  );
}
