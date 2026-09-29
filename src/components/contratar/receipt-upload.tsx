'use client';

import { useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { FileUp, Loader2, Upload } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { uploadReceipt } from '@/actions/signups';

const ACCEPT = 'image/jpeg,image/png,image/webp,image/heic,application/pdf';

/**
 * Subida del comprobante.
 *
 * El aviso de que una captura se verifica sola y un PDF lo mira una persona no
 * es un detalle técnico de más: es la diferencia entre esperar diez segundos y
 * esperar medio día, y quien está transfiriendo tiene derecho a saberlo antes
 * de elegir el archivo.
 */
export function ReceiptUpload({ token, replacing }: { token: string; replacing?: boolean }) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [fileName, setFileName] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  const onSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const file = form.get('receipt');
    if (!(file instanceof File) || file.size === 0) {
      toast.error('Elegí el archivo del comprobante.');
      return;
    }

    setPending(true);
    const result = await uploadReceipt(token, form);
    setPending(false);

    if (!result.success) {
      toast.error(result.error);
      return;
    }

    toast.success(result.data.message, { duration: 8000 });
    setFileName(null);
    if (inputRef.current) inputRef.current.value = '';
    router.refresh();
  };

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <label
        htmlFor="receipt"
        className="flex cursor-pointer flex-col items-center gap-2 rounded-xl border-2 border-dashed border-stone-300 bg-stone-50 px-4 py-8 text-center transition-colors hover:border-brand-400 hover:bg-brand-50/40"
      >
        <FileUp className="h-7 w-7 text-stone-400" />
        <span className="text-sm font-medium text-stone-900">
          {fileName || 'Elegí el comprobante'}
        </span>
        <span className="text-xs text-stone-500">
          Captura de pantalla o PDF, hasta 8 MB
        </span>
        <input
          ref={inputRef}
          id="receipt"
          name="receipt"
          type="file"
          accept={ACCEPT}
          className="sr-only"
          onChange={(event) => setFileName(event.target.files?.[0]?.name || null)}
        />
      </label>

      <p className="text-xs leading-relaxed text-stone-500">
        Si subís una captura del comprobante la verificamos en el momento y queda confirmado al
        instante. Un PDF lo revisa una persona, así que puede tardar unas horas.
      </p>

      <Button type="submit" size="lg" disabled={pending} className="w-full">
        {pending ? (
          <>
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            Verificando el comprobante…
          </>
        ) : (
          <>
            <Upload className="mr-2 h-4 w-4" />
            {replacing ? 'Subir otro comprobante' : 'Subir el comprobante'}
          </>
        )}
      </Button>
    </form>
  );
}
