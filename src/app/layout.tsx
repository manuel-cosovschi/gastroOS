import type { Metadata, Viewport } from 'next';
import { Fraunces, Karla } from 'next/font/google';
import { Toaster } from 'sonner';
import { APP_DESCRIPTION, APP_NAME, APP_TAGLINE } from '@/lib/constants';
import './globals.css';

/**
 * Las dos tipografías de la marca.
 *
 * Karla hace la interfaz y Fraunces el logotipo y los títulos. La división no
 * es decorativa: Fraunces tiene el contraste y la calidez que le dan carácter
 * a un título, y que en el cuerpo de una tabla de pedidos sólo molestarían.
 *
 * `display: 'swap'` en las dos: en un teléfono con mala señal es preferible
 * leer el texto en la tipografía del sistema un segundo que mirar un hueco en
 * blanco hasta que baje la fuente.
 */
const karla = Karla({ subsets: ['latin'], variable: '--font-karla', display: 'swap' });

const fraunces = Fraunces({
  subsets: ['latin'],
  variable: '--font-fraunces',
  display: 'swap',
  // Dos pesos fijos en vez de la variable entera: el manual pide 700 para el
  // logotipo y los títulos, el 600 es para los títulos chicos. Pedir sólo esos
  // dos baja bastante lo que hay que descargar, que es lo que se nota en un
  // teléfono con mala señal.
  weight: ['600', '700'],
});

export const metadata: Metadata = {
  title: {
    default: `${APP_NAME} — ${APP_TAGLINE}`,
    template: `%s · ${APP_NAME}`,
  },
  description: APP_DESCRIPTION,
  applicationName: APP_NAME,
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  // El oliva de la marca: es lo que pinta la barra del navegador en Android.
  themeColor: '#26302A',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es" className={`${karla.variable} ${fraunces.variable}`}>
      <body className="font-sans">
        {children}
        <Toaster position="top-right" richColors closeButton />
      </body>
    </html>
  );
}
