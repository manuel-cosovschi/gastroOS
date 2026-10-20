import type { Metadata } from 'next';
import { APP_NAME, APP_TAGLINE } from '@/lib/constants';
import { SITE_URL } from '@/lib/marketing';
import { Comercial } from '@/components/comercial/comercial';

/**
 * La página de inicio de gastroos.shop es la página comercial. Todo lo que
 * tiene está en `src/components/comercial/comercial.tsx`; acá sólo vive lo que
 * Next necesita en el archivo de la ruta.
 */

const DESCRIPCION =
  'Pedidos, clientes, stock y lo que te queda de cada venta, en una pantalla que se usa desde el celular. Para pastelerías, viandas, catering y todo negocio que trabaja por encargo.';

export const metadata: Metadata = {
  // `absolute`: el resto del sitio usa la plantilla «%s · GastroOS», y en la
  // portada eso daría «GastroOS — … · GastroOS».
  title: { absolute: `${APP_NAME} — ${APP_TAGLINE}` },
  description: DESCRIPCION,
  ...(SITE_URL ? { metadataBase: new URL(SITE_URL), alternates: { canonical: '/' } } : {}),
  openGraph: {
    title: `${APP_NAME} — ${APP_TAGLINE}`,
    description: DESCRIPCION,
    type: 'website',
    siteName: APP_NAME,
    locale: 'es_AR',
    url: '/',
  },
  twitter: { card: 'summary_large_image' },
};

export default function PaginaComercial() {
  return <Comercial />;
}
