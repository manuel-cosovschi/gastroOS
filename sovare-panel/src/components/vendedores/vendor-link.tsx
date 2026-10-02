'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Check, Copy, ExternalLink, Loader2, MessageCircle, RefreshCw } from 'lucide-react';
import { toast } from 'sonner';
import { regenerateVendorToken } from '@/actions/vendedores';
import { linkWhatsApp } from '@/lib/whatsapp';
import { mensajeInvitacion, vendorUrl } from '@/lib/vendedores';
import type { Vendor } from '@/types';

/**
 * El link con el que el vendedor entra a su página, y todo lo que se hace con él:
 * copiarlo, mandárselo ya escrito por WhatsApp, abrirlo, o cambiarlo.
 *
 * El link es todo lo que identifica al vendedor, no hay contraseña. Por eso está
 * "Generar uno nuevo": si el link va al chat equivocado, el que lo tiene entra
 * como él hasta que se cambie.
 */
export function VendorLink({
  vendor,
}: {
  vendor: Pick<Vendor, 'id' | 'name' | 'token' | 'whatsapp' | 'commission_pct'>;
}) {
  const router = useRouter();
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);

  const url = vendorUrl(vendor.token);
  const message = mensajeInvitacion(vendor.name, url, Number(vendor.commission_pct));
  const wa = linkWhatsApp(vendor.whatsapp, message);

  const regenerate = async () => {
    setBusy(true);
    const result = await regenerateVendorToken(vendor.id);
    setBusy(false);
    setConfirming(false);

    if (!result.success) {
      toast.error(result.error ?? 'No se pudo generar el link.');
      return;
    }
    toast.success('Listo. El link anterior ya no funciona.');
    router.refresh();
  };

  return (
    <div className="space-y-3">
      <p className="break-all rounded-md bg-stone-50 px-3 py-2 font-mono text-xs leading-relaxed text-stone-600">
        {url}
      </p>

      <div className="flex flex-wrap gap-2">
        {wa ? (
          <a
            href={wa}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex h-9 items-center gap-2 rounded-lg bg-emerald-600 px-3.5 text-sm font-medium text-white transition-colors hover:bg-emerald-700"
          >
            <MessageCircle className="h-4 w-4" />
            Mandarle el link
          </a>
        ) : null}
        <CopyButton text={url} label="Copiar link" />
        <CopyButton text={message} label="Copiar mensaje" />
        <a
          href={url}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex h-9 items-center gap-2 rounded-lg border border-stone-300 bg-white px-3 text-sm font-medium text-stone-600 transition-colors hover:bg-stone-50"
        >
          <ExternalLink className="h-4 w-4 text-stone-400" />
          Ver su página
        </a>
      </div>

      {!wa && (
        <p className="text-xs leading-relaxed text-stone-500">
          {vendor.whatsapp
            ? 'Ese número parece un fijo o no se entiende, así que no hay botón de WhatsApp. Copiá el mensaje y mandáselo como quieras.'
            : 'Cargale un WhatsApp en sus datos y acá aparece el botón para mandarle el link ya escrito.'}
        </p>
      )}

      <div className="border-t border-stone-100 pt-3">
        {!confirming ? (
          <button
            type="button"
            onClick={() => setConfirming(true)}
            className="inline-flex items-center gap-1.5 text-xs text-stone-500 transition-colors hover:text-stone-900"
          >
            <RefreshCw className="h-3.5 w-3.5" />
            Generar un link nuevo
          </button>
        ) : (
          <div className="space-y-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2.5">
            <p className="text-xs leading-relaxed text-stone-700">
              El link actual deja de funcionar ahora mismo y hay que mandarle el nuevo. Su saldo y
              sus clientes no cambian.
            </p>
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={regenerate}
                disabled={busy}
                className="inline-flex h-8 items-center gap-1.5 rounded-md bg-stone-900 px-3 text-xs font-medium text-white disabled:opacity-60"
              >
                {busy && <Loader2 className="h-3 w-3 animate-spin" />}
                Sí, generar uno nuevo
              </button>
              <button
                type="button"
                onClick={() => setConfirming(false)}
                className="text-xs text-stone-500 hover:text-stone-800"
              >
                Cancelar
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function CopyButton({ text, label }: { text: string; label: string }) {
  const [copied, setCopied] = useState(false);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Sin permiso de portapapeles no hay nada que hacer desde acá: el texto
      // está a la vista y se puede seleccionar a mano.
      setCopied(false);
    }
  };

  return (
    <button
      type="button"
      onClick={copy}
      className="inline-flex h-9 items-center gap-2 rounded-lg border border-stone-300 bg-white px-3 text-sm font-medium text-stone-600 transition-colors hover:bg-stone-50"
    >
      {copied ? (
        <Check className="h-4 w-4 text-emerald-600" />
      ) : (
        <Copy className="h-4 w-4 text-stone-400" />
      )}
      {copied ? 'Copiado' : label}
    </button>
  );
}
