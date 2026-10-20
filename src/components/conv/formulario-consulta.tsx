'use client';

import { useRef, useState } from 'react';
import { ArrowRight, Check, Loader2 } from 'lucide-react';
import { enviarConsulta, type ResultadoConsulta } from '@/actions/conv';
import { TIPOS_DE_CONSULTA } from '@/lib/conv/consulta';
import { capturarAtribucion } from '@/lib/conv/atribucion';
import { rastrear } from '@/lib/conv/eventos';
import { BOTON, TARJETA } from '@/lib/comercial/tema';
import { cn } from '@/lib/utils';

/**
 * El formulario corto: cuatro datos, y el mensaje es opcional.
 *
 * El evento `Lead` sale **después** de que el servidor confirmó que guardó la
 * consulta, con el mismo `eventId` que mandó el servidor a Meta. Si el servidor
 * falló, no sale nada: un lead que no existe no se cuenta.
 */

const CAMPO =
  'mt-1.5 block w-full rounded-xl border border-white/15 bg-stone-950/60 px-4 py-3 text-base text-stone-50 placeholder:text-stone-400 focus:border-brand-400 focus:outline-none focus:ring-2 focus:ring-brand-400/30';

export function FormularioConsulta({ producto }: { producto: string }) {
  const [estado, setEstado] = useState<'listo' | 'enviando' | 'enviado'>('listo');
  const [error, setError] = useState<Extract<ResultadoConsulta, { ok: false }> | null>(null);
  const formRef = useRef<HTMLFormElement>(null);

  async function alEnviar(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (estado === 'enviando') return;
    setEstado('enviando');
    setError(null);
    try {
      const r = await enviarConsulta(new FormData(e.currentTarget));
      if (r.ok) {
        rastrear('Lead', { producto, atribucion: capturarAtribucion(), eventId: r.eventId });
        setEstado('enviado');
      } else {
        setError(r);
        setEstado('listo');
      }
    } catch {
      setError({ ok: false, error: 'Se cortó la conexión. Tus datos siguen acá: probá de nuevo.' });
      setEstado('listo');
    }
  }

  if (estado === 'enviado') {
    return (
      <div className={cn(TARJETA, 'p-8 text-center')} role="status">
        <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-brand-400/15">
          <Check className="h-6 w-6 text-brand-400" aria-hidden />
        </span>
        <p className="mt-4 text-lg font-bold text-stone-50">Recibimos tu consulta</p>
        <p className="mt-2 text-sm leading-relaxed text-stone-300">
          Te escribimos nosotros, una persona, por el medio que dejaste. Mientras tanto podés{' '}
          <a href="/login" className="underline underline-offset-2 hover:text-stone-50" data-conv-evento="Demo">
            entrar a la demo
          </a>
          .
        </p>
      </div>
    );
  }

  return (
    <form ref={formRef} onSubmit={alEnviar} className={cn(TARJETA, 'space-y-4 p-6')} noValidate>
      <div className="grid gap-4 sm:grid-cols-2">
        <label className="block text-sm font-semibold text-stone-100">
          Tu nombre
          <input name="nombre" autoComplete="name" required className={CAMPO} aria-invalid={error?.campo === 'nombre'} />
        </label>
        <label className="block text-sm font-semibold text-stone-100">
          Tu negocio
          <input name="negocio" autoComplete="organization" required className={CAMPO} placeholder="Ej.: Pastelería Lola" aria-invalid={error?.campo === 'negocio'} />
        </label>
      </div>
      <label className="block text-sm font-semibold text-stone-100">
        WhatsApp o mail
        <input name="contacto" autoComplete="tel" required className={CAMPO} placeholder="11 5555 5555 o vos@mail.com" aria-invalid={error?.campo === 'contacto'} />
      </label>
      <label className="block text-sm font-semibold text-stone-100">
        ¿Qué necesitás?
        <select name="tipo" className={CAMPO} defaultValue="demo">
          {Object.entries(TIPOS_DE_CONSULTA).map(([v, t]) => (
            <option key={v} value={v}>
              {t}
            </option>
          ))}
        </select>
      </label>
      <label className="block text-sm font-semibold text-stone-100">
        Contanos algo más <span className="font-normal text-stone-300">(opcional)</span>
        <textarea name="mensaje" rows={3} className={CAMPO} placeholder="Qué vendés, cuántos pedidos por semana…" />
      </label>
      {/* La trampa para robots: fuera de la pantalla y fuera del orden del teclado. */}
      <input name="sitio_web" tabIndex={-1} autoComplete="off" aria-hidden className="absolute -left-[9999px] h-0 w-0 opacity-0" />

      {error && (
        <p role="alert" className="rounded-xl border border-brand-400/40 bg-brand-400/10 px-4 py-3 text-sm text-stone-50">
          {error.error}
        </p>
      )}

      <button
        type="submit"
        disabled={estado === 'enviando'}
        className={cn('inline-flex w-full items-center justify-center gap-2 rounded-xl px-6 py-3.5 text-[15px] font-bold transition-colors disabled:opacity-70', BOTON.principal)}
      >
        {estado === 'enviando' ? (
          <>
            <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> Enviando…
          </>
        ) : (
          <>
            Quiero que me escriban <ArrowRight className="h-4 w-4" aria-hidden />
          </>
        )}
      </button>
      <p className="text-xs leading-relaxed text-stone-300">
        Usamos estos datos sólo para contestarte. No los compartimos ni te sumamos a ninguna lista.{' '}
        <a href="/privacidad" className="underline underline-offset-2">Privacidad</a>.
      </p>
    </form>
  );
}
