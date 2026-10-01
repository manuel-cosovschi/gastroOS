import type { MetadataRoute } from 'next';
import { getCurrentBusiness, getStorefrontBusiness } from '@/lib/business';
import { APP_NAME } from '@/lib/constants';

/**
 * Manifiesto para instalar el panel en el teléfono.
 *
 * `start_url` apunta a `/admin` a propósito: quien agrega esto a su pantalla de
 * inicio es el dueño del negocio, que quiere abrir su gestión de un toque, no
 * la tienda. La tienda ya tiene su lugar — es una página web que se comparte
 * por link, no una aplicación que se instala.
 *
 * El nombre sale del negocio cuando se puede: en la pantalla de inicio de un
 * teléfono, "Dulce Estudio" dice mucho más que "GastroOS". Se intenta primero
 * con la sesión (el dueño instalando desde su panel) y, si no hay, con el
 * negocio de la tienda pública.
 */
export const dynamic = 'force-dynamic';

export default async function manifest(): Promise<MetadataRoute.Manifest> {
  const business = (await getCurrentBusiness()) || (await getStorefrontBusiness());
  const name = business?.name || APP_NAME;

  return {
    name: `${name} · Gestión`,
    short_name: shortName(name),
    description: `Panel de gestión de ${name}`,
    start_url: '/admin',
    scope: '/',
    display: 'standalone',
    orientation: 'portrait',
    // La crema y el oliva de la marca: es lo que se ve en la pantalla de
    // arranque de la aplicación instalada y en la barra del sistema.
    background_color: '#FBF5EA',
    theme_color: '#26302A',
    lang: 'es',
    categories: ['business', 'productivity'],
    icons: [
      { src: '/icono-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
      { src: '/icono-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
      {
        src: '/icono-maskable-512.png',
        sizes: '512x512',
        type: 'image/png',
        purpose: 'maskable',
      },
    ],
    shortcuts: [
      { name: 'Pedidos', url: '/admin/pedidos' },
      { name: 'Cargar un pedido', url: '/admin/pedidos/nuevo' },
      { name: 'Calendario', url: '/admin/calendario' },
    ],
  };
}

/**
 * El nombre corto es el que va debajo del ícono en la pantalla de inicio.
 *
 * Cortar a los doce caracteres dejaba "Dulce Estudi": un nombre mutilado a
 * mitad de palabra se lee peor que uno largo, que el sistema operativo recorta
 * con puntos suspensivos y se entiende. Así que se corta sólo si hace falta, y
 * siempre en un espacio.
 */
function shortName(name: string): string {
  const limit = 20;
  if (name.length <= limit) return name;

  const cut = name.slice(0, limit);
  const space = cut.lastIndexOf(' ');
  return space > 8 ? cut.slice(0, space) : cut;
}
