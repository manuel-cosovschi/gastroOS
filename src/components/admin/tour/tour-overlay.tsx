'use client';

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { ArrowLeft, ArrowRight, Lightbulb, Loader2, MessageCircle, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { WHATSAPP_URL } from '@/lib/marketing';
import { useTour } from '@/components/admin/tour/tour-provider';

/**
 * La visita guiada dibujada en pantalla.
 *
 * El recuadro iluminado y la penumbra son un solo elemento: un `div` del
 * tamaño del objetivo con una sombra enorme. Es un truco viejo y sirve para
 * lo que hay que hacer acá — un agujero de bordes redondeados que sigue al
 * elemento cuando la página se mueve — sin recortes SVG ni cuatro paneles
 * calculados a mano.
 *
 * Ese elemento no recibe clics. El que los bloquea es una capa transparente
 * aparte: así, mientras la guía señala algo, nada de lo que hay debajo se
 * dispara por accidente. En los pasos de tipo `page` esa capa no se monta y
 * la pantalla queda entera para tocar.
 */

const CARD_WIDTH = 360;
const GAP = 14;
const MARGIN = 16;
const HOLE_PADDING = 8;
/** Alto estimado de la tarjeta hasta que se mide de verdad. Evita el salto inicial. */
const CARD_HEIGHT_GUESS = 250;
/**
 * Porción de la pantalla que la tarjeta puede ocupar en mobile, donde va
 * anclada abajo. El resto es la franja en la que tiene que quedar lo que la
 * guía está señalando: sin este tope la tarjeta tapaba justo eso.
 */
const COMPACT_CARD_SHARE = 0.52;

type Status = 'looking' | 'found' | 'missing';

interface Rect {
  top: number;
  left: number;
  width: number;
  height: number;
}

/**
 * Deja el elemento a la vista y devuelve su recuadro.
 *
 * `band` es la franja de pantalla que queda libre cuando la tarjeta va anclada
 * abajo (mobile). Con ella, en vez del `scrollIntoView` centrado se calcula el
 * scroll a mano: lo que se está señalando tiene que terminar arriba de la
 * tarjeta, no debajo. Si el elemento es más alto que la franja se alinea por
 * arriba, que es la parte que importa.
 */
function useTargetRect(
  selector: string | undefined,
  key: string,
  band: { top: number; bottom: number } | null
) {
  const [rect, setRect] = useState<Rect | null>(null);
  const [status, setStatus] = useState<Status>('looking');
  const bandTop = band?.top ?? 0;
  const bandBottom = band?.bottom ?? 0;

  useEffect(() => {
    if (!selector) {
      setRect(null);
      setStatus('missing');
      return;
    }

    setStatus('looking');
    setRect(null);

    let cancelled = false;
    let element: Element | null = null;
    let attempts = 0;
    const timers: number[] = [];

    const measure = () => {
      if (cancelled || !element) return;
      const box = element.getBoundingClientRect();
      if (box.width === 0 && box.height === 0) return;
      setRect({ top: box.top, left: box.left, width: box.width, height: box.height });
    };

    const look = () => {
      if (cancelled) return;
      const found = document.querySelector(selector);

      if (found) {
        element = found;
        setStatus('found');

        if (bandBottom > bandTop) {
          const box = found.getBoundingClientRect();
          const space = bandBottom - bandTop;
          const wanted =
            box.height <= space ? bandTop + (space - box.height) / 2 : bandTop;
          window.scrollBy({ top: box.top - wanted, behavior: 'smooth' });
        } else {
          found.scrollIntoView({ block: 'center', behavior: 'smooth' });
        }

        measure();
        // Durante el scroll suave la posición cambia; se vuelve a medir al
        // final. El listener de scroll cubre el medio del camino.
        timers.push(window.setTimeout(measure, 420));
        timers.push(window.setTimeout(measure, 820));
        return;
      }

      attempts += 1;
      // Tres segundos de margen: alcanza para que termine de cargar una
      // pantalla del panel. Si no apareció, el paso sigue sin señalar nada
      // en vez de dejar al visitante mirando una penumbra vacía.
      if (attempts < 30) timers.push(window.setTimeout(look, 100));
      else setStatus('missing');
    };

    look();

    const onViewportChange = () => measure();
    window.addEventListener('scroll', onViewportChange, true);
    window.addEventListener('resize', onViewportChange);

    return () => {
      cancelled = true;
      timers.forEach(window.clearTimeout);
      window.removeEventListener('scroll', onViewportChange, true);
      window.removeEventListener('resize', onViewportChange);
    };
  }, [selector, key, bandTop, bandBottom]);

  return { rect, status };
}

/** Alto de la barra superior sticky, que no cuenta como espacio libre. */
function stickyHeaderHeight() {
  if (typeof document === 'undefined') return 0;
  const header = document.querySelector('header');
  return header ? Math.round(header.getBoundingClientRect().height) + MARGIN : MARGIN;
}

function useViewport() {
  const [size, setSize] = useState({ width: 1280, height: 800 });

  useEffect(() => {
    const read = () => setSize({ width: window.innerWidth, height: window.innerHeight });
    read();
    window.addEventListener('resize', read);
    return () => window.removeEventListener('resize', read);
  }, []);

  return size;
}

export function TourOverlay() {
  const { open, step, index, total, next, prev, stop, navigating } = useTour();
  const [mounted, setMounted] = useState(false);
  const [cardHeight, setCardHeight] = useState(CARD_HEIGHT_GUESS);
  const cardRef = useRef<HTMLDivElement>(null);

  const viewport = useViewport();
  const isCompact = viewport.width < 640;

  // En mobile la tarjeta se ancla abajo y ocupa una porción fija, así que la
  // franja libre se conoce de antemano: no hace falta esperar a medir la
  // tarjeta para saber dónde tiene que quedar lo que se está señalando. El
  // techo es la barra superior, que es sticky y taparía el recuadro.
  const band = isCompact
    ? {
        top: stickyHeaderHeight(),
        bottom: viewport.height - MARGIN - Math.round(viewport.height * COMPACT_CARD_SHARE) - GAP,
      }
    : null;

  const { rect, status } = useTargetRect(
    step?.kind === 'focus' ? step.target : undefined,
    step?.id ?? '',
    band
  );

  useEffect(() => setMounted(true), []);

  useLayoutEffect(() => {
    if (cardRef.current) setCardHeight(cardRef.current.offsetHeight);
  }, [step?.id, viewport.width]);

  const handleKey = useCallback(
    (event: KeyboardEvent) => {
      if (event.key === 'Escape') stop();
      else if (event.key === 'ArrowRight') next();
      else if (event.key === 'ArrowLeft') prev();
    },
    [next, prev, stop]
  );

  useEffect(() => {
    if (!open) return;
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [open, handleKey]);

  if (!mounted || !open || !step) return null;


  const spotlight = step.kind === 'focus' && status === 'found' && rect;
  const dimmed = step.kind !== 'page';
  const isLast = index === total - 1;

  const cardStyle = positionCard({
    rect: spotlight ? rect : null,
    kind: step.kind,
    cardHeight,
    viewport,
    isCompact,
  });

  return createPortal(
    <>
      {/* Captura los clics para que nada de abajo se dispare sin querer. */}
      {dimmed && <div className="fixed inset-0 z-[60]" aria-hidden />}

      {spotlight ? (
        <div
          aria-hidden
          className="pointer-events-none fixed z-[61] rounded-xl ring-2 ring-white/70 transition-all duration-300 ease-out"
          style={{
            top: rect.top - HOLE_PADDING,
            left: rect.left - HOLE_PADDING,
            width: rect.width + HOLE_PADDING * 2,
            height: rect.height + HOLE_PADDING * 2,
            boxShadow: '0 0 0 9999px rgba(28, 25, 23, 0.62)',
          }}
        />
      ) : (
        dimmed && <div aria-hidden className="pointer-events-none fixed inset-0 z-[61] bg-stone-900/60" />
      )}

      <div
        ref={cardRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="tour-title"
        className={cn(
          'fixed z-[62] flex flex-col rounded-2xl border border-stone-200 bg-white p-5 shadow-2xl',
          'transition-[top,left,right,bottom] duration-300 ease-out'
        )}
        style={cardStyle}
      >
        <div className="flex shrink-0 items-start justify-between gap-3">
          <div className="min-w-0">
            {/* Las pantallas del panel se arman en el servidor, así que entre
                el clic y el cambio de página pasa un momento en el que la
                tarjeta ya habla de la pantalla siguiente y abajo todavía se
                ve la anterior. El renglón lo explica en vez de dejarlo raro. */}
            <p className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-brand-700">
              {navigating ? (
                <>
                  <Loader2 className="h-3 w-3 animate-spin" />
                  Abriendo {step.chapter}…
                </>
              ) : (
                step.chapter
              )}
            </p>
            <h2 id="tour-title" className="mt-1 text-base font-semibold leading-snug text-stone-900">
              {step.title}
            </h2>
          </div>
          <button
            onClick={stop}
            aria-label="Cerrar la guía"
            className="-mr-1 -mt-1 shrink-0 rounded-lg p-1.5 text-stone-400 transition-colors hover:bg-stone-100 hover:text-stone-700"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Lo único que cede cuando no hay lugar es el texto. Los botones y el
            progreso quedan siempre visibles: una guía sin el botón "Siguiente"
            a la vista deja al visitante encerrado. */}
        <div className="min-h-0 flex-1 overflow-y-auto">
          <p className="mt-2.5 text-sm leading-relaxed text-stone-600">{step.body}</p>

          {step.tip && (
            <p className="mt-3 flex gap-2 rounded-xl bg-brand-50 px-3 py-2.5 text-[13px] leading-relaxed text-brand-900">
              <Lightbulb className="mt-0.5 h-4 w-4 shrink-0 text-brand-600" />
              <span>{step.tip}</span>
            </p>
          )}
        </div>

        <div className="mt-4 flex shrink-0 items-center gap-1" aria-hidden>
          {Array.from({ length: total }, (_, position) => (
            <span
              key={position}
              className={cn(
                'h-1 flex-1 rounded-full transition-colors',
                position <= index ? 'bg-brand-600' : 'bg-stone-200'
              )}
            />
          ))}
        </div>

        <div className="mt-4 flex shrink-0 items-center justify-between gap-3">
          <span className="text-xs tabular-nums text-stone-400">
            Paso {index + 1} de {total}
          </span>

          <div className="flex items-center gap-2">
            {index > 0 && (
              <button
                onClick={prev}
                className="inline-flex h-9 items-center gap-1.5 rounded-lg px-3 text-sm font-medium text-stone-600 transition-colors hover:bg-stone-100"
              >
                <ArrowLeft className="h-4 w-4" />
                Anterior
              </button>
            )}
            <button
              onClick={next}
              className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-brand-700 px-4 text-sm font-medium text-white shadow-sm transition-colors hover:bg-brand-800"
            >
              {isLast ? 'Empezar a probar' : 'Siguiente'}
              {!isLast && <ArrowRight className="h-4 w-4" />}
            </button>
          </div>
        </div>

        <div className="mt-3 flex shrink-0 flex-wrap items-center justify-between gap-2 border-t border-stone-100 pt-3">
          <button
            onClick={stop}
            className="text-xs text-stone-400 underline-offset-2 transition-colors hover:text-stone-600 hover:underline"
          >
            Saltar la guía
          </button>
          {WHATSAPP_URL && (
            <a
              href={WHATSAPP_URL}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1.5 text-xs font-medium text-brand-700 transition-colors hover:text-brand-800"
            >
              <MessageCircle className="h-3.5 w-3.5" />
              ¿Dudas? Escribinos
            </a>
          )}
        </div>
      </div>
    </>,
    document.body
  );
}

/**
 * Dónde va la tarjeta y cuánto puede medir de alto.
 *
 * El alto importa tanto como la posición: si el elemento iluminado ocupa media
 * pantalla, no hay lugar donde la tarjeta entre entera y hay que elegir entre
 * taparlo o recortarla. Se recorta —con el cuerpo scrolleable y los botones
 * fijos— porque tapar justo lo que se está señalando es lo peor que puede
 * hacer una guía.
 *
 * En pantallas chicas se ancla abajo y se termina la discusión: cualquier
 * cálculo fino contra un elemento iluminado termina tapándolo.
 */
function positionCard({
  rect,
  kind,
  cardHeight,
  viewport,
  isCompact,
}: {
  rect: Rect | null;
  kind: string;
  cardHeight: number;
  viewport: { width: number; height: number };
  isCompact: boolean;
}): React.CSSProperties {
  const fullHeight = viewport.height - MARGIN * 2;

  if (isCompact) {
    return {
      left: MARGIN,
      right: MARGIN,
      bottom: MARGIN,
      width: 'auto',
      maxHeight: Math.min(fullHeight, Math.round(viewport.height * COMPACT_CARD_SHARE)),
    };
  }

  if (kind === 'center') {
    return {
      width: CARD_WIDTH,
      left: (viewport.width - CARD_WIDTH) / 2,
      top: Math.max(MARGIN, (viewport.height - Math.min(cardHeight, fullHeight)) / 2),
      maxHeight: fullHeight,
    };
  }

  if (!rect) {
    return { width: CARD_WIDTH, right: 24, bottom: 24, maxHeight: fullHeight };
  }

  const clampLeft = (value: number) =>
    Math.min(Math.max(value, MARGIN), viewport.width - CARD_WIDTH - MARGIN);
  const clampTop = (value: number) =>
    Math.min(Math.max(value, MARGIN), viewport.height - Math.min(cardHeight, fullHeight) - MARGIN);

  // Aire libre a cada lado del elemento iluminado, ya descontados la
  // separación con el recuadro y el margen contra el borde de la pantalla.
  const roomBelow = viewport.height - (rect.top + rect.height) - GAP - MARGIN;
  const roomAbove = rect.top - GAP - MARGIN;
  const roomRight = viewport.width - (rect.left + rect.width) - GAP - MARGIN;
  const roomLeft = rect.left - GAP - MARGIN;

  if (cardHeight <= roomBelow) {
    return {
      width: CARD_WIDTH,
      top: rect.top + rect.height + GAP,
      left: clampLeft(rect.left),
      maxHeight: roomBelow,
    };
  }

  if (cardHeight <= roomAbove) {
    return {
      width: CARD_WIDTH,
      top: rect.top - GAP - cardHeight,
      left: clampLeft(rect.left),
      maxHeight: roomAbove,
    };
  }

  if (CARD_WIDTH <= roomRight) {
    return {
      width: CARD_WIDTH,
      top: clampTop(rect.top),
      left: rect.left + rect.width + GAP,
      maxHeight: fullHeight,
    };
  }

  if (CARD_WIDTH <= roomLeft) {
    return {
      width: CARD_WIDTH,
      top: clampTop(rect.top),
      left: rect.left - GAP - CARD_WIDTH,
      maxHeight: fullHeight,
    };
  }

  // El elemento iluminado ocupa casi toda la pantalla: la tarjeta va del lado
  // con más aire, recortada a ese aire.
  const useBelow = roomBelow >= roomAbove;
  const room = Math.max(useBelow ? roomBelow : roomAbove, 180);
  return {
    width: CARD_WIDTH,
    left: clampLeft(rect.left),
    top: useBelow ? viewport.height - room - MARGIN : MARGIN,
    maxHeight: room,
  };
}
