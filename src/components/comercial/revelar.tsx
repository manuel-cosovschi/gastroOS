'use client';

import { useEffect } from 'react';

/**
 * Las apariciones al scrollear, armadas para que no puedan dejar la página en
 * blanco.
 *
 * Una animación de aparición esconde el contenido y confía en que algo lo
 * vuelva a mostrar; si ese algo no corre —React no hidrata, un archivo no
 * llegó, un bloqueador frenó el script— la página de venta queda vacía, sin un
 * solo error en la consola. Son tres defensas, y las tres hacen falta:
 *
 * 1. **Sin JavaScript no se esconde nada.** El `opacity: 0` de `globals.css`
 *    vive adentro de `.con-animaciones`, una clase que pone `ActivarAnimaciones`
 *    antes de pintar. Lo prueba la 5 de `scripts/prueba-comercial.mts`, con
 *    el JavaScript apagado; la 6 prueba la red con React cortado.
 *
 * 2. **El hero nunca lleva `data-revelar`.** Se revelaría recién al hidratar, y
 *    lo primero que ve alguien tiene que estar desde el primer cuadro.
 *
 * 3. **La red de seguridad.** A los tres segundos se muestra todo lo que quede
 *    pendiente, pase lo que pase. Vive en el script de `ActivarAnimaciones` y no
 *    acá, justamente porque tiene que funcionar aunque este componente nunca
 *    llegue a montarse. Cuando este monta la cancela: React está vivo y el
 *    observador se hace cargo.
 *
 * Es un observador para toda la página y no un componente por bloque: marcar
 * un bloque es ponerle `data-revelar="pendiente"`, sin volverlo componente de
 * cliente. La página sigue siendo HTML que arma el servidor, y lo único que
 * corre en el navegador es esto.
 */

declare global {
  interface Window {
    /** El temporizador de la red, para que este componente lo corte. */
    __redDeSeguridadAnimaciones?: ReturnType<typeof setTimeout>;
  }
}

export function ObservadorRevelar() {
  useEffect(() => {
    if (window.__redDeSeguridadAnimaciones) {
      clearTimeout(window.__redDeSeguridadAnimaciones);
      window.__redDeSeguridadAnimaciones = undefined;
    }

    const pendientes = Array.from(
      document.querySelectorAll<HTMLElement>('[data-revelar="pendiente"]')
    );
    const mostrar = (el: Element) => el.setAttribute('data-revelar', 'visto');

    // Sin observador (un navegador viejo) se muestra todo y listo: es
    // preferible perder la animación a perder el contenido.
    if (typeof IntersectionObserver === 'undefined') {
      pendientes.forEach(mostrar);
      return;
    }

    const observador = new IntersectionObserver(
      (entradas) => {
        for (const e of entradas) {
          if (!e.isIntersecting) continue;
          mostrar(e.target);
          // Una vez que apareció no se vuelve a esconder al scrollear para
          // arriba: una sección que se desvanece cuando volvés a ella se siente
          // rota, no animada.
          observador.unobserve(e.target);
        }
      },
      // Un poco antes de que llegue al borde: así la animación termina con el
      // bloque a la vista, y no empieza recién ahí.
      { rootMargin: '0px 0px -12% 0px', threshold: 0.05 }
    );
    pendientes.forEach((el) => observador.observe(el));

    // Y una red propia, por si un bloque queda fuera del alcance del
    // observador —adentro de un contenedor con `overflow`, con un alto que el
    // navegador calcula raro—: una animación que se traga una sección es peor
    // que no tener animación.
    //
    // No revela todo a los tres segundos, que es lo que hace la red del script:
    // eso apagaría las animaciones de todo lo que está más abajo. Revela lo que
    // ya debería verse —lo que está en pantalla o arriba— y sigue mirando en
    // cada scroll. La garantía es la misma: nada de lo que está a la vista se
    // queda escondido más de tres segundos.
    const barrer = () => {
      for (const el of pendientes) {
        if (el.getAttribute('data-revelar') !== 'pendiente') continue;
        if (el.getBoundingClientRect().top < window.innerHeight) mostrar(el);
      }
    };
    // Una pasada pendiente a la vez, y no reiniciada en cada scroll: con un
    // reinicio, alguien que scrollea sin parar nunca llegaría a disparar la red.
    let red: number | undefined;
    const alScrollear = () => {
      if (red !== undefined) return;
      red = window.setTimeout(() => {
        red = undefined;
        barrer();
      }, 3000);
    };
    alScrollear();
    window.addEventListener('scroll', alScrollear, { passive: true });

    return () => {
      observador.disconnect();
      window.clearTimeout(red);
      window.removeEventListener('scroll', alScrollear);
    };
  }, []);

  return null;
}
