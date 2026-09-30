'use client';

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import {
  ArrowLeft,
  ArrowRight,
  ChevronDown,
  ChevronUp,
  Lightbulb,
  Loader2,
  MessageCircle,
  X,
} from 'lucide-react';
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
 *
 * La tarjeta no tiene un tamaño fijo. Mide lo que mide su contenido, nunca más
 * que el aire que queda libre, y el visitante puede achicarla arrastrándola o
 * plegarla a una barra de un toque. El motivo es sencillo: una guía que tapa
 * justo lo que está explicando no explica nada, y en un teléfono eso pasa con
 * cualquier tamaño que uno elija de antemano.
 */

/** Ancho de la tarjeta en pantallas grandes: mínimo cómodo y máximo legible. */
const CARD_MIN_WIDTH = 288;
const CARD_MAX_WIDTH = 380;
const GAP = 14;
const MARGIN = 16;
const HOLE_PADDING = 8;
/** Alto estimado de la tarjeta hasta que se mide de verdad. Evita el salto inicial. */
const CARD_HEIGHT_GUESS = 240;
/**
 * Tope de pantalla que la tarjeta puede ocupar en mobile mientras el visitante
 * no diga otra cosa. Es un techo, no una altura: si el texto del paso entra en
 * menos, la tarjeta ocupa menos.
 */
const COMPACT_MAX_SHARE = 0.46;
/** Hasta dónde se puede achicar y agrandar arrastrando. */
const COMPACT_MIN_HEIGHT = 168;
const COMPACT_MAX_SHARE_LIMIT = 0.85;
/** Alto de la barra plegada. */
const COLLAPSED_HEIGHT = 60;

const VIEW_STORAGE_KEY = 'gastroos:guia:vista:v1';

interface ViewPrefs {
  /** Plegada a una barra. */
  collapsed?: boolean;
  /** Porción de pantalla elegida a mano en mobile, si la eligió. */
  share?: number;
}

function readViewPrefs(): ViewPrefs {
  try {
    const raw = window.localStorage.getItem(VIEW_STORAGE_KEY);
    return raw ? (JSON.parse(raw) as ViewPrefs) : {};
  } catch {
    return {};
  }
}

function writeViewPrefs(prefs: ViewPrefs) {
  try {
    window.localStorage.setItem(VIEW_STORAGE_KEY, JSON.stringify(prefs));
  } catch {
    // Sin almacenamiento la guía funciona igual; sólo no recuerda el tamaño.
  }
}

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
 * `band` es la franja de pantalla que queda libre al costado de la tarjeta.
 * Con ella, en vez del `scrollIntoView` centrado se calcula el scroll a mano:
 * lo que se está señalando tiene que terminar en esa franja, no debajo de la
 * tarjeta. Si el elemento es más alto que la franja se alinea por arriba, que
 * es la parte que importa.
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
          const wanted = box.height <= space ? bandTop + (space - box.height) / 2 : bandTop;
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

/**
 * Redondea a saltos de 24px.
 *
 * La franja libre sale del alto real de la tarjeta, y el alto real de la
 * tarjeta cambia un par de píxeles con cualquier cosa. Sin este redondeo, cada
 * cambio mínimo vuelve a disparar el scroll hacia el elemento señalado y la
 * pantalla queda temblando.
 */
const quantize = (value: number) => Math.round(value / 24) * 24;

export function TourOverlay() {
  const { open, step, index, total, next, prev, stop, navigating } = useTour();
  const [mounted, setMounted] = useState(false);
  const [cardHeight, setCardHeight] = useState(CARD_HEIGHT_GUESS);
  const cardRef = useRef<HTMLDivElement>(null);

  const viewport = useViewport();
  const isCompact = viewport.width < 640;

  // Preferencias de tamaño. Se leen una sola vez, ya montado: en el servidor no
  // hay `localStorage` y leerlo durante el render rompería la hidratación.
  const [collapsed, setCollapsed] = useState(false);
  const [share, setShare] = useState<number | null>(null);

  useEffect(() => {
    setMounted(true);
    const prefs = readViewPrefs();
    if (prefs.collapsed) setCollapsed(true);
    if (typeof prefs.share === 'number') setShare(prefs.share);
  }, []);

  const toggleCollapsed = useCallback(() => {
    setCollapsed((current) => {
      writeViewPrefs({ ...readViewPrefs(), collapsed: !current });
      return !current;
    });
  }, []);

  // Alto máximo que la tarjeta puede ocupar en mobile: el que eligió el
  // visitante arrastrando, o el techo por defecto.
  const compactMax = Math.round(viewport.height * (share ?? COMPACT_MAX_SHARE));

  // Arrastre del tirador. Se hace con la altura en píxeles y se guarda como
  // porción de pantalla, así sobrevive a girar el teléfono.
  const drag = useRef<{ startY: number; startHeight: number } | null>(null);
  const [dragging, setDragging] = useState(false);

  const onDragStart = (event: React.PointerEvent) => {
    if (collapsed) return;
    event.preventDefault();
    (event.target as HTMLElement).setPointerCapture?.(event.pointerId);
    drag.current = { startY: event.clientY, startHeight: cardRef.current?.offsetHeight ?? cardHeight };
    setDragging(true);
  };

  const onDragMove = (event: React.PointerEvent) => {
    if (!drag.current) return;
    // La tarjeta está anclada abajo: arrastrar hacia arriba la agranda.
    const raw = drag.current.startHeight - (event.clientY - drag.current.startY);
    const limit = Math.round(viewport.height * COMPACT_MAX_SHARE_LIMIT);
    const height = Math.min(Math.max(raw, COMPACT_MIN_HEIGHT), limit);
    setShare(height / viewport.height);
  };

  const onDragEnd = () => {
    if (!drag.current) return;
    drag.current = null;
    setDragging(false);
    setShare((current) => {
      if (current !== null) writeViewPrefs({ ...readViewPrefs(), share: current });
      return current;
    });
  };

  // La franja que le queda libre a lo que la guía señala. Sale del alto real de
  // la tarjeta y no de un porcentaje supuesto: cuando el paso es corto la
  // tarjeta ocupa poco y el elemento iluminado tiene toda la pantalla de arriba
  // para acomodarse.
  const cardFootprint = collapsed ? COLLAPSED_HEIGHT : Math.min(cardHeight, compactMax);
  const band = isCompact
    ? {
        top: quantize(stickyHeaderHeight()),
        bottom: quantize(viewport.height - MARGIN - cardFootprint - GAP),
      }
    : null;

  const { rect, status } = useTargetRect(
    step?.kind === 'focus' ? step.target : undefined,
    step?.id ?? '',
    band
  );

  useLayoutEffect(() => {
    if (cardRef.current && !collapsed) setCardHeight(cardRef.current.offsetHeight);
  }, [step?.id, viewport.width, viewport.height, collapsed, share]);

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
  // Plegada, la guía se corre del medio: ni oscurece ni bloquea. Es justamente
  // para lo que se pliega — mirar y tocar la pantalla que está explicando.
  const dimmed = step.kind !== 'page' && !collapsed;
  const isLast = index === total - 1;

  const cardStyle = positionCard({
    rect: spotlight ? rect : null,
    kind: step.kind,
    cardHeight,
    viewport,
    isCompact,
    collapsed,
    compactMax,
  });

  return createPortal(
    <>
      {/* Captura los clics para que nada de abajo se dispare sin querer. */}
      {dimmed && <div className="fixed inset-0 z-[60]" aria-hidden />}

      {spotlight ? (
        <div
          aria-hidden
          className={cn(
            'pointer-events-none fixed z-[61] rounded-xl ring-2 transition-all duration-300 ease-out',
            // Plegada no hay penumbra, así que el recuadro tiene que marcarse
            // solo: el anillo blanco se lee sobre la sombra, no sobre la página.
            collapsed ? 'ring-brand-600' : 'ring-white/70'
          )}
          style={{
            top: rect.top - HOLE_PADDING,
            left: rect.left - HOLE_PADDING,
            width: rect.width + HOLE_PADDING * 2,
            height: rect.height + HOLE_PADDING * 2,
            boxShadow: collapsed ? 'none' : '0 0 0 9999px rgba(28, 25, 23, 0.62)',
          }}
        />
      ) : (
        dimmed && (
          <div aria-hidden className="pointer-events-none fixed inset-0 z-[61] bg-stone-900/60" />
        )
      )}

      <div
        ref={cardRef}
        role="dialog"
        aria-modal={dimmed}
        aria-labelledby="tour-title"
        className={cn(
          'fixed z-[62] flex flex-col overflow-hidden rounded-2xl border border-stone-200 bg-white shadow-2xl',
          collapsed ? 'px-3 py-2' : 'p-5',
          // Mientras se arrastra no hay transición: si no, la tarjeta persigue
          // al dedo con medio segundo de retraso.
          !dragging && 'transition-[top,left,right,bottom,max-height,width] duration-300 ease-out'
        )}
        style={cardStyle}
      >
        {collapsed ? (
          <CollapsedBar
            chapter={step.chapter}
            index={index}
            total={total}
            isLast={isLast}
            navigating={navigating}
            onExpand={toggleCollapsed}
            onPrev={prev}
            onNext={next}
            onStop={stop}
          />
        ) : (
          <>
            {/* Tirador: en el teléfono la tarjeta se agranda y se achica
                arrastrándolo, que es el gesto que ya se conoce de cualquier
                panel que sube desde abajo. */}
            {isCompact && (
              <div
                onPointerDown={onDragStart}
                onPointerMove={onDragMove}
                onPointerUp={onDragEnd}
                onPointerCancel={onDragEnd}
                role="separator"
                aria-label="Arrastrá para cambiar el tamaño de la guía"
                className="-mx-5 -mt-5 mb-1 flex shrink-0 cursor-row-resize touch-none justify-center py-2.5"
              >
                <span className="h-1 w-10 rounded-full bg-stone-300" />
              </div>
            )}

            <div className="flex shrink-0 items-start justify-between gap-2">
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
                <h2
                  id="tour-title"
                  className="mt-1 text-base font-semibold leading-snug text-stone-900"
                >
                  {step.title}
                </h2>
              </div>

              <div className="-mr-1 -mt-1 flex shrink-0 items-center">
                <button
                  onClick={toggleCollapsed}
                  aria-label="Minimizar la guía para ver la pantalla"
                  title="Minimizar la guía"
                  className="rounded-lg p-1.5 text-stone-400 transition-colors hover:bg-stone-100 hover:text-stone-700"
                >
                  <ChevronDown className="h-4 w-4" />
                </button>
                <button
                  onClick={stop}
                  aria-label="Cerrar la guía"
                  className="rounded-lg p-1.5 text-stone-400 transition-colors hover:bg-stone-100 hover:text-stone-700"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            </div>

            {/* Lo único que cede cuando no hay lugar es el texto. Los botones y el
                progreso quedan siempre visibles: una guía sin el botón "Siguiente"
                a la vista deja al visitante encerrado. */}
            <ScrollableBody key={step.id}>
              <p className="mt-2.5 text-sm leading-relaxed text-stone-600">{step.body}</p>

              {step.tip && (
                <p className="mt-3 flex gap-2 rounded-xl bg-brand-50 px-3 py-2.5 text-[13px] leading-relaxed text-brand-900">
                  <Lightbulb className="mt-0.5 h-4 w-4 shrink-0 text-brand-600" />
                  <span>{step.tip}</span>
                </p>
              )}
            </ScrollableBody>

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
          </>
        )}
      </div>
    </>,
    document.body
  );
}

/**
 * El texto del paso, avisando cuando queda texto abajo.
 *
 * Sin el degradado, un párrafo recortado a mitad de renglón se lee como un
 * error de la pantalla y no como "seguí leyendo". Con él, el corte se explica
 * solo. El degradado desaparece al llegar al final, que es cuando ya no dice
 * nada.
 */
function ScrollableBody({ children }: { children: React.ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  const [hasMore, setHasMore] = useState(false);

  const check = useCallback(() => {
    const node = ref.current;
    if (!node) return;
    setHasMore(node.scrollTop + node.clientHeight < node.scrollHeight - 4);
  }, []);

  useLayoutEffect(check);

  useEffect(() => {
    window.addEventListener('resize', check);
    return () => window.removeEventListener('resize', check);
  }, [check]);

  return (
    <>
      <div ref={ref} onScroll={check} className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
        {children}
      </div>
      {/* El degradado se monta encima del final del texto con un margen
          negativo que compensa su propio alto: así se superpone sin empujar
          nada ni robarle lugar a los botones de abajo. */}
      <div
        aria-hidden
        className={cn(
          'pointer-events-none -mt-8 h-8 shrink-0 bg-gradient-to-t from-white to-transparent transition-opacity',
          hasMore ? 'opacity-100' : 'opacity-0'
        )}
      />
    </>
  );
}

/**
 * La guía plegada.
 *
 * Queda lo imprescindible para no perder el hilo —en qué paso va— y para
 * seguir avanzando sin desplegarla. Todo lo demás se corre del camino, que es
 * el punto de plegarla.
 */
function CollapsedBar({
  chapter,
  index,
  total,
  isLast,
  navigating,
  onExpand,
  onPrev,
  onNext,
  onStop,
}: {
  chapter: string;
  index: number;
  total: number;
  isLast: boolean;
  navigating: boolean;
  onExpand: () => void;
  onPrev: () => void;
  onNext: () => void;
  onStop: () => void;
}) {
  return (
    <div className="flex items-center gap-2">
      <button
        onClick={onExpand}
        title="Volver a abrir la guía"
        aria-label={`Volver a abrir la guía — ${chapter}, paso ${index + 1} de ${total}`}
        className="flex min-w-0 flex-1 items-center gap-2 rounded-lg px-1.5 py-1 text-left transition-colors hover:bg-stone-100"
      >
        <ChevronUp className="h-4 w-4 shrink-0 text-brand-700" />
        <span className="min-w-0">
          <span className="block truncate text-[13px] font-medium leading-tight text-stone-900">
            {navigating ? `Abriendo ${chapter}…` : chapter}
          </span>
          <span className="block text-[11px] leading-tight tabular-nums text-stone-400">
            Paso {index + 1} de {total}
          </span>
        </span>
      </button>

      {index > 0 && (
        <button
          onClick={onPrev}
          aria-label="Paso anterior"
          className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-stone-500 transition-colors hover:bg-stone-100"
        >
          <ArrowLeft className="h-4 w-4" />
        </button>
      )}
      <button
        onClick={onNext}
        className="inline-flex h-9 shrink-0 items-center gap-1.5 rounded-lg bg-brand-700 px-3 text-sm font-medium text-white shadow-sm transition-colors hover:bg-brand-800"
      >
        {isLast ? 'Terminar' : 'Siguiente'}
        {!isLast && <ArrowRight className="h-4 w-4" />}
      </button>
      <button
        onClick={onStop}
        aria-label="Cerrar la guía"
        className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-stone-400 transition-colors hover:bg-stone-100 hover:text-stone-700"
      >
        <X className="h-4 w-4" />
      </button>
    </div>
  );
}

/**
 * Dónde va la tarjeta y cuánto puede medir.
 *
 * El tamaño importa tanto como la posición: si el elemento iluminado ocupa
 * media pantalla, no hay lugar donde la tarjeta entre entera y hay que elegir
 * entre taparlo o recortarla. Se recorta —con el cuerpo scrolleable y los
 * botones fijos— porque tapar justo lo que se está señalando es lo peor que
 * puede hacer una guía.
 *
 * El ancho tampoco es fijo. Debajo o encima de lo iluminado la tarjeta toma el
 * ancho de ese elemento (acotado a lo legible), así se lee como parte de lo
 * que está señalando; al costado, el ancho que permita el aire que quedó.
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
  collapsed,
  compactMax,
}: {
  rect: Rect | null;
  kind: string;
  cardHeight: number;
  viewport: { width: number; height: number };
  isCompact: boolean;
  collapsed: boolean;
  compactMax: number;
}): React.CSSProperties {
  const fullHeight = viewport.height - MARGIN * 2;
  const maxWidth = Math.min(CARD_MAX_WIDTH, viewport.width - MARGIN * 2);

  if (collapsed) {
    // Plegada va siempre abajo, de lado a lado en el teléfono y contra la
    // esquina en pantallas grandes: es una barra, no una tarjeta.
    return isCompact
      ? { left: MARGIN, right: MARGIN, bottom: MARGIN, width: 'auto' }
      : { right: 24, bottom: 24, width: Math.max(maxWidth, CARD_MIN_WIDTH) };
  }

  if (isCompact) {
    return {
      left: MARGIN,
      right: MARGIN,
      bottom: MARGIN,
      width: 'auto',
      maxHeight: Math.min(fullHeight, compactMax),
    };
  }

  if (kind === 'center') {
    return {
      width: maxWidth,
      left: (viewport.width - maxWidth) / 2,
      top: Math.max(MARGIN, (viewport.height - Math.min(cardHeight, fullHeight)) / 2),
      maxHeight: fullHeight,
    };
  }

  if (!rect) {
    return { width: maxWidth, right: 24, bottom: 24, maxHeight: fullHeight };
  }

  // Ancho que acompaña a lo iluminado cuando la tarjeta va arriba o abajo de
  // eso: ni más angosta de lo legible ni más ancha de lo cómodo.
  const alignedWidth = Math.min(Math.max(rect.width, CARD_MIN_WIDTH), maxWidth);

  const clampLeft = (value: number, width: number) =>
    Math.min(Math.max(value, MARGIN), Math.max(MARGIN, viewport.width - width - MARGIN));
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
      width: alignedWidth,
      top: rect.top + rect.height + GAP,
      left: clampLeft(rect.left, alignedWidth),
      maxHeight: roomBelow,
    };
  }

  if (cardHeight <= roomAbove) {
    return {
      width: alignedWidth,
      top: rect.top - GAP - cardHeight,
      left: clampLeft(rect.left, alignedWidth),
      maxHeight: roomAbove,
    };
  }

  if (roomRight >= CARD_MIN_WIDTH) {
    const width = Math.min(maxWidth, roomRight);
    return {
      width,
      top: clampTop(rect.top),
      left: rect.left + rect.width + GAP,
      maxHeight: fullHeight,
    };
  }

  if (roomLeft >= CARD_MIN_WIDTH) {
    const width = Math.min(maxWidth, roomLeft);
    return {
      width,
      top: clampTop(rect.top),
      left: rect.left - GAP - width,
      maxHeight: fullHeight,
    };
  }

  // El elemento iluminado ocupa casi toda la pantalla: la tarjeta va del lado
  // con más aire, recortada a ese aire.
  const useBelow = roomBelow >= roomAbove;
  const room = Math.max(useBelow ? roomBelow : roomAbove, 180);
  return {
    width: alignedWidth,
    left: clampLeft(rect.left, alignedWidth),
    top: useBelow ? viewport.height - room - MARGIN : MARGIN,
    maxHeight: room,
  };
}
