'use client';

import { useState, useTransition } from 'react';
import { Loader2, RotateCcw } from 'lucide-react';
import { resetDemo } from '@/actions/demo';

/**
 * Volver a los datos de ejemplo.
 *
 * La guía invita a romper cosas —"cargá un pedido, cambiá un precio, borrá
 * algo"— y hace falta la puerta de vuelta. Sin esto, el que borra el catálogo
 * para ver qué pasa se queda con una demo vacía y sin forma de recuperarla.
 *
 * Pregunta antes porque tira todo lo que la persona hizo, y eso puede ser
 * media hora de haber estado probando el sistema en serio.
 */
export function ResetDemoButton() {
  const [pending, startTransition] = useTransition();
  const [confirming, setConfirming] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (error) {
    return (
      <span className="inline-flex items-center gap-2">
        <span className="opacity-90">{error}</span>
        <button
          onClick={() => {
            setError(null);
            setConfirming(false);
          }}
          className="underline underline-offset-2"
        >
          Cerrar
        </button>
      </span>
    );
  }

  if (pending) {
    return (
      <span className="inline-flex items-center gap-1.5 opacity-90">
        <Loader2 className="h-3 w-3 animate-spin" />
        Reiniciando…
      </span>
    );
  }

  if (confirming) {
    return (
      <span className="inline-flex items-center gap-2">
        <span className="opacity-90">¿Volver a los datos de ejemplo?</span>
        <button
          onClick={() =>
            startTransition(async () => {
              // Si sale bien no vuelve: la acción redirige al panel.
              const result = await resetDemo();
              if (result?.error) setError(result.error);
            })
          }
          className="rounded bg-white/20 px-2 py-0.5 font-semibold underline-offset-2 hover:bg-white/30"
        >
          Sí, reiniciar
        </button>
        <button
          onClick={() => setConfirming(false)}
          className="underline underline-offset-2 opacity-80 hover:opacity-100"
        >
          Cancelar
        </button>
      </span>
    );
  }

  return (
    <button
      onClick={() => setConfirming(true)}
      className="inline-flex items-center gap-1.5 underline underline-offset-2"
    >
      <RotateCcw className="h-3 w-3" />
      Reiniciar la demo
    </button>
  );
}
