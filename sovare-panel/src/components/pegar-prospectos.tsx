'use client';

import { useEffect, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { ChevronDown, ClipboardPaste, Loader2, Trash2 } from 'lucide-react';
import { descartarProspecto, importarProspectos } from '@/actions/prospeccion';
import { cn } from '@/lib/utils';

/**
 * Pegar de una vez los prospectos que dejó escritos la tarea diaria.
 *
 * Arranca cerrado: esto se usa una vez al día y la pantalla es para escribirle a
 * la gente, no para cargar. Abierto ocuparía el lugar del primer prospecto, que
 * es lo que uno viene a ver.
 *
 * El resultado se queda en pantalla hasta que se cierra a mano. Importa más de lo
 * que parece: lo que se descartó por repetido o por venir incompleto es
 * justamente lo que hay que leer, y un cartel que se va solo a los tres segundos
 * se pierde.
 */
export function PegarProspectos() {
  const router = useRouter();
  const [abierto, setAbierto] = useState(false);
  const [texto, setTexto] = useState('');
  const [pendiente, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [resultado, setResultado] = useState<{
    cargados: number;
    repetidos: string[];
    rechazados: { nombre: string; motivo: string }[];
  } | null>(null);

  const cargar = () => {
    setError(null);
    setResultado(null);
    startTransition(async () => {
      const r = await importarProspectos(texto);
      if (!r.success) {
        setError(r.error || 'No se pudo cargar.');
        return;
      }
      setResultado({
        cargados: r.cargados ?? 0,
        repetidos: r.repetidos ?? [],
        rechazados: r.rechazados ?? [],
      });
      // Sólo se limpia lo que entró: si quedó algo afuera, el texto sigue ahí
      // para corregirlo y volver a intentar.
      if ((r.rechazados ?? []).length === 0) setTexto('');
      router.refresh();
    });
  };

  return (
    <div className="rounded-xl border border-stone-200 bg-white">
      <button
        onClick={() => setAbierto((v) => !v)}
        className="flex w-full items-center gap-2 px-4 py-3 text-left text-sm font-medium text-stone-700 transition-colors hover:bg-stone-50"
      >
        <ClipboardPaste className="h-4 w-4 text-stone-400" />
        Pegar los prospectos de la tarea diaria
        <ChevronDown
          className={cn('ml-auto h-4 w-4 text-stone-400 transition-transform', abierto && 'rotate-180')}
        />
      </button>

      {abierto && (
        <div className="space-y-3 border-t border-stone-100 px-4 py-4">
          <p className="text-sm leading-relaxed text-stone-500">
            Pegá acá el bloque que deja la tarea al final de su mensaje. Podés pegar el mensaje
            entero: se busca solo la parte que importa. Los que ya estén cargados se saltean.
          </p>

          <textarea
            value={texto}
            onChange={(event) => setTexto(event.target.value)}
            rows={8}
            spellCheck={false}
            placeholder={'[\n  { "business_name": "…", "city": "…", "whatsapp": "…", "outreach_message": "…" }\n]'}
            className="w-full rounded-lg border border-stone-300 bg-white px-3 py-2 font-mono text-xs text-stone-800 placeholder:text-stone-300 focus:border-brand-700 focus:outline-none"
          />

          <div className="flex items-center gap-3">
            <button
              onClick={cargar}
              disabled={pendiente || !texto.trim()}
              className="inline-flex h-9 items-center gap-2 rounded-lg bg-brand-800 px-4 text-sm font-medium text-white transition-colors hover:bg-brand-900 disabled:opacity-50"
            >
              {pendiente && <Loader2 className="h-4 w-4 animate-spin" />}
              Cargar
            </button>
            {(resultado || error) && (
              <button
                onClick={() => {
                  setResultado(null);
                  setError(null);
                }}
                className="text-sm text-stone-500 underline"
              >
                Listo
              </button>
            )}
          </div>

          {error && <p className="text-sm text-rose-600">{error}</p>}

          {resultado && (
            <div className="space-y-2 rounded-lg border border-stone-200 bg-stone-50 px-3 py-3 text-sm">
              <p className="font-medium text-stone-800">
                {resultado.cargados === 0
                  ? 'No entró ninguno nuevo.'
                  : `Entraron ${resultado.cargados}.`}
              </p>

              {resultado.repetidos.length > 0 && (
                <p className="text-stone-600">
                  Ya estaban, no se cargaron de nuevo: {resultado.repetidos.join(', ')}.
                </p>
              )}

              {resultado.rechazados.length > 0 && (
                <div className="text-stone-600">
                  <p>Quedaron afuera:</p>
                  <ul className="mt-1 space-y-0.5 pl-4">
                    {resultado.rechazados.map((fila, i) => (
                      <li key={i} className="list-disc">
                        {fila.nombre} — {fila.motivo}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

/**
 * Sacar un prospecto que no corresponde.
 *
 * Pide confirmación en el mismo botón en vez de abrir un cartel: son dos clics
 * igual, pero sin tapar la pantalla, y el segundo clic cae donde ya estaba el
 * dedo. Se arrepiente tocando afuera o esperando: vuelve solo a los cuatro
 * segundos, que es lo que tarda alguien en darse cuenta de que no era ese.
 */
export function DescartarProspecto({ id, nombre }: { id: string; nombre: string }) {
  const router = useRouter();
  const [confirmando, setConfirmando] = useState(false);
  const [pendiente, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!confirmando) return;
    const t = setTimeout(() => setConfirmando(false), 4000);
    return () => clearTimeout(t);
  }, [confirmando]);

  const borrar = () => {
    startTransition(async () => {
      const r = await descartarProspecto(id);
      setConfirmando(false);
      if (!r.success) setError(r.error || 'No se pudo borrar.');
      else router.refresh();
    });
  };

  if (error) {
    return (
      <span className="text-xs text-rose-600" title={error}>
        {error}
      </span>
    );
  }

  return (
    <button
      onClick={() => (confirmando ? borrar() : setConfirmando(true))}
      disabled={pendiente}
      title={confirmando ? `Confirmar que se borra ${nombre}` : `Sacar ${nombre} de la lista`}
      className={cn(
        'inline-flex h-8 items-center gap-1.5 rounded-lg px-2.5 text-xs font-medium transition-colors disabled:opacity-50',
        confirmando
          ? 'bg-rose-600 text-white hover:bg-rose-700'
          : 'text-stone-400 hover:bg-stone-100 hover:text-stone-600'
      )}
    >
      {pendiente ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />}
      {confirmando && 'Confirmar'}
    </button>
  );
}
