'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Loader2, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { deleteVendor } from '@/actions/vendedores';

/**
 * Eliminar un vendedor que no cargó nada.
 *
 * La página sólo lo ofrece cuando está vacío. Aun así la acción vuelve a
 * comprobarlo, y la base lo impide: una pantalla desactualizada no puede borrar
 * a alguien con plata de por medio.
 */
export function DeleteVendor({ vendorId, name }: { vendorId: string; name: string }) {
  const router = useRouter();
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);

  const remove = async () => {
    setBusy(true);
    const result = await deleteVendor(vendorId);
    setBusy(false);

    if (!result.success) {
      toast.error(result.error ?? 'No se pudo eliminar.');
      setConfirming(false);
      return;
    }
    toast.success('Vendedor eliminado.');
    router.push('/vendedores');
    router.refresh();
  };

  if (!confirming) {
    return (
      <button
        type="button"
        onClick={() => setConfirming(true)}
        className="inline-flex h-9 items-center gap-2 rounded-lg border border-stone-300 px-3 text-sm text-stone-500 transition-colors hover:border-rose-300 hover:text-rose-600"
      >
        <Trash2 className="h-4 w-4" />
        Eliminar vendedor
      </button>
    );
  }

  return (
    <div className="flex flex-wrap items-center gap-2 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2">
      <span className="text-xs text-rose-800">
        Se elimina a {name} y su link deja de funcionar. ¿Seguro?
      </span>
      <button
        type="button"
        onClick={remove}
        disabled={busy}
        className="inline-flex h-7 items-center gap-1.5 rounded-md bg-rose-600 px-2.5 text-xs font-medium text-white disabled:opacity-60"
      >
        {busy && <Loader2 className="h-3 w-3 animate-spin" />}
        Sí, eliminar
      </button>
      <button
        type="button"
        onClick={() => setConfirming(false)}
        className="text-xs text-stone-500 hover:text-stone-800"
      >
        No
      </button>
    </div>
  );
}
