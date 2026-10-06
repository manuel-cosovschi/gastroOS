import type { MetadataRoute } from 'next';

/**
 * Para instalar el panel en el teléfono.
 *
 * Esto es lo que lee Android al "Instalar aplicación": sin manifiesto no ofrece
 * instalarla, y el acceso directo queda como un marcador del navegador, con la
 * barra de direcciones arriba y el icono genérico de Chrome. (iOS no lee el
 * manifiesto para el icono: ese es el `apple-touch-icon` del layout.)
 *
 * `display: standalone` es lo que saca la barra del navegador y lo hace parecer
 * una aplicación. `start_url` va a la raíz, que es el tablero: es a lo que uno
 * entra cuando abre esto desde la pantalla de inicio.
 *
 * Los accesos directos son los dos lugares donde se entra a hacer algo concreto
 * y no a mirar: una contratación que llegó, o un cobro que hay que marcar.
 */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'Panel SOVARE',
    short_name: 'SOVARE',
    description: 'Clientes, instalaciones y cobros de GastroOS.',
    start_url: '/',
    scope: '/',
    display: 'standalone',
    orientation: 'portrait',
    lang: 'es',
    // El gris de la marca, el mismo del `themeColor` y del fondo de los iconos:
    // así la pantalla de arranque no pega un salto de color al abrir.
    background_color: '#26292D',
    theme_color: '#26292D',
    icons: [
      { src: '/icono-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
      { src: '/icono-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
      { src: '/icono-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
    ],
    shortcuts: [
      { name: 'Contrataciones', url: '/contrataciones' },
      { name: 'Cobros', url: '/cobros' },
    ],
  };
}
