import type { MetadataRoute } from 'next';
import { getCurrentBusiness, getStorefrontBusiness, getTenantSlug } from '@/lib/business';
import { APP_NAME } from '@/lib/constants';

/**
 * Manifiesto para instalar la aplicación en el teléfono, que son dos cosas
 * distintas según desde dónde se lo pida.
 *
 * En el dominio principal lo pide el dueño desde su panel: lo que quiere instalar
 * es su gestión, así que `start_url` apunta a `/admin` y los atajos son los de
 * trabajar (pedidos, calendario).
 *
 * En `tunegocio.gastroos.shop` lo pide un cliente del negocio, mirando la tienda.
 * Mandarlo a `/admin` sería mandarlo a una pantalla de acceso que no es suya, así
 * que ahí el manifiesto es el de la tienda: abre el catálogo y los atajos son los
 * de comprar.
 *
 * El nombre sale del negocio en los dos casos: en la pantalla de inicio de un
 * teléfono, "Dulce Estudio" dice mucho más que "GastroOS".
 */
export const dynamic = 'force-dynamic';

export default async function manifest(): Promise<MetadataRoute.Manifest> {
  const tienda = Boolean(await getTenantSlug());
  const business = tienda
    ? await getStorefrontBusiness()
    : (await getCurrentBusiness()) || (await getStorefrontBusiness());
  const name = business?.name || APP_NAME;

  const comun = {
    short_name: shortName(name),
    scope: '/',
    display: 'standalone' as const,
    orientation: 'portrait' as const,
    // La crema y el oliva de la marca: es lo que se ve en la pantalla de
    // arranque de la aplicación instalada y en la barra del sistema.
    background_color: '#FBF5EA',
    theme_color: '#26302A',
    lang: 'es',
    icons: [
      { src: '/icono-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' as const },
      { src: '/icono-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' as const },
      {
        src: '/icono-maskable-512.png',
        sizes: '512x512',
        type: 'image/png',
        purpose: 'maskable' as const,
      },
    ],
  };

  if (tienda) {
    return {
      ...comun,
      name,
      description: `Pedidos online de ${name}`,
      start_url: '/catalogo',
      categories: ['food', 'shopping'],
      shortcuts: [
        { name: 'Catálogo', url: '/catalogo' },
        { name: 'Combos', url: '/paquetes' },
        { name: 'Seguir mi pedido', url: '/pedido/seguimiento' },
      ],
    };
  }

  return {
    ...comun,
    name: `${name} · Gestión`,
    description: `Panel de gestión de ${name}`,
    start_url: '/admin',
    categories: ['business', 'productivity'],
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
