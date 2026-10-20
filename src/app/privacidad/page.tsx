import type { Metadata } from 'next';
import { CONTACT_EMAIL } from '@/lib/marketing';

/**
 * Qué datos se juntan y para qué. Escrito en castellano llano y sólo con lo que
 * el sistema hace de verdad: si mañana se agrega una herramienta de medición,
 * esta página se actualiza en el mismo cambio.
 */

export const metadata: Metadata = { title: 'Privacidad' };

const MEDICION = Boolean(process.env.NEXT_PUBLIC_META_PIXEL_ID || process.env.NEXT_PUBLIC_GA4_ID);

export default function Privacidad() {
  return (
    <main className="mx-auto max-w-2xl px-4 py-16 text-stone-800 sm:px-6">
      <h1 className="font-display text-3xl font-bold text-stone-900">Privacidad</h1>
      <div className="mt-6 space-y-5 leading-relaxed">
        <p>
          GastroOS es un producto de SOVARE. Esta página cuenta qué datos juntamos en gastroos.shop y para qué.
        </p>
        <h2 className="pt-2 text-lg font-semibold text-stone-900">Si nos dejás una consulta</h2>
        <p>
          Guardamos tu nombre, el de tu negocio, tu WhatsApp o mail y lo que nos escribas, junto con la campaña por la
          que llegaste. Los usamos sólo para contestarte. No los vendemos, no los compartimos y no te sumamos a ninguna
          lista de envíos.
        </p>
        <h2 className="pt-2 text-lg font-semibold text-stone-900">Si contratás</h2>
        <p>
          Guardamos los datos de tu negocio y el comprobante de pago para dar de alta el servicio y llevar la facturación
          del plan. Los datos que cargues en tu sistema —clientes, pedidos, precios— son tuyos: ningún otro negocio los
          ve, y si te vas te los llevás.
        </p>
        <h2 className="pt-2 text-lg font-semibold text-stone-900">Medición de anuncios</h2>
        <p>
          {MEDICION
            ? 'En las páginas de venta usamos herramientas de medición de Meta y/o Google para saber qué anuncios funcionan. Reciben qué páginas visitaste y qué botones tocaste, nunca tu nombre, teléfono ni mail.'
            : 'Hoy no usamos herramientas de medición de terceros. Guardamos en tu navegador, en una cookie propia, la campaña por la que llegaste, para saber qué anuncios funcionan.'}
        </p>
        <h2 className="pt-2 text-lg font-semibold text-stone-900">Tus derechos</h2>
        <p>
          Podés pedirnos ver, corregir o borrar tus datos cuando quieras
          {CONTACT_EMAIL ? (
            <>
              , escribiendo a <a className="underline" href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a>
            </>
          ) : null}
          . La Agencia de Acceso a la Información Pública es el órgano de control de la Ley 25.326 de Protección de Datos
          Personales.
        </p>
      </div>
    </main>
  );
}
