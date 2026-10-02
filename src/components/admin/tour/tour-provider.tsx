'use client';

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { TOUR_STEPS, TOUR_STORAGE_KEY, TOUR_TOTAL, type TourStep } from '@/lib/tour';

/**
 * Estado de la visita guiada.
 *
 * Vive por encima del panel entero porque la guía cruza pantallas: un paso
 * puede estar en el dashboard y el siguiente en Stock, y el recorrido tiene
 * que sobrevivir a esa navegación.
 *
 * El progreso se guarda en `localStorage` para que recargar la página no
 * devuelva al visitante al paso uno. Cada acceso va en try/catch: en una
 * ventana de incógnito leer `localStorage` puede tirar excepción, y que eso
 * tumbe el panel entero sería mucho peor que perder el progreso.
 */

interface TourValue {
  open: boolean;
  index: number;
  step: TourStep | null;
  total: number;
  start: (from?: number) => void;
  stop: () => void;
  next: () => void;
  prev: () => void;
  /** El paso actual señala algo del menú lateral, que en mobile está oculto. */
  needsSidebar: boolean;
  /** Se está abriendo la pantalla del paso: abajo todavía se ve la anterior. */
  navigating: boolean;
}

const TourContext = createContext<TourValue | null>(null);

interface StoredProgress {
  seen?: boolean;
  index?: number;
}

function readProgress(): StoredProgress {
  try {
    const raw = window.localStorage.getItem(TOUR_STORAGE_KEY);
    return raw ? (JSON.parse(raw) as StoredProgress) : {};
  } catch {
    return {};
  }
}

function writeProgress(progress: StoredProgress) {
  try {
    window.localStorage.setItem(TOUR_STORAGE_KEY, JSON.stringify(progress));
  } catch {
    // Sin almacenamiento la guía funciona igual; sólo no recuerda el progreso.
  }
}

export function TourProvider({
  demo,
  autoStart,
  children,
}: {
  /** La sesión es una demo: los pasos hablan de "tu copia de ejemplo". */
  demo: boolean;
  /** Abrir la guía sola la primera vez que se entra desde este navegador. */
  autoStart: boolean;
  children: React.ReactNode;
}) {
  const router = useRouter();
  const pathname = usePathname();

  const [index, setIndex] = useState(0);
  const [open, setOpen] = useState(false);
  const [navigating, setNavigating] = useState(false);
  const autoStarted = useRef(false);
  const navigatedFor = useRef<string | null>(null);

  // En la demo se lee el guion tal cual; con un negocio de verdad, los pasos que
  // hablan de la demo se reemplazan por su versión real.
  const base = open ? (TOUR_STEPS[index] ?? null) : null;
  const step = useMemo(
    () => (base && !demo && base.real ? { ...base, ...base.real } : base),
    [base, demo]
  );

  const start = useCallback((from = 0) => {
    setIndex(Math.min(Math.max(from, 0), TOUR_TOTAL - 1));
    setOpen(true);
  }, []);

  const stop = useCallback(() => {
    setOpen(false);
    writeProgress({ seen: true, index: 0 });
  }, []);

  const next = useCallback(() => {
    setIndex((current) => {
      if (current >= TOUR_TOTAL - 1) {
        setOpen(false);
        writeProgress({ seen: true, index: 0 });
        return current;
      }
      writeProgress({ index: current + 1 });
      return current + 1;
    });
  }, []);

  const prev = useCallback(() => {
    setIndex((current) => {
      const target = Math.max(current - 1, 0);
      writeProgress({ index: target });
      return target;
    });
  }, []);

  // Arranque automático: sólo la primera vez, y sólo donde tiene sentido: en la
  // demo y en un negocio recién creado. Un dueño que lleva meses usando su
  // sistema ya sabe cómo se usa; la guía le queda a mano en el botón, pero no
  // se le tira encima cada vez que entra desde un navegador nuevo.
  useEffect(() => {
    if (autoStarted.current) return;
    autoStarted.current = true;
    if (!autoStart) return;

    const progress = readProgress();
    if (progress.seen) return;

    // Un respiro para que la pantalla termine de pintarse: iluminar un
    // elemento que todavía se está acomodando deja el recuadro corrido.
    const timer = window.setTimeout(() => start(progress.index ?? 0), 900);
    return () => window.clearTimeout(timer);
  }, [start, autoStart]);

  // La guía abre la pantalla de cada paso, pero una sola vez por paso. Si se
  // navegara cada vez que cambia la ruta, en los pasos que dejan tocar la
  // pantalla el visitante haría clic en algo y la guía lo traería de vuelta a
  // la fuerza, que es exactamente lo contrario de invitarlo a probar.
  useEffect(() => {
    if (!step) {
      navigatedFor.current = null;
      return;
    }

    if (navigatedFor.current !== step.id) {
      navigatedFor.current = step.id;
      if (pathname !== step.route) {
        setNavigating(true);
        router.push(step.route);
        return;
      }
    }

    if (pathname === step.route) setNavigating(false);
  }, [step, pathname, router]);

  const value = useMemo<TourValue>(
    () => ({
      open,
      index,
      step,
      total: TOUR_TOTAL,
      start,
      stop,
      next,
      prev,
      needsSidebar: Boolean(step?.needsSidebar),
      navigating,
    }),
    [open, index, step, start, stop, next, prev, navigating]
  );

  return <TourContext.Provider value={value}>{children}</TourContext.Provider>;
}

export function useTour(): TourValue {
  const context = useContext(TourContext);
  if (!context) throw new Error('useTour debe usarse dentro de <TourProvider>.');
  return context;
}
