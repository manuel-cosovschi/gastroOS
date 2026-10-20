import { ArrowRight, Check } from 'lucide-react';
import { cn } from '@/lib/utils';
import { BOTON, FONDO, ROTULO, TARJETA, TEXTO, TITULO } from '@/lib/comercial/tema';

/**
 * Las piezas que se repiten en la página comercial.
 *
 * Todas leen sus colores de `tema.ts` y no de un hex suelto: así la prueba de
 * contraste mide lo que la página usa de verdad. Un color escrito acá a mano
 * sería uno que nadie midió.
 */

/**
 * El rótulo de arriba de cada título.
 *
 * Chiquito, en versales y muy espaciado. El que scrollea rápido lee esto y sabe
 * de qué trata la sección sin leer el título.
 */
export function Rotulo({
  children,
  centrado = false,
  claro = false,
}: {
  children: React.ReactNode;
  centrado?: boolean;
  /** Sobre la sección clara el acento baja a `brand-700`: el 400 no llega. */
  claro?: boolean;
}) {
  return (
    <p className={cn(ROTULO, claro ? 'text-brand-700' : TEXTO.acento, centrado && 'text-center')}>
      {children}
    </p>
  );
}

/**
 * El título de una sección: itálica negra, versales, muy ajustado, con la
 * mitad de la frase en el acento.
 *
 * La itálica es la de verdad de Fraunces, no una inclinación sintética: está
 * declarada en `layout.tsx`, y sin declararla el navegador la falsea.
 */
export function Titulo({
  children,
  acento,
  centrado = false,
  como = 'h2',
  claro = false,
}: {
  children: React.ReactNode;
  acento?: React.ReactNode;
  centrado?: boolean;
  como?: 'h1' | 'h2';
  claro?: boolean;
}) {
  const Tag = como;
  return (
    <Tag
      className={cn(
        TITULO,
        como === 'h1'
          ? 'text-[2.15rem] leading-[1] sm:text-5xl lg:text-[3.4rem]'
          : 'text-[1.8rem] leading-[1.04] sm:text-4xl lg:text-[2.75rem]',
        claro ? 'text-stone-900' : TEXTO.fuerte,
        centrado && 'text-center'
      )}
    >
      {children}
      {acento && (
        <>
          {' '}
          <span className={claro ? 'text-brand-700' : TEXTO.acento}>{acento}</span>
        </>
      )}
    </Tag>
  );
}

/** El párrafo que acompaña a un título. */
export function Bajada({
  children,
  centrado = false,
  className,
}: {
  children: React.ReactNode;
  centrado?: boolean;
  className?: string;
}) {
  return (
    <p className={cn('leading-relaxed', TEXTO.suave, centrado && 'mx-auto text-center', className)}>
      {children}
    </p>
  );
}

/** Una tarjeta sobre el fondo oscuro. */
export function Tarjeta({ children, className }: { children: React.ReactNode; className?: string }) {
  return <div className={cn(TARJETA, 'p-5', className)}>{children}</div>;
}

/** Una fila de las listas de lo que hace, con su tilde. */
export function Fila({ children }: { children: React.ReactNode }) {
  return (
    <li className={cn(TARJETA, 'flex items-start gap-3 px-4 py-3 text-sm font-medium text-stone-100')}>
      <Check className="mt-0.5 h-4 w-4 shrink-0 text-brand-400" aria-hidden />
      <span>{children}</span>
    </li>
  );
}

const BASE_BOTON =
  'inline-flex items-center justify-center gap-2 rounded-xl px-6 py-3.5 text-[15px] font-bold transition-colors';

/**
 * El botón principal: el único relleno de color de la pantalla.
 *
 * Los enlaces de afuera abren en otra pestaña y los de adentro no: alguien que
 * toca «Probá la demo» quiere quedarse en el sitio, y el que toca WhatsApp no
 * quiere perder la página.
 */
export function BotonPrincipal({
  href,
  children,
  className,
}: {
  href: string;
  children: React.ReactNode;
  className?: string;
}) {
  const afuera = href.startsWith('http');
  return (
    <a
      href={href}
      target={afuera ? '_blank' : undefined}
      rel={afuera ? 'noopener' : undefined}
      className={cn(BASE_BOTON, BOTON.principal, className)}
    >
      {children}
      <ArrowRight className="h-4 w-4" aria-hidden />
    </a>
  );
}

/** El secundario: mismo tamaño, sin relleno, para no competir con el otro. */
export function BotonSecundario({
  href,
  children,
  className,
}: {
  href: string;
  children: React.ReactNode;
  className?: string;
}) {
  const afuera = href.startsWith('http');
  return (
    <a
      href={href}
      target={afuera ? '_blank' : undefined}
      rel={afuera ? 'noopener' : undefined}
      className={cn(BASE_BOTON, BOTON.secundario, className)}
    >
      {children}
    </a>
  );
}

/**
 * Una sección oscura, con su fondo y su aire.
 *
 * `hondo` alterna el tono: las secciones van una y una, y el cambio de fondo
 * es lo que marca dónde termina una idea sin poner una línea.
 */
export function Seccion({
  id,
  hondo = false,
  children,
  className,
  ancho = 'max-w-6xl',
}: {
  id?: string;
  hondo?: boolean;
  children: React.ReactNode;
  className?: string;
  ancho?: string;
}) {
  return (
    <section
      id={id}
      className={cn(
        'border-t border-white/[0.09] px-4 py-20 sm:px-6 md:py-28',
        hondo ? FONDO.hondo : FONDO.base,
        className
      )}
    >
      <div className={cn('mx-auto', ancho)}>{children}</div>
    </section>
  );
}
