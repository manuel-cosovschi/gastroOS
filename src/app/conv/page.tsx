import type { Metadata } from 'next';
import { Check } from 'lucide-react';
import { APP_NAME } from '@/lib/constants';
import { DEMO_URL, FAQS, SITE_URL, WHATSAPP_URL } from '@/lib/marketing';
import { cn } from '@/lib/utils';
import { FONDO } from '@/lib/comercial/tema';
import { Logo } from '@/components/brand/logo';
import { SovareCredit } from '@/components/brand/sovare';
import { ActivarAnimaciones } from '@/components/comercial/activar-animaciones';
import { ObservadorRevelar } from '@/components/comercial/revelar';
import { Precios } from '@/components/comercial/precios';
import { Captura, Marco, Telefono } from '@/components/comercial/pantallas';
import { Video } from '@/components/comercial/video';
import { CAPTURAS_SACADAS_EL } from '@/components/comercial/capturas.generado';
import { VIDEOS_GRABADOS_EL } from '@/components/comercial/videos.generado';
import { Bajada, BotonPrincipal, BotonSecundario, Rotulo, Seccion, Tarjeta, Titulo } from '@/components/comercial/piezas';
import { Rastreo } from '@/components/conv/rastreo';
import { FormularioConsulta } from '@/components/conv/formulario-consulta';
import { signupsEnabled } from '@/lib/signups';
import { VARIANTES, varianteDe } from './variantes';

/**
 * La página de conversión de GastroOS: a donde llegan los anuncios.
 *
 * No es la página de inicio con otro nombre. La de inicio la lee alguien que
 * vino a averiguar; esta, alguien que tocó un anuncio y tiene diez segundos.
 * Por eso:
 *
 *   · **Un objetivo**: contratar un plan (`/contratar`, el flujo real: elegís
 *     plan, transferís, subís el comprobante y te damos el acceso). Lo
 *     secundario —probar la demo, pedir que te escriban— está, pero no compite.
 *   · **Sin menú**: ni enlaces a otras secciones del sitio ni al panel. Cada
 *     salida que no es contratar es una venta que se va.
 *   · **Lo que hay, nada más**: las funciones son las del sistema andando, las
 *     capturas y el video salen de la demo y llevan su fecha. Rotiserías y casas
 *     de comidas con mostrador NO están en la lista de rubros: GastroOS no es un
 *     punto de venta, y decirlo en el anuncio trae al cliente equivocado.
 *
 * El titular cambia con `?v=` (ver `variantes.ts`): la variante la elige el
 * anuncio, queda en la atribución y viaja con cada evento y cada consulta.
 */

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: { absolute: `${APP_NAME} — Pedidos por encargo, stock y costos en una pantalla` },
  description:
    'Para pastelerías, viandas, catering y negocios que producen por encargo. Pedidos con fecha y seña, stock por receta y costo real de cada producto. Desde $15.000 por mes, sin permanencia.',
  ...(SITE_URL ? { metadataBase: new URL(SITE_URL) } : {}),
  alternates: { canonical: '/conv' },
  openGraph: {
    title: 'GastroOS — Tus pedidos por encargo, en una sola pantalla',
    description: 'Pedidos con fecha y seña, stock por receta y costo real de cada producto. Desde $15.000 por mes.',
    siteName: APP_NAME,
    locale: 'es_AR',
    type: 'website',
    url: '/conv',
    // Explícita: al definir `openGraph` acá se pisa el de la raíz entero, y la
    // imagen que Next arma con `opengraph-image.png` se perdía.
    images: [{ url: '/opengraph-image.png', width: 1200, height: 630 }],
  },
};

const comoFecha = (iso: string) => iso.split('-').reverse().join('/');

export default async function PaginaDeConversion({ searchParams }: { searchParams: Promise<{ v?: string }> }) {
  const variante = VARIANTES[varianteDe((await searchParams).v)];
  // Con las contrataciones apagadas los planes no tienen botón de contratar, y
  // mandar a alguien a una lista de precios sin salida es un botón roto. La
  // acción principal pasa a ser el formulario.
  const contratar = signupsEnabled();
  const principal = contratar
    ? { href: '#planes', texto: 'Ver planes y contratar' }
    : { href: '#consulta', texto: 'Quiero que me escriban' };

  return (
    <div className="bg-stone-900 text-stone-50">
      <style>{`html{color-scheme:dark;scroll-padding-top:4.5rem}body{background:#26302A}`}</style>
      <ActivarAnimaciones />
      <ObservadorRevelar />
      <Rastreo producto="gastroos" />

      {/* La barra: el logo y una sola acción. Sin menú, a propósito. */}
      <header className="sticky top-0 z-30 border-b border-white/[0.09] bg-stone-950/85 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-3 sm:px-6">
          <Logo size="sm" tone="onDark" />
          <a href={principal.href} className="rounded-xl bg-brand-400 px-4 py-2 text-[13px] font-bold text-stone-950 transition-colors hover:bg-brand-300">
            {contratar ? 'Ver planes' : 'Consultar'}
          </a>
        </div>
      </header>

      <main>
        {/* ---------- Hero: nunca se esconde ---------- */}
        <section className="relative overflow-hidden px-4 pb-14 pt-10 sm:px-6 md:pb-20 md:pt-16">
          <div aria-hidden className="pointer-events-none absolute inset-0 bg-[radial-gradient(56rem_30rem_at_70%_15%,rgba(224,138,107,0.13),transparent_60%)]" />
          <div className="relative mx-auto grid max-w-6xl items-center gap-10 lg:grid-cols-[1.1fr_0.9fr]">
            <div>
              <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-brand-300">{variante.para}</p>
              <div className="mt-5">
                <Titulo como="h1" acento={variante.acento}>
                  {variante.titulo}
                </Titulo>
              </div>
              <Bajada className="mt-5 max-w-xl text-lg">{variante.bajada}</Bajada>

              <div className="mt-7 flex flex-wrap gap-3">
                <BotonPrincipal href={principal.href}>{principal.texto}</BotonPrincipal>
                <BotonSecundario href={DEMO_URL} evento="Demo">
                  Probar la demo gratis
                </BotonSecundario>
              </div>

              <ul className="mt-7 grid gap-2 text-sm font-semibold text-stone-100 sm:grid-cols-2">
                {['Desde $15.000 por mes', 'Sin permanencia', 'Sin porcentaje sobre tus ventas', 'Se usa desde el celular'].map((t) => (
                  <li key={t} className="flex items-center gap-2">
                    <Check className="h-4 w-4 shrink-0 text-brand-400" aria-hidden />
                    {t}
                  </li>
                ))}
              </ul>
            </div>

            <div>
              <Telefono>
                <Video cual="pedido" />
              </Telefono>
              <p className="mt-3 text-center text-xs text-stone-300">
                Un pedido cargado desde el celular, grabado el {comoFecha(VIDEOS_GRABADOS_EL)} contra la demo, sin cortes.
              </p>
            </div>
          </div>
        </section>

        {/* ---------- Planes: el objetivo, apenas termina el hero ----------
            Antes iban sextos, después del problema, la demo y el proceso: el
            que llegaba de un anuncio tenía que scrollear cinco pantallas para
            ver cuánto sale, y la mayoría no llega. El que ya decidió contrata
            acá; el que necesita convencerse sigue bajando. */}
        <Precios id="planes" />

        {/* ---------- Problema → solución ---------- */}
        <Seccion hondo>
          <div data-revelar="pendiente">
            <Rotulo centrado>Lo que cambia</Rotulo>
            <div className="mt-4">
              <Titulo centrado acento="anotado en un solo lugar">
                Lo que hoy está en el chat,
              </Titulo>
            </div>
          </div>
          <div className="mt-10 grid gap-4 md:grid-cols-3">
            {[
              ['Un pedido se pierde en un chat', 'Cada pedido queda cargado con su fecha, su seña y su saldo. El inicio te muestra lo que entregás hoy, ordenado por hora.'],
              ['Te quedás sin un insumo justo esa semana', 'Cada producto tiene su receta. Al confirmar un pedido se descuenta el stock y el sistema te avisa qué está bajo el mínimo.'],
              ['Facturás, pero no sabés si ganás', 'El costo de cada producto sale de su receta. Con los gastos cargados ves la ganancia y el margen del mes.'],
            ].map(([antes, ahora], i) => (
              <div key={antes} data-revelar="pendiente" style={{ transitionDelay: `${i * 80}ms` }}>
                <Tarjeta className="h-full">
                  <p className="text-sm text-stone-300 line-through decoration-brand-400/60">{antes}</p>
                  <p className="mt-3 text-[15px] leading-relaxed text-stone-100">{ahora}</p>
                </Tarjeta>
              </div>
            ))}
          </div>
        </Seccion>

        {/* ---------- Demostración ---------- */}
        <Seccion>
          <div className="grid items-center gap-10 lg:grid-cols-[0.8fr_1.2fr]">
            <div data-revelar="pendiente">
              <Rotulo>Así se ve</Rotulo>
              <div className="mt-4">
                <Titulo acento="en una pantalla">Todo el negocio,</Titulo>
              </div>
              <ul className="mt-6 space-y-2.5 text-[15px] text-stone-100">
                {[
                  'Pedidos con fecha de entrega, seña y saldo',
                  'Calendario de lo que sale cada día',
                  'Clientes con su historial y lo que gastaron',
                  'Stock por receta, con lista de compra',
                  'Costo, margen y estadísticas del mes',
                  'Tienda online con tu nombre, si la querés',
                ].map((t) => (
                  <li key={t} className="flex gap-2.5">
                    <Check className="mt-1 h-4 w-4 shrink-0 text-brand-400" aria-hidden />
                    {t}
                  </li>
                ))}
              </ul>
              <p className="mt-6 text-sm text-stone-300">
                Capturas de la demo del {comoFecha(CAPTURAS_SACADAS_EL)}.{' '}
                <a href={DEMO_URL} data-conv-evento="Demo" className="underline underline-offset-2 hover:text-stone-50">
                  Entrá y probala vos
                </a>
                : es una copia tuya, sin registrarte.
              </p>
            </div>
            <div className="space-y-4" data-revelar="pendiente">
              <Marco>
                <Captura cual="panel-inicio" sizes="(max-width: 1024px) 92vw, 640px" />
              </Marco>
              <div className="grid grid-cols-2 gap-4">
                <Marco>
                  <Captura cual="estadisticas" sizes="(max-width: 1024px) 46vw, 310px" />
                </Marco>
                <Marco>
                  <Captura cual="stock" sizes="(max-width: 1024px) 46vw, 310px" />
                </Marco>
              </div>
            </div>
          </div>
        </Seccion>

        {/* ---------- Cómo se contrata: el proceso real ---------- */}
        <Seccion hondo>
          <div data-revelar="pendiente">
            <Rotulo centrado>Cómo se contrata</Rotulo>
            <div className="mt-4">
              <Titulo centrado acento="sin reuniones">
                Online, de punta a punta,
              </Titulo>
            </div>
          </div>
          <ol className="mt-10 grid gap-4 md:grid-cols-3">
            {[
              ['Elegís el plan', 'Completás los datos de tu negocio. Te mostramos el total antes de pedirte nada.'],
              ['Transferís y subís el comprobante', 'A la cuenta que te mostramos en pantalla. No hay pago con tarjeta todavía.'],
              ['Revisamos y te damos el acceso', 'Te llega por mail. En el Taller lo cargás vos con una guía; del Negocio para arriba lo dejamos cargado nosotros.'],
            ].map(([t, d], i) => (
              <li key={t} data-revelar="pendiente" style={{ transitionDelay: `${i * 80}ms` }}>
                <Tarjeta className="h-full">
                  <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-brand-400/15 text-sm font-black text-brand-300">{i + 1}</span>
                  <h3 className="mt-4 font-bold uppercase tracking-tight text-stone-50">{t}</h3>
                  <p className="mt-2 text-sm leading-relaxed text-stone-300">{d}</p>
                </Tarjeta>
              </li>
            ))}
          </ol>
        </Seccion>

        {/* ---------- Objeciones ---------- */}
        <Seccion hondo ancho="max-w-3xl">
          <div data-revelar="pendiente">
            <Rotulo centrado>Antes de contratar</Rotulo>
            <div className="mt-4">
              <Titulo centrado acento="conviene saber">
                Lo que
              </Titulo>
            </div>
          </div>
          <div className="mt-10 space-y-3">
            {FAQS.filter((f) => PREGUNTAS_CLAVE.some((q) => f.q.startsWith(q))).map((f) => (
              <details key={f.q} className="group rounded-xl border border-white/[0.09] bg-white/[0.045] px-5 py-4">
                <summary className="flex cursor-pointer list-none items-center justify-between gap-4 font-bold text-stone-50 [&::-webkit-details-marker]:hidden">
                  {f.q}
                  <span className="shrink-0 text-xl leading-none text-brand-400 transition-transform group-open:rotate-45" aria-hidden>
                    +
                  </span>
                </summary>
                <p className="mt-3 text-sm leading-relaxed text-stone-300">{f.a}</p>
              </details>
            ))}
          </div>
        </Seccion>

        {/* ---------- La vía asistida ---------- */}
        <Seccion id="consulta" ancho="max-w-2xl">
          <div data-revelar="pendiente">
            <Rotulo centrado>¿Preferís hablar antes?</Rotulo>
            <div className="mt-4">
              <Titulo centrado acento="y te escribimos">
                Dejanos tus datos
              </Titulo>
            </div>
            <Bajada centrado className="mt-4">
              Te contesta una persona, no un bot.{WHATSAPP_URL ? ' Si preferís, escribinos directo por ' : ''}
              {WHATSAPP_URL && (
                <a href={WHATSAPP_URL} target="_blank" rel="noopener" data-conv-evento="Contact" className="underline underline-offset-2 hover:text-stone-50">
                  WhatsApp
                </a>
              )}
              {WHATSAPP_URL ? '.' : ''}
            </Bajada>
          </div>
          <div className="mt-8">
            <FormularioConsulta producto="gastroos" />
          </div>
        </Seccion>

        {/* ---------- Cierre ---------- */}
        <section className={cn('border-t border-white/[0.09] px-4 py-20 text-center sm:px-6', FONDO.hondo)}>
          <Titulo centrado acento="no se pierda en un chat">
            Que el próximo pedido
          </Titulo>
          <div className="mt-8 flex flex-wrap justify-center gap-3">
            <BotonPrincipal href={principal.href}>{principal.texto}</BotonPrincipal>
            <BotonSecundario href={DEMO_URL} evento="Demo">
              Probar la demo
            </BotonSecundario>
          </div>
        </section>
      </main>

      <footer className="border-t border-white/[0.09] px-4 py-8 sm:px-6">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-4 text-xs text-stone-300">
          <SovareCredit tone="onDark" />
          <p>
            © {new Date().getFullYear()} {APP_NAME} ·{' '}
            <a href="/privacidad" className="underline underline-offset-2">
              Privacidad
            </a>
          </p>
        </div>
      </footer>
    </div>
  );
}

/** Las preguntas que frenan una compra: qué no hace, cómo se paga, qué pasa si me voy. */
const PREGUNTAS_CLAVE = [
  '¿Sirve para un local con mostrador',
  '¿Emite facturas',
  '¿Se puede cobrar online',
  '¿Tengo que cargar todo de cero',
  '¿Cuánto tarda',
  '¿Qué pasa con mis datos',
  '¿El dominio está incluido',
];
