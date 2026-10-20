'use client';

import { useEffect, useRef, useState } from 'react';
import { ArrowRight } from 'lucide-react';
import { BOTON } from '@/lib/comercial/tema';
import { cn } from '@/lib/utils';
import { VIDEOS } from './videos.generado';

/**
 * Un video del sistema andando, y la demo de verdad embebida.
 *
 * Son componentes de cliente porque los dos necesitan algo que sólo se sabe en
 * el navegador: uno, si la persona pidió que las cosas no se muevan; el otro, si
 * ya tocó el botón. Todo lo demás de la página lo arma el servidor.
 */

/**
 * El video, en bucle y sin sonido. Tres cosas lo hacen inofensivo:
 *
 *   1. **`preload="none"` y póster.** El archivo no se baja hasta que el video
 *      entra en pantalla; mientras tanto se ve el primer cuadro. Un video que se
 *      baja al abrir la página le cuesta casi un mega a alguien que quizás nunca
 *      llega hasta él.
 *   2. **Arranca cuando se ve y se frena cuando deja de verse.** Un video en
 *      bucle fuera de pantalla gasta batería para nadie.
 *   3. **Con `prefers-reduced-motion` no arranca solo**: quedan el póster y los
 *      controles, para quien lo quiera ver igual. Hay gente a la que el
 *      movimiento le da náuseas.
 *
 * `muted` + `playsInline` no son decoración: sin los dos, un iPhone no
 * reproduce un video solo, y quedaría un cuadro quieto sin que nada falle.
 */
export function Video({ cual }: { cual: keyof typeof VIDEOS }) {
  const v = VIDEOS[cual];
  const ref = useRef<HTMLVideoElement>(null);
  const [quieto, setQuieto] = useState(false);

  useEffect(() => {
    const video = ref.current;
    if (!video) return;

    const sinMovimiento = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    setQuieto(sinMovimiento);
    if (sinMovimiento || typeof IntersectionObserver === 'undefined') return;

    const observador = new IntersectionObserver(
      (entradas) => {
        for (const e of entradas) {
          if (e.isIntersecting) video.play().catch(() => {});
          else video.pause();
        }
      },
      { threshold: 0.25 }
    );
    observador.observe(video);
    return () => observador.disconnect();
  }, []);

  return (
    <video
      ref={ref}
      width={v.ancho}
      height={v.alto}
      poster={v.poster}
      preload="none"
      muted
      loop
      playsInline
      controls={quieto}
      aria-label={v.que}
      className="h-auto w-full"
    >
      {/* El mp4 va primero: es el que anda en todos lados. */}
      <source src={v.mp4} type="video/mp4" />
      <source src={v.webm} type="video/webm" />
    </video>
  );
}

/**
 * La demo de verdad, adentro de la página.
 *
 * Hasta que no la tocan es un botón: un `iframe` que arranca con la página
 * carga un sistema entero —y arma una copia de la demo del otro lado— para
 * alguien que a lo mejor nunca llega a esta sección.
 *
 * Lo que aparece al tocarlo no es una simulación: es la misma pantalla de
 * entrada que se abre en otra pestaña, con la misma demo. El que entra recibe
 * su copia propia, igual que si hubiera venido por el botón de arriba.
 *
 * El enlace de «abrirla en otra pestaña» queda igual al lado, porque un panel
 * en 360 píxeles es incómodo y porque hay gente que no confía en algo embebido
 * —y tiene razón en no confiar—.
 */
export function DemoEmbebida({ direccion }: { direccion: string }) {
  const [prendida, setPrendida] = useState(false);

  return prendida ? (
    <iframe
      src={direccion}
      title="La demo de GastroOS, en vivo"
      className="h-[640px] w-full border-0 bg-stone-50"
    />
  ) : (
    <button
      type="button"
      onClick={() => setPrendida(true)}
      className="flex h-[640px] w-full flex-col items-center justify-center gap-4 bg-white/[0.02] px-6 text-center transition-colors hover:bg-white/[0.05]"
    >
      <span className={cn('inline-flex items-center gap-2 rounded-xl px-5 py-3 text-[15px] font-bold', BOTON.principal)}>
        Probar la demo acá
        <ArrowRight className="h-4 w-4" aria-hidden />
      </span>
      <span className="max-w-xs text-sm leading-relaxed text-stone-300">
        Se abre el sistema de verdad, con una pastelería de ejemplo cargada. Es tu
        copia: cambiá lo que quieras, nadie más la ve.
      </span>
    </button>
  );
}
