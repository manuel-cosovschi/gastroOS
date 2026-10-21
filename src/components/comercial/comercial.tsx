/**
 * La página comercial de GastroOS.
 *
 * ==================================================================
 * A quién le habla
 * ==================================================================
 * A alguien que produce por encargo —tortas, viandas, catering, panificados— y
 * hoy anota los pedidos en WhatsApp, en un cuaderno y en la cabeza. Abre esto
 * desde un mensaje, en el celular, y decide en diez segundos si sigue. Eso
 * decide el tono: el problema con las palabras con las que él lo cuenta, una
 * idea por sección, y nada de jerga de software.
 *
 * ==================================================================
 * Por qué se rehízo
 * ==================================================================
 * La versión anterior tenía dieciséis secciones de texto claro sobre fondo
 * crema y casi tres mil palabras: correcta, y larga. El problema de una página
 * así no es que mienta, es que no se lee. Se rehízo con el molde de la página de
 * AlojaOS, el sistema hermano, y lo que se tomó es la forma:
 *
 *   · fondo oscuro con dos tonos que se alternan y una sola sección clara;
 *   · títulos en itálica negra y versales, con la mitad de la frase en el acento;
 *   · un rótulo chico arriba de cada título;
 *   · una idea por sección, dicha en una línea.
 *
 * Se fueron: «el problema» en prosa (quedó como preguntas), la tabla de
 * comparación, el «por qué elegirnos», el «qué no hace» (lo que se pregunta de
 * verdad quedó en las preguntas) y las cuatro cajas de texto de los precios.
 *
 * ==================================================================
 * Lo que esta página NO tiene, a propósito
 * ==================================================================
 * Testimonios, números de resultados («ahorrá 10 horas por semana») y «más de
 * X negocios confían». No tenemos nada de eso medido, y una página de venta con
 * un número inventado se cae con una sola pregunta. En su lugar va lo que sí
 * hay: un negocio real con nombre, tienda y redes; la demo abierta; y capturas y
 * videos del sistema andando, con la fecha a la vista. `npm run
 * prueba:comercial` falla si alguna de esas promesas aparece.
 */

import Image from 'next/image';
import { Check, Instagram } from 'lucide-react';
import { APP_NAME, APP_TAGLINE } from '@/lib/constants';
import {
  BOOKING_NOTE,
  BOOKING_URL,
  CASE_STUDY,
  CONTACT_EMAIL,
  DEMO_URL,
  EMAIL_URL,
  FAQS,
  WHATSAPP_URL,
} from '@/lib/marketing';
import { cn } from '@/lib/utils';
import { FONDO, TEXTO_CLARO } from '@/lib/comercial/tema';
import { Logo } from '@/components/brand/logo';
import { SovareCredit } from '@/components/brand/sovare';
import { ActivarAnimaciones } from './activar-animaciones';
import { ObservadorRevelar } from './revelar';
import { Calculadora } from './calculadora';
import { Precios } from './precios';
import { Captura, Marco, Telefono } from './pantallas';
import { DemoEmbebida, Video } from './video';
import { CAPTURAS_SACADAS_EL } from './capturas.generado';
import { VIDEOS_GRABADOS_EL } from './videos.generado';
import { Bajada, BotonPrincipal, BotonSecundario, Fila, Rotulo, Seccion, Tarjeta, Titulo } from './piezas';

const SECCIONES = [
  { id: 'producto', texto: 'Producto' },
  { id: 'demo', texto: 'Demo' },
  { id: 'caso', texto: 'Caso real' },
  { id: 'precios', texto: 'Precios' },
  { id: 'preguntas', texto: 'Preguntas' },
];

/** Una fecha `AAAA-MM-DD` como la lee alguien de acá. */
const comoFecha = (iso: string) => iso.split('-').reverse().join('/');

/**
 * El contacto principal. WhatsApp si está cargado; si no, el mail. Si no hay
 * ninguno, el botón no existe: un botón que no lleva a ningún lado es peor que
 * no tenerlo.
 */
const CONTACTO = WHATSAPP_URL || EMAIL_URL;
const TEXTO_CONTACTO = WHATSAPP_URL ? 'Hablemos por WhatsApp' : 'Escribinos';

export function Comercial() {
  return (
    <div className="bg-stone-900 text-stone-50">
      {/*
        El fondo oscuro tiene que llegar más allá de esta página. Sin esto,
        `body` se queda con el claro del resto del sistema y se ve en dos lados:
        cuando en un teléfono estirás el scroll más allá del final —aparece una
        franja clara abajo de una página oscura— y en la barra del navegador.

        `color-scheme: dark` es la otra mitad y se nota en la calculadora: las
        perillas son controles del sistema operativo, y sin esto se dibujan en su
        versión clara. `scroll-padding-top` es para los enlaces de la barra: sin
        él, el título de la sección queda debajo de la barra fija.
      */}
      <style>{`html{color-scheme:dark;scroll-padding-top:5rem}body{background:#26302A}`}</style>
      <ActivarAnimaciones />
      <ObservadorRevelar />

      <Navegacion />
      <main>
        <Hero />
        <Cinta />
        {/* Los precios, segundos: antes iban décimos y había que bajar ocho
            pantallas para saber cuánto sale. */}
        <Precios />
        <ElProblema />
        <ElCambio />
        <ElPanel />
        <DesdeElCelular />
        <LaDemo />
        <ElCaso />
        <LaCuenta />
        <ComoArrancamos />
        <Preguntas />
        <Cierre />
      </main>
      <Pie />
    </div>
  );
}

/* ==================================================================
   Las secciones
   ================================================================== */

function Navegacion() {
  return (
    <header className="sticky top-0 z-30 border-b border-white/[0.09] bg-stone-950/85 backdrop-blur">
      <nav aria-label="Principal" className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-3 sm:px-6">
        <a href="#arriba" aria-label={`${APP_NAME}, volver arriba`}>
          <Logo size="sm" tone="onDark" />
        </a>
        {/* Los enlaces se esconden en el celular: cinco enlaces apretados en 360
            píxeles no los toca nadie, y el que entra desde un mensaje scrollea. */}
        <ul className="hidden gap-7 text-[13px] font-semibold uppercase tracking-wider md:flex">
          {SECCIONES.map((s) => (
            <li key={s.id}>
              <a href={`#${s.id}`} className="text-stone-300 transition-colors hover:text-stone-50">
                {s.texto}
              </a>
            </li>
          ))}
        </ul>
        <div className="flex items-center gap-4">
          <a href="/login" className="hidden text-[13px] font-semibold text-stone-300 transition-colors hover:text-stone-50 sm:block">
            Entrar
          </a>
          <a
            href={DEMO_URL}
            className="rounded-xl bg-brand-400 px-4 py-2 text-[13px] font-bold text-stone-950 transition-colors hover:bg-brand-300"
          >
            Probar la demo
          </a>
        </div>
      </nav>
    </header>
  );
}

function Hero() {
  return (
    <section id="arriba" className="relative overflow-hidden px-4 pb-16 pt-12 sm:px-6 md:pb-24 md:pt-20">
      {/* El resplandor: un degradado y no una imagen. Pesa cero y no hay que
          acordarse de optimizarlo. */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(56rem_30rem_at_70%_15%,rgba(224,138,107,0.13),transparent_60%)]"
      />

      {/* El hero NO lleva `data-revelar`: lo que se esconde se revela recién al
          hidratar, y lo primero que se ve tiene que estar desde el primer
          cuadro. */}
      <div className="relative mx-auto grid max-w-6xl items-center gap-12 lg:grid-cols-[1.1fr_0.9fr]">
        <div>
          <p className="inline-flex items-center gap-2 rounded-full border border-brand-400/30 bg-brand-400/10 px-3.5 py-1.5 text-[11px] font-bold uppercase tracking-[0.2em] text-brand-300">
            <span className="h-1.5 w-1.5 rounded-full bg-brand-400" aria-hidden />
            Para negocios que trabajan por encargo
          </p>

          <div className="mt-6">
            <Titulo como="h1" acento="en una sola pantalla">
              Los pedidos que hoy viven en tu WhatsApp,
            </Titulo>
          </div>

          <p className="mt-6 max-w-xl text-lg font-semibold leading-snug text-stone-50">
            Pedidos, clientes, stock y lo que te queda de cada venta.
          </p>
          <Bajada className="mt-3 max-w-xl">
            Cargás el encargo cuando te escriben, y el sistema te dice qué entregás cada
            día, qué te falta comprar y cuánto ganaste. Se usa desde el celular.
          </Bajada>

          <div className="mt-8 flex flex-wrap gap-3">
            <BotonPrincipal href={DEMO_URL}>Probar la demo</BotonPrincipal>
            <BotonSecundario href="#precios">Ver los precios</BotonSecundario>
          </div>

          <ul className="mt-8 flex flex-wrap gap-x-6 gap-y-2 text-[13px] font-semibold text-stone-100">
            {['Sin porcentaje sobre tus ventas', 'Sin permanencia', 'Desde $15.000 por mes'].map((t) => (
              <li key={t} className="flex items-center gap-2">
                <Check className="h-4 w-4 text-brand-400" aria-hidden />
                {t}
              </li>
            ))}
          </ul>

          <p className="mt-6 text-sm text-stone-300">
            Pastelerías, panaderías, viandas, catering y dark kitchens.
          </p>
        </div>

        <div>
          <Telefono>
            <Captura cual="telefono-inicio" prioridad sizes="(max-width: 1024px) 80vw, 290px" />
          </Telefono>
          <p className="mt-4 text-center text-xs text-stone-300">
            Captura de la demo del {comoFecha(CAPTURAS_SACADAS_EL)}.{' '}
            <a className="underline underline-offset-2 hover:text-stone-50" href={DEMO_URL}>
              Abrila y comparala
            </a>
            .
          </p>
        </div>
      </div>
    </section>
  );
}

/**
 * La cinta: la frase que resume por qué alguien contrata esto, moviéndose sola.
 * Con `prefers-reduced-motion` se queda quieta.
 */
function Cinta() {
  const frase = 'Nadie quiere un sistema de gestión. Quiere dejar de perder pedidos.';
  return (
    <div className={cn('overflow-hidden border-y border-white/[0.09] py-5', FONDO.hondo)}>
      {/* La frase va ocho veces para que la cinta no se corte, y las ocho están
          `aria-hidden`: para un lector de pantalla serían ocho veces la misma
          frase. Se dice una sola vez acá, donde ninguna pantalla la muestra. */}
      <p className="sr-only">{frase}</p>
      <div className="cinta flex w-max gap-10 whitespace-nowrap" aria-hidden>
        {[0, 1].map((juego) => (
          <div key={juego} className="flex gap-10">
            {[0, 1, 2, 3].map((i) => (
              <span key={i} className="flex items-center gap-10 text-sm font-bold uppercase tracking-[0.18em] text-stone-300">
                {frase}
                <span className="h-1.5 w-1.5 rounded-full bg-brand-400" />
              </span>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}

function ElProblema() {
  const preguntas = [
    '¿Un pedido quedó en un chat y te acordaste el día de la entrega?',
    '¿Buscás el precio de una torta en una conversación de hace dos meses?',
    '¿Te quedaste sin chocolate justo la semana de más pedidos?',
    '¿Facturás bien, pero a fin de mes no sabés si ganaste?',
    '¿Anotás en el cuaderno, en el Excel y en la cabeza, todo a la vez?',
    '¿No sabés cuánto te cuesta de verdad hacer cada producto?',
  ];

  return (
    <Seccion id="problema">
      <div data-revelar="pendiente">
        <Rotulo centrado>¿Te suena?</Rotulo>
        <div className="mt-4">
          <Titulo centrado acento="esto es para vos">
            Si contestaste que sí,
          </Titulo>
        </div>
      </div>

      <ul className="mt-12 grid gap-4 md:grid-cols-2">
        {preguntas.map((p, i) => (
          <li key={p} data-revelar="pendiente" style={{ transitionDelay: `${i * 60}ms` }}>
            <Tarjeta className="h-full text-[15px] leading-relaxed text-stone-100">{p}</Tarjeta>
          </li>
        ))}
      </ul>
    </Seccion>
  );
}

/**
 * El antes y el después, y la única sección clara de la página: corta el bloque
 * oscuro por el medio y marca que acá hay un cambio de estado.
 */
function ElCambio() {
  const antes = [
    'Revisás WhatsApp para ver qué quedó sin contestar',
    'Un pedido se te pasa porque estaba en otro chat',
    'Te olvidás del chocolate en la compra, otra vez',
    'A la noche sumás con la calculadora',
    'A fin de mes no sabés si ganaste o sólo facturaste',
  ];
  const despues = [
    'Abrís y ves lo que entregás hoy, ordenado por hora',
    'El pedido queda cargado mientras hablás con el cliente',
    'La lista de compra sale de lo que está bajo el mínimo',
    'La facturación del día ya está hecha',
    'Ves la ganancia y el margen, con contra qué comparar',
  ];

  return (
    <section className={cn('border-t border-white/[0.09] px-4 py-20 sm:px-6 md:py-28', FONDO.claro)}>
      <div className="mx-auto max-w-5xl">
        <div data-revelar="pendiente">
          <Rotulo centrado claro>
            Un día cualquiera
          </Rotulo>
          <div className="mt-4">
            <Titulo centrado claro acento="pero anotado">
              Lo mismo de siempre,
            </Titulo>
          </div>
        </div>

        <div className="mt-12 grid gap-6 md:grid-cols-2">
          <div data-revelar="pendiente" className="rounded-2xl border border-stone-200 bg-white p-6">
            <h3 className={cn('text-[11px] font-bold uppercase tracking-[0.2em]', TEXTO_CLARO.suave)}>Hoy</h3>
            <ul className="mt-5 space-y-3.5">
              {antes.map((t) => (
                <li key={t} className={cn('flex gap-3 text-[15px] leading-snug', TEXTO_CLARO.suave)}>
                  <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-stone-400" aria-hidden />
                  {t}
                </li>
              ))}
            </ul>
          </div>
          <div
            data-revelar="pendiente"
            style={{ transitionDelay: '120ms' }}
            className="rounded-2xl border border-brand-700/25 bg-white p-6 shadow-[0_12px_40px_rgba(38,48,42,0.10)]"
          >
            <h3 className={cn('text-[11px] font-bold uppercase tracking-[0.2em]', TEXTO_CLARO.acento)}>Con GastroOS</h3>
            <ul className="mt-5 space-y-3.5">
              {despues.map((t) => (
                <li key={t} className={cn('flex gap-3 text-[15px] font-semibold leading-snug', TEXTO_CLARO.fuerte)}>
                  <Check className="mt-0.5 h-4 w-4 shrink-0 text-brand-700" aria-hidden />
                  {t}
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>
    </section>
  );
}

function ElPanel() {
  return (
    <Seccion id="producto">
      <div className="grid items-center gap-12 lg:grid-cols-[0.85fr_1.15fr]">
        <div data-revelar="pendiente">
          <Rotulo>El producto</Rotulo>
          <div className="mt-4">
            <Titulo acento="en una pantalla">Todo el negocio,</Titulo>
          </div>
          <Bajada className="mt-5 max-w-lg">
            Cargás un pedido y el resto se acomoda solo: el cliente queda guardado, el stock
            se descuenta y las estadísticas se actualizan.
          </Bajada>
          <ul className="mt-7 space-y-2.5">
            {[
              'Pedidos con seña, saldo y fecha de entrega',
              'Calendario de lo que sale cada día',
              'Stock por receta, con aviso antes de que falte',
              'Costo real de cada producto y margen',
              'Tienda online con tu nombre, si la querés',
            ].map((t) => (
              <Fila key={t}>{t}</Fila>
            ))}
          </ul>
        </div>

        <div className="space-y-5" data-revelar="pendiente" style={{ transitionDelay: '120ms' }}>
          <Marco>
            <Captura cual="panel-inicio" sizes="(max-width: 1024px) 92vw, 620px" />
          </Marco>
          <div className="grid grid-cols-2 gap-5">
            <Marco>
              <Captura cual="estadisticas" sizes="(max-width: 1024px) 46vw, 300px" />
            </Marco>
            <Marco>
              <Captura cual="stock" sizes="(max-width: 1024px) 46vw, 300px" />
            </Marco>
          </div>
          <p className="text-sm text-stone-300">
            Capturas de la demo del {comoFecha(CAPTURAS_SACADAS_EL)}, con una pastelería de
            ejemplo.{' '}
            <a className="underline underline-offset-2 hover:text-stone-50" href="#demo">
              Probala vos
            </a>
            .
          </p>
        </div>
      </div>
    </Seccion>
  );
}

function DesdeElCelular() {
  return (
    <Seccion hondo>
      <div className="grid items-center gap-12 lg:grid-cols-2">
        <div className="order-2 lg:order-1" data-revelar="pendiente">
          <Telefono>
            <Video cual="pedido" />
          </Telefono>
          <p className="mt-4 text-center text-xs text-stone-300">
            Grabado el {comoFecha(VIDEOS_GRABADOS_EL)} contra la demo, sin cortes ni
            acelerado.
          </p>
        </div>

        <div className="order-1 lg:order-2" data-revelar="pendiente" style={{ transitionDelay: '100ms' }}>
          <Rotulo>Desde el celular</Rotulo>
          <div className="mt-4">
            <Titulo acento="mientras te escriben">Cargá el pedido</Titulo>
          </div>
          <Bajada className="mt-5 max-w-lg">
            El negocio no pasa sentado frente a una computadora. El cliente, la fecha, los
            productos y listo: el total y la seña se calculan solos.
          </Bajada>
          <ul className="mt-7 space-y-2.5">
            {['Las entregas del día, ordenadas por hora', 'Cambiar el estado de un pedido', 'El historial de cada cliente'].map(
              (t) => (
                <Fila key={t}>{t}</Fila>
              )
            )}
          </ul>
          <div className="mt-8 max-w-lg">
            <Marco>
              <Captura cual="pedido-nuevo" sizes="(max-width: 1024px) 92vw, 520px" />
            </Marco>
            <p className="mt-3 text-sm text-stone-300">La misma pantalla, en la computadora.</p>
          </div>
        </div>
      </div>
    </Seccion>
  );
}

/**
 * La demo, adentro de la página. Es lo único que no hay que creer: no es una
 * captura ni un video, es el sistema corriendo adentro de un marco.
 *
 * Va después del producto: el que llegó hasta acá ya vio qué hace, y ahora
 * puede comprobarlo.
 */
function LaDemo() {
  return (
    <Seccion id="demo" ancho="max-w-4xl">
      <div data-revelar="pendiente">
        <Rotulo centrado>Sin registrarte ni dejar un dato</Rotulo>
        <div className="mt-4">
          <Titulo centrado acento="probalo acá mismo">
            No hace falta que nos creas:
          </Titulo>
        </div>
        <Bajada centrado className="mt-5 max-w-2xl">
          Te armamos una copia propia de una pastelería de ejemplo, con sus pedidos, su
          stock y sus números. Cambiá lo que quieras: nadie más la ve.
        </Bajada>
      </div>

      <div className="mt-10" data-revelar="pendiente">
        <div className="mx-auto w-full max-w-[400px] overflow-hidden rounded-[2rem] border border-white/[0.09] bg-stone-950 p-2.5 shadow-[0_26px_60px_rgba(0,0,0,0.45)]">
          <div className="overflow-hidden rounded-[1.5rem]">
            <DemoEmbebida direccion={DEMO_URL} />
          </div>
        </div>
        <p className="mt-5 text-center text-sm text-stone-300">
          ¿Preferís verla en grande?{' '}
          <a className="underline underline-offset-2 hover:text-stone-50" href={DEMO_URL} target="_blank" rel="noopener">
            Abrila en otra pestaña
          </a>
          .
        </p>
      </div>
    </Seccion>
  );
}

function ElCaso() {
  return (
    <Seccion id="caso" hondo>
      <div className="grid items-center gap-12 lg:grid-cols-2">
        <div data-revelar="pendiente">
          <Rotulo>Un negocio de verdad</Rotulo>
          <div className="mt-4">
            <Titulo acento="con este sistema">COSOV. toma sus pedidos</Titulo>
          </div>
          <Bajada className="mt-5">{CASE_STUDY.lead}</Bajada>
          <Bajada className="mt-4">{CASE_STUDY.outcome}</Bajada>

          <div className="mt-7 flex flex-wrap gap-3">
            <BotonSecundario href={CASE_STUDY.storefront.url}>{CASE_STUDY.storefront.cta}</BotonSecundario>
            {CASE_STUDY.social.links.map((red) => (
              <a
                key={red.network}
                href={red.url}
                target="_blank"
                rel="noopener"
                aria-label={`${red.network} de COSOV.: ${red.handle}`}
                className="inline-flex items-center gap-2 rounded-xl border border-white/20 px-5 py-3.5 text-[15px] font-bold text-stone-50 transition-colors hover:bg-white/[0.06]"
              >
                <Instagram className="h-4 w-4" aria-hidden />
                {red.handle}
              </a>
            ))}
          </div>
          <p className="mt-4 text-sm text-stone-300">
            Es un negocio real y los pedidos de su tienda son de verdad: si entrás, mirá sin
            comprar. Para tocar sin consecuencias está{' '}
            <a className="underline underline-offset-2 hover:text-stone-50" href="#demo">
              la demo
            </a>
            .
          </p>
        </div>

        <figure data-revelar="pendiente" style={{ transitionDelay: '120ms' }}>
          <Marco>
            {/* La tienda de COSOV. es pública: la captura muestra productos y
                precios, que cualquiera ve entrando. Su panel no se muestra:
                tiene sus clientes, sus pedidos y su facturación. */}
            <Image
              src={CASE_STUDY.storefront.image}
              alt={CASE_STUDY.storefront.alt}
              width={1280}
              height={820}
              sizes="(max-width: 1024px) 92vw, 560px"
              className="h-auto w-full"
            />
          </Marco>
          <figcaption className="mt-3 text-sm text-stone-300">{CASE_STUDY.storefront.caption}</figcaption>
        </figure>
      </div>
    </Seccion>
  );
}

function LaCuenta() {
  return (
    <Seccion id="calculadora">
      <div data-revelar="pendiente">
        <Rotulo centrado>La cuenta</Rotulo>
        <div className="mt-4">
          <Titulo centrado acento="no tener el número?">¿Cuánto te cuesta</Titulo>
        </div>
        <Bajada centrado className="mt-5 max-w-2xl">
          Movelo con tus números. No te pedimos el mail para ver el resultado.
        </Bajada>
      </div>
      <div className="mt-12" data-revelar="pendiente">
        <Calculadora />
      </div>
    </Seccion>
  );
}

function ComoArrancamos() {
  const pasos = [
    {
      titulo: 'Una charla de veinte minutos',
      texto: 'Qué vendés, cómo te entran los pedidos y qué te duele. De ahí sale qué plan te conviene.',
    },
    {
      titulo: 'Te lo dejamos cargado',
      texto: 'Del plan Negocio para arriba cargamos tu catálogo, tus precios, tus insumos y tus clientes. En el Taller lo cargás vos con una guía, y arrancás el mismo día.',
    },
    {
      titulo: 'Lo usás con tu equipo',
      texto: 'Una sesión de capacitación incluida en la puesta a punto, y soporte por WhatsApp del plan Negocio para arriba.',
    },
  ];

  return (
    <Seccion hondo>
      <div data-revelar="pendiente">
        <Rotulo centrado>Cómo arrancamos</Rotulo>
        <div className="mt-4">
          <Titulo centrado acento="andando">
            De la primera charla a tu negocio
          </Titulo>
        </div>
      </div>
      <ol className="mt-12 grid gap-5 md:grid-cols-3">
        {pasos.map((p, i) => (
          <li key={p.titulo} data-revelar="pendiente" style={{ transitionDelay: `${i * 90}ms` }}>
            <Tarjeta className="h-full">
              <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-brand-400/15 text-sm font-black text-brand-300">
                {i + 1}
              </span>
              <h3 className="mt-4 text-[17px] font-bold uppercase tracking-tight text-stone-50">{p.titulo}</h3>
              <p className="mt-2 text-sm leading-relaxed text-stone-300">{p.texto}</p>
            </Tarjeta>
          </li>
        ))}
      </ol>
    </Seccion>
  );
}

function Preguntas() {
  return (
    <Seccion id="preguntas" ancho="max-w-3xl">
      <div data-revelar="pendiente">
        <Rotulo centrado>Preguntas</Rotulo>
        <div className="mt-4">
          <Titulo centrado acento="preguntan">
            Lo que nos
          </Titulo>
        </div>
      </div>

      {/* `details` y no un acordeón de JavaScript: se abre sin hidratar, el
          buscador del navegador encuentra el texto adentro y anda con el
          JavaScript apagado. */}
      <div className="mt-12 space-y-3">
        {FAQS.map((f) => (
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
  );
}

function Cierre() {
  return (
    <section className={cn('relative overflow-hidden border-t border-white/[0.09] px-4 py-24 sm:px-6 md:py-32', FONDO.hondo)}>
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(44rem_24rem_at_50%_0%,rgba(224,138,107,0.14),transparent_65%)]"
      />
      <div className="relative mx-auto max-w-3xl text-center" data-revelar="pendiente">
        <Titulo centrado acento="no se pierda en un chat">
          Que el próximo pedido
        </Titulo>
        <Bajada centrado className="mt-6 max-w-xl">
          Entrá a la demo ahora, o lo vemos juntos con tus productos y tus números
          adelante.
        </Bajada>
        <div className="mt-9 flex flex-wrap justify-center gap-3">
          <BotonPrincipal href={DEMO_URL}>Probar la demo</BotonPrincipal>
          {BOOKING_URL && <BotonSecundario href={BOOKING_URL}>Reservar una reunión</BotonSecundario>}
          {CONTACTO && <BotonSecundario href={CONTACTO}>{TEXTO_CONTACTO}</BotonSecundario>}
        </div>
        {BOOKING_URL && (
          <p className="mt-5 text-sm text-stone-300">
            La reunión es una videollamada de 20 minutos. {BOOKING_NOTE}
          </p>
        )}
      </div>
    </section>
  );
}

function Pie() {
  return (
    <footer className={cn('border-t border-white/[0.09] px-4 py-12 sm:px-6', FONDO.base)}>
      <div className="mx-auto flex max-w-6xl flex-wrap items-start justify-between gap-8">
        <div className="max-w-xs">
          <Logo size="sm" tone="onDark" />
          <p className="mt-3 text-sm text-stone-300">{APP_TAGLINE}.</p>
        </div>
        <ul className="flex flex-wrap gap-x-6 gap-y-3 text-sm">
          {WHATSAPP_URL && (
            <li>
              <a className="text-stone-300 hover:text-stone-50" href={WHATSAPP_URL} target="_blank" rel="noopener">
                WhatsApp
              </a>
            </li>
          )}
          {CONTACT_EMAIL && (
            <li>
              <a className="text-stone-300 hover:text-stone-50" href={`mailto:${CONTACT_EMAIL}`}>
                {CONTACT_EMAIL}
              </a>
            </li>
          )}
          <li>
            <a className="text-stone-300 hover:text-stone-50" href={CASE_STUDY.storefront.url} target="_blank" rel="noopener">
              Tienda de un cliente
            </a>
          </li>
          <li>
            <a className="text-stone-300 hover:text-stone-50" href="/login">
              Entrar
            </a>
          </li>
        </ul>
      </div>
      <div className="mx-auto mt-10 flex max-w-6xl flex-wrap items-center justify-between gap-4 border-t border-white/[0.09] pt-6">
        <SovareCredit tone="onDark" />
        <p className="text-xs text-stone-300">
          © {new Date().getFullYear()} {APP_NAME}
        </p>
      </div>
    </footer>
  );
}
