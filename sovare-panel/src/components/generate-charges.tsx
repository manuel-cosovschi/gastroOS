'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Loader2, Receipt } from 'lucide-react';
import { toast } from 'sonner';
import { generateMonthlyCharges } from '@/actions/clients';

export function GenerateChargesButton() {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [running, setRunning] = useState(false);

  const run = () => {
    setRunning(true);
    generateMonthlyCharges()
      .then((result) => {
        if (!result.success) {
          toast.error(result.error ?? 'No se pudieron generar los cobros.');
          return;
        }
        if (!result.created) {
          toast.info('Ya estaban generados: no hacía falta crear ninguno.');
          return;
        }
        toast.success(
          result.created === 1 ? 'Se generó 1 cobro.' : `Se generaron ${result.created} cobros.`
        );
        startTransition(() => router.refresh());
      })
      .finally(() => setRunning(false));
  };

  const busy = running || pending;

  return (
    <button
      onClick={run}
      disabled={busy}
      className="inline-flex h-9 shrink-0 items-center gap-2 rounded-lg border border-stone-300 bg-white px-4 text-sm font-medium text-stone-800 transition-colors hover:bg-stone-50 disabled:opacity-60"
    >
      {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Receipt className="h-4 w-4" />}
      Generar cobros del mes
    </button>
  );
}
