import type { Metadata, Viewport } from 'next';
import { Inter } from 'next/font/google';
import { Toaster } from 'sonner';
import './globals.css';

const inter = Inter({ subsets: ['latin'], variable: '--font-inter' });

export const metadata: Metadata = {
  title: { default: 'Panel SOVARE', template: '%s · Panel SOVARE' },
  description: 'Clientes, instalaciones y cobros de GastroOS.',
  robots: { index: false, follow: false },
  // El nombre debajo del icono en la pantalla de inicio. Sin esto iOS usa el
  // `<title>` de la página en la que estabas al agregarlo, y el acceso directo
  // termina llamándose "Cobros · Panel SOVARE", recortado a lo que entre.
  applicationName: 'SOVARE',
  appleWebApp: { capable: true, title: 'SOVARE', statusBarStyle: 'black-translucent' },
  // iOS no mira el manifiesto para el icono y no entiende SVG acá: si este PNG
  // no está, el acceso directo del teléfono queda con una captura de la página.
  icons: {
    icon: '/icon.svg',
    apple: [{ url: '/apple-touch-icon.png', sizes: '180x180', type: 'image/png' }],
  },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  themeColor: '#26292D',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es" className={inter.variable}>
      <body className="font-sans">
        {children}
        <Toaster position="top-right" richColors closeButton />
      </body>
    </html>
  );
}
