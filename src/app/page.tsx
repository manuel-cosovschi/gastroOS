import type { Metadata } from 'next';
import Image from 'next/image';
import Link from 'next/link';
import { ArrowRight, Check, Sparkles } from 'lucide-react';
import { APP_NAME, APP_TAGLINE } from '@/lib/constants';
import {
  BOOKING_URL,
  CONTACT_EMAIL,
  FAQS,
  HAS_CONTACT,
  HERO,
  INDUSTRIES,
  MODULES,
  PROBLEMS,
  REASONS,
  SHOWCASE,
  STEPS,
  WHATSAPP_URL,
} from '@/lib/marketing';
import { Logo } from '@/components/brand/logo';
import { SovareCredit } from '@/components/brand/sovare';
import { SiteNav } from '@/components/marketing/site-nav';
import { BrowserFrame, SectionHeading } from '@/components/marketing/section';
import {
  BookDemoButton,
  ContactLinks,
  PrimaryCta,
  TryDemoButton,
} from '@/components/marketing/cta-buttons';

export const metadata: Metadata = {
  title: `${APP_NAME} — ${APP_TAGLINE}`,
  description:
    'Sistema de gestión para pastelerías, panaderías, catering, viandas y negocios que trabajan por encargo. Pedidos, clientes, stock y rentabilidad en un solo lugar.',
  openGraph: {
    title: `${APP_NAME} — ${APP_TAGLINE}`,
    description:
      'Pedidos, clientes, stock y rentabilidad en una sola pantalla. Para negocios gastronómicos que trabajan por encargo.',
    type: 'website',
  },
};

export default function LandingPage() {
  return (
    <div className="bg-white">
      <SiteNav />

      {/* ---------- Hero ---------- */}
      <section className="relative overflow-hidden">
        {/* Halo suave detrás del hero, sin robarle protagonismo a la captura */}
        <div
          aria-hidden
          className="pointer-events-none absolute inset-x-0 -top-40 h-[480px] bg-[radial-gradient(60%_60%_at_50%_50%,theme(colors.brand.100),transparent_70%)] opacity-70"
        />

        <div className="relative mx-auto max-w-6xl px-4 pb-16 pt-12 sm:px-6 sm:pb-20 sm:pt-16">
          <div className="mx-auto max-w-3xl text-center">
            <span className="inline-flex items-center gap-2 rounded-full border border-brand-200 bg-brand-50 px-3 py-1 text-xs font-medium text-brand-800">
              <Sparkles className="h-3.5 w-3.5" />
              {HERO.eyebrow}
            </span>

            <h1 className="mt-5 text-4xl font-semibold leading-[1.1] tracking-tight text-stone-900 sm:text-5xl lg:text-6xl">
              {HERO.title}
            </h1>

            <p className="mx-auto mt-5 max-w-2xl text-lg leading-relaxed text-stone-600 sm:text-xl">
              {HERO.subtitle}
            </p>

            <PrimaryCta className="mt-8 justify-center" />

            <ul className="mt-8 flex flex-col items-center justify-center gap-x-6 gap-y-2 text-sm text-stone-600 sm:flex-row">
              {HERO.bullets.map((bullet) => (
                <li key={bullet} className="inline-flex items-center gap-1.5">
                  <Check className="h-4 w-4 shrink-0 text-brand-600" />
                  {bullet}
                </li>
              ))}
            </ul>
          </div>

          <BrowserFrame className="mx-auto mt-12 max-w-5xl">
            <Image
              src="/producto/dashboard.webp"
              alt="Dashboard de GastroOS con el resumen del día, alertas de stock y próximas entregas"
              width={1600}
              height={1000}
              priority
              className="w-full"
            />
          </BrowserFrame>
        </div>
      </section>

      {/* ---------- Rubros ---------- */}
      <section className="border-y border-stone-200 bg-stone-50 py-8">
        <div className="mx-auto max-w-6xl px-4 sm:px-6">
          <p className="text-center text-xs font-semibold uppercase tracking-wider text-stone-500">
            Pensado para
          </p>
          <ul className="mt-4 flex flex-wrap items-center justify-center gap-x-6 gap-y-2">
            {INDUSTRIES.map((industry) => (
              <li key={industry} className="text-sm font-medium text-stone-700">
                {industry}
              </li>
            ))}
          </ul>
        </div>
      </section>

      {/* ---------- Problema ---------- */}
      <section className="py-20 sm:py-24">
        <div className="mx-auto max-w-6xl px-4 sm:px-6">
          <SectionHeading
            eyebrow="El problema"
            title="Vender bien no alcanza si no sabés qué está pasando"
            subtitle="La mayoría de los negocios por encargo crecen hasta que la operación los pasa por arriba. No es falta de trabajo: es falta de sistema."
          />

          <div className="mt-12 grid gap-6 md:grid-cols-3">
            {PROBLEMS.map((problem) => (
              <div key={problem.title} className="surface p-6">
                <h3 className="text-base font-semibold text-stone-900">{problem.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-stone-600">{problem.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ---------- Módulos ---------- */}
      <section id="producto" className="scroll-mt-20 bg-stone-50 py-20 sm:py-24">
        <div className="mx-auto max-w-6xl px-4 sm:px-6">
          <SectionHeading
            eyebrow="Qué incluye"
            title="Todo lo que tu negocio necesita, en un solo lugar"
            subtitle="Ocho módulos que trabajan juntos. Cargás un pedido y el stock, el cliente y las estadísticas se actualizan solos."
          />

          <div className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {MODULES.map((module) => (
              <div key={module.title} className="surface p-5">
                <span className="inline-flex h-10 w-10 items-center justify-center rounded-xl bg-brand-50">
                  <module.icon className="h-5 w-5 text-brand-700" />
                </span>
                <h3 className="mt-4 text-base font-semibold text-stone-900">{module.title}</h3>
                <p className="mt-1.5 text-sm leading-relaxed text-stone-600">{module.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ---------- Recorrido con capturas reales ---------- */}
      <section className="py-20 sm:py-24">
        <div className="mx-auto max-w-6xl px-4 sm:px-6">
          <SectionHeading
            eyebrow="Por dentro"
            title="Esto es el producto, no una maqueta"
            subtitle="Todas las pantallas que siguen son capturas reales del sistema funcionando con datos de un negocio de ejemplo."
          />

          <div className="mt-16 space-y-20 sm:space-y-24">
            {SHOWCASE.map((item, index) => (
              <div
                key={item.title}
                className="grid items-center gap-8 lg:grid-cols-2 lg:gap-14"
              >
                <div className={index % 2 === 1 ? 'lg:order-2' : undefined}>
                  <p className="text-xs font-semibold uppercase tracking-wider text-brand-700">
                    {item.eyebrow}
                  </p>
                  <h3 className="mt-2 text-2xl font-semibold tracking-tight text-stone-900 sm:text-3xl">
                    {item.title}
                  </h3>
                  <p className="mt-3 text-base leading-relaxed text-stone-600">{item.body}</p>
                  <ul className="mt-5 space-y-2.5">
                    {item.points.map((point) => (
                      <li key={point} className="flex items-start gap-2.5 text-sm text-stone-700">
                        <Check className="mt-0.5 h-4 w-4 shrink-0 text-brand-600" />
                        {point}
                      </li>
                    ))}
                  </ul>
                </div>

                <BrowserFrame className={index % 2 === 1 ? 'lg:order-1' : undefined}>
                  <Image
                    src={item.image}
                    alt={item.alt}
                    width={1600}
                    height={1000}
                    className="w-full"
                  />
                </BrowserFrame>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ---------- Mobile ---------- */}
      <section className="border-y border-stone-200 bg-stone-50 py-20 sm:py-24">
        <div className="mx-auto grid max-w-6xl items-center gap-12 px-4 sm:px-6 lg:grid-cols-2">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-brand-700">
              Desde el teléfono
            </p>
            <h2 className="mt-2 text-3xl font-semibold tracking-tight text-stone-900 sm:text-4xl">
              El negocio no pasa sentado frente a una computadora
            </h2>
            <p className="mt-4 text-lg leading-relaxed text-stone-600">
              Cargar un pedido mientras atendés, marcar una entrega desde el auto o revisar lo que
              falta comprar en el proveedor. Todo funciona igual de bien en el celular.
            </p>
            <ul className="mt-6 space-y-2.5">
              {[
                'Ver las entregas del día',
                'Cargar un pedido nuevo',
                'Cambiar el estado de un pedido',
                'Consultar el historial de un cliente',
              ].map((point) => (
                <li key={point} className="flex items-start gap-2.5 text-sm text-stone-700">
                  <Check className="mt-0.5 h-4 w-4 shrink-0 text-brand-600" />
                  {point}
                </li>
              ))}
            </ul>
          </div>

          <div className="flex justify-center">
            <div className="w-[260px] overflow-hidden rounded-[2rem] border-[6px] border-stone-800 bg-stone-800 shadow-lift">
              <Image
                src="/producto/mobile.webp"
                alt="GastroOS en un teléfono, mostrando el dashboard del día"
                width={780}
                height={1560}
                className="w-full rounded-[1.6rem]"
              />
            </div>
          </div>
        </div>
      </section>

      {/* ---------- Cómo funciona ---------- */}
      <section id="como-funciona" className="scroll-mt-20 py-20 sm:py-24">
        <div className="mx-auto max-w-6xl px-4 sm:px-6">
          <SectionHeading
            eyebrow="Cómo trabajamos"
            title="De la primera charla a tu negocio funcionando"
            subtitle="No te entregamos un usuario y una contraseña. Te dejamos el sistema andando con tus datos adentro."
          />

          <ol className="mt-12 grid gap-6 md:grid-cols-2 lg:grid-cols-4">
            {STEPS.map((step, index) => (
              <li key={step.title} className="surface p-6">
                <span className="inline-flex h-9 w-9 items-center justify-center rounded-full bg-stone-900 text-sm font-semibold text-white">
                  {index + 1}
                </span>
                <h3 className="mt-4 text-base font-semibold text-stone-900">{step.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-stone-600">{step.body}</p>
              </li>
            ))}
          </ol>
        </div>
      </section>

      {/* ---------- Por qué ---------- */}
      <section id="por-que" className="scroll-mt-20 bg-stone-50 py-20 sm:py-24">
        <div className="mx-auto max-w-6xl px-4 sm:px-6">
          <SectionHeading
            eyebrow="Por qué GastroOS"
            title="Por qué elegirnos"
            subtitle="Hay muchos sistemas de gestión. Muy pocos están hechos para un negocio que produce contra pedido."
          />

          <div className="mt-12 grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {REASONS.map((reason) => (
              <div key={reason.title} className="flex gap-3.5">
                <span className="mt-0.5 inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-brand-100">
                  <Check className="h-3.5 w-3.5 text-brand-700" />
                </span>
                <div>
                  <h3 className="text-base font-semibold text-stone-900">{reason.title}</h3>
                  <p className="mt-1.5 text-sm leading-relaxed text-stone-600">{reason.body}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ---------- CTA + contacto ---------- */}
      <section id="contacto" className="scroll-mt-20 py-20 sm:py-24">
        <div className="mx-auto max-w-4xl px-4 sm:px-6">
          <div className="rounded-3xl border border-stone-200 bg-gradient-to-b from-brand-50 to-white p-8 text-center shadow-card sm:p-12">
            <h2 className="text-3xl font-semibold tracking-tight text-stone-900 sm:text-4xl">
              Veámoslo con tu negocio adelante
            </h2>
            {/* El texto sigue a lo que realmente se puede hacer: sin link de
                reserva cargado, no prometemos coordinar una reunión. */}
            <p className="mx-auto mt-4 max-w-xl text-lg leading-relaxed text-stone-600">
              {BOOKING_URL
                ? 'Reservá 20 minutos y lo recorremos juntos con tus productos y tus números. Si preferís, entrá ahora a la demo y mirala por tu cuenta.'
                : 'Entrá ahora a la demo y recorrela por tu cuenta, o escribinos y lo vemos juntos con los productos y los números de tu negocio.'}
            </p>

            <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
              <BookDemoButton />
              <TryDemoButton />
            </div>

            {HAS_CONTACT && (
              <>
                <p className="mt-10 text-sm text-stone-500">O escribinos directo</p>
                <ContactLinks className="mt-3 justify-center" />
              </>
            )}

            {!HAS_CONTACT && process.env.NODE_ENV === 'development' && (
              <p className="mt-8 rounded-xl bg-amber-50 px-4 py-3 text-sm text-amber-800">
                Configurá <code className="font-mono">NEXT_PUBLIC_BOOKING_URL</code>,{' '}
                <code className="font-mono">NEXT_PUBLIC_WHATSAPP</code> y{' '}
                <code className="font-mono">NEXT_PUBLIC_CONTACT_EMAIL</code> para activar los
                botones de contacto.
              </p>
            )}
          </div>
        </div>
      </section>

      {/* ---------- FAQ ---------- */}
      <section id="faq" className="scroll-mt-20 border-t border-stone-200 py-20 sm:py-24">
        <div className="mx-auto max-w-3xl px-4 sm:px-6">
          <SectionHeading eyebrow="Preguntas" title="Lo que nos preguntan siempre" />

          <div className="mt-12 divide-y divide-stone-200 border-y border-stone-200">
            {FAQS.map((faq) => (
              <details key={faq.q} className="group py-5">
                <summary className="flex cursor-pointer list-none items-center justify-between gap-4 text-base font-medium text-stone-900 [&::-webkit-details-marker]:hidden">
                  {faq.q}
                  <span className="shrink-0 text-stone-400 transition-transform group-open:rotate-45">
                    +
                  </span>
                </summary>
                <p className="mt-3 text-sm leading-relaxed text-stone-600">{faq.a}</p>
              </details>
            ))}
          </div>
        </div>
      </section>

      {/* ---------- Footer ---------- */}
      <footer className="border-t border-stone-200 bg-stone-50">
        <div className="mx-auto max-w-6xl px-4 py-12 sm:px-6">
          <div className="flex flex-col gap-8 sm:flex-row sm:items-start sm:justify-between">
            <div className="max-w-xs">
              <Logo size="sm" />
              <p className="mt-3 text-sm leading-relaxed text-stone-500">{APP_TAGLINE}.</p>
            </div>

            <div className="flex flex-wrap gap-10">
              <div>
                <h3 className="text-sm font-semibold text-stone-900">Producto</h3>
                <ul className="mt-3 space-y-2 text-sm">
                  <li>
                    <a href="#producto" className="text-stone-500 transition-colors hover:text-stone-900">
                      Qué incluye
                    </a>
                  </li>
                  <li>
                    <a href="#como-funciona" className="text-stone-500 transition-colors hover:text-stone-900">
                      Cómo funciona
                    </a>
                  </li>
                  <li>
                    <Link href="/catalogo" className="text-stone-500 transition-colors hover:text-stone-900">
                      Tienda de ejemplo
                    </Link>
                  </li>
                </ul>
              </div>

              <div>
                <h3 className="text-sm font-semibold text-stone-900">Contacto</h3>
                <ul className="mt-3 space-y-2 text-sm">
                  <li>
                    <a href="#contacto" className="text-stone-500 transition-colors hover:text-stone-900">
                      {BOOKING_URL ? 'Reservar una demo' : 'Ver la demo'}
                    </a>
                  </li>
                  {WHATSAPP_URL && (
                    <li>
                      <a
                        href={WHATSAPP_URL}
                        target="_blank"
                        rel="noreferrer"
                        className="text-stone-500 transition-colors hover:text-stone-900"
                      >
                        WhatsApp
                      </a>
                    </li>
                  )}
                  {CONTACT_EMAIL && (
                    <li>
                      <a
                        href={`mailto:${CONTACT_EMAIL}`}
                        className="text-stone-500 transition-colors hover:text-stone-900"
                      >
                        {CONTACT_EMAIL}
                      </a>
                    </li>
                  )}
                  <li>
                    <Link href="/login" className="text-stone-500 transition-colors hover:text-stone-900">
                      Ingresar
                    </Link>
                  </li>
                </ul>
              </div>
            </div>
          </div>

          <div className="mt-10 flex flex-wrap items-center justify-between gap-6 border-t border-stone-200 pt-6">
            <SovareCredit />
            <div className="flex flex-wrap items-center gap-4">
              <p className="text-xs text-stone-400">
                &copy; {new Date().getFullYear()} {APP_NAME}
              </p>
              <a
                href="#"
                className="inline-flex items-center gap-1 text-xs text-stone-400 transition-colors hover:text-stone-600"
              >
                Volver arriba <ArrowRight className="h-3 w-3 -rotate-90" />
              </a>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
