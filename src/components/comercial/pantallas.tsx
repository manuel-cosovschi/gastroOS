import Image from 'next/image';
import { CAPTURAS } from './capturas.generado';

/**
 * El producto, mostrado: capturas del sistema andando, no dibujos.
 *
 * Una captura envejece sin que nadie se entere —el producto cambia, la imagen
 * se queda— y por eso ese riesgo tiene quién lo vigile:
 *
 *   1. Las saca `npm run capturas` recorriendo la demo de verdad. Actualizarlas
 *      es un comando, no una tarde.
 *   2. `capturas.generado.ts` se escribe en la misma corrida, con la fecha y el
 *      tamaño real de cada imagen. Si falta una, es un error de compilación, no
 *      un hueco en la página.
 *   3. `npm run prueba:comercial` falla cuando la interfaz se tocó después de la
 *      última corrida: una captura vieja deja de ser invisible.
 *   4. La página muestra la fecha y enlaza a la demo al lado de cada imagen.
 */

export type ClaveDeCaptura = keyof typeof CAPTURAS;

/**
 * Una captura, con su tamaño de verdad.
 *
 * El ancho y el alto salen de la imagen, así que `next/image` reserva el espacio
 * exacto antes de que cargue y la página no salta. `sizes` está para que a un
 * celular no le llegue una imagen de 2560 píxeles.
 */
export function Captura({
  cual,
  prioridad = false,
  sizes = '(max-width: 768px) 92vw, 560px',
  className,
}: {
  cual: ClaveDeCaptura;
  prioridad?: boolean;
  sizes?: string;
  className?: string;
}) {
  const c = CAPTURAS[cual];
  return (
    <Image
      src={c.archivo}
      width={c.ancho}
      height={c.alto}
      sizes={sizes}
      // Sólo la del hero: es la única que se ve sin scrollear, y ponérselo a
      // todas sería pedirle al navegador que baje cinco imágenes antes de pintar.
      priority={prioridad}
      alt={c.que}
      className={`h-auto w-full ${className ?? ''}`}
    />
  );
}

/**
 * El marco de las capturas anchas.
 *
 * `overflow-hidden` con el mismo radio que el borde: sin eso la esquina de la
 * imagen sobresale del redondeo. El fondo es claro porque las capturas del panel
 * lo son: un marco oscuro alrededor de una imagen clara deja un halo.
 */
export function Marco({ children }: { children: React.ReactNode }) {
  return (
    <div className="overflow-hidden rounded-2xl border border-white/[0.09] bg-stone-50 shadow-[0_20px_50px_rgba(0,0,0,0.35)]">
      {children}
    </div>
  );
}

/**
 * El marco de teléfono.
 *
 * No es decoración: el dueño de un negocio chico lo usa desde el celular, y la
 * mitad de las dudas son «¿esto se puede usar del teléfono?». Mostrarlo en uno
 * lo contesta sin una línea de texto.
 */
export function Telefono({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <div
      className={`mx-auto w-full max-w-[290px] rounded-[2.2rem] border border-white/[0.09] bg-stone-950 p-2.5 shadow-[0_26px_60px_rgba(0,0,0,0.45)] ${className ?? ''}`}
    >
      <div className="overflow-hidden rounded-[1.7rem] bg-stone-50">{children}</div>
    </div>
  );
}
