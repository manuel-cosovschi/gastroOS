'use server';

import { randomUUID } from 'node:crypto';
import { cookies, headers } from 'next/headers';
import { createSovareClient } from '@/lib/supabase/service';
import { mailLayout, mailerConfigured, sendMail } from '@/lib/mailer';
import { CONTACT_EMAIL, SITE_URL } from '@/lib/marketing';
import { atribucionDeCookie, COOKIE_ATRIBUCION, resumenDeAtribucion } from '@/lib/conv/atribucion';
import { eventoAMeta } from '@/lib/conv/meta-servidor';
import { TIPOS_DE_CONSULTA } from '@/lib/conv/consulta';

/**
 * La consulta de la página de conversión: «preferís que te llamemos».
 *
 * Va a `sovare.clients` como prospecto, la misma tabla que el panel de SOVARE
 * muestra en Prospección. No hay una tabla nueva de leads a propósito: un lead
 * de un anuncio y un prospecto cargado a mano son la misma cosa —alguien a
 * quien hay que escribirle—, y tenerlos en dos lugares es la forma de que uno
 * quede sin contestar.
 *
 * La regla que manda: **`ok: true` sólo si la fila se guardó**. Si la base
 * falla, el visitante ve un error y puede reintentar; nunca un «¡listo!» que no
 * llegó a ningún lado. El mail de aviso, en cambio, es aparte: si falla, la
 * consulta igual quedó guardada y está en el panel.
 */

export type ResultadoConsulta =
  | { ok: true; eventId: string }
  | { ok: false; error: string; campo?: 'nombre' | 'negocio' | 'contacto' };

const largo = (v: FormDataEntryValue | null, max: number) => String(v ?? '').trim().slice(0, max);

export async function enviarConsulta(form: FormData): Promise<ResultadoConsulta> {
  // El campo trampa: invisible para una persona, irresistible para un robot.
  // Al robot se le contesta que salió bien, para que no aprenda a esquivarlo.
  if (largo(form.get('sitio_web'), 200)) return { ok: true, eventId: randomUUID() };

  const nombre = largo(form.get('nombre'), 120);
  const negocio = largo(form.get('negocio'), 160);
  const contacto = largo(form.get('contacto'), 160);
  const tipo = largo(form.get('tipo'), 20) as keyof typeof TIPOS_DE_CONSULTA;
  const mensaje = largo(form.get('mensaje'), 1500);

  if (nombre.length < 2) return { ok: false, error: 'Decinos tu nombre.', campo: 'nombre' };
  if (negocio.length < 2) return { ok: false, error: 'Decinos cómo se llama tu negocio.', campo: 'negocio' };

  const esMail = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(contacto);
  const digitos = contacto.replace(/\D/g, '');
  const esTelefono = digitos.length >= 8 && digitos.length <= 15;
  if (!esMail && !esTelefono) {
    return { ok: false, error: 'Dejanos un WhatsApp o un mail para poder contestarte.', campo: 'contacto' };
  }

  const sovare = createSovareClient();
  if (!sovare) {
    console.error('[conv] falta SUPABASE_SERVICE_ROLE_KEY: no se puede guardar la consulta');
    return { ok: false, error: 'No pudimos recibir tu consulta. Probá de nuevo en un momento o escribinos por WhatsApp.' };
  }

  const jar = await cookies();
  const atribucion = atribucionDeCookie(jar.get(COOKIE_ATRIBUCION)?.value);
  const origen = resumenDeAtribucion(atribucion);
  const tipoTexto = TIPOS_DE_CONSULTA[tipo] ?? 'Consulta';

  const { error } = await sovare.from('clients').insert({
    business_name: negocio,
    contact_name: nombre,
    whatsapp: esTelefono ? contacto : null,
    email: esMail ? contacto.toLowerCase() : null,
    status: 'prospecto',
    source: `GastroOS /conv · ${origen}`.slice(0, 160),
    notes: [
      `Pidió: ${tipoTexto}.`,
      mensaje && `Mensaje: ${mensaje}`,
      `Campaña: ${origen}${atribucion.variante ? ` · variante ${atribucion.variante}` : ''}.`,
      `Entró por la página de conversión de GastroOS. Quiere que le escriban: no es un contacto en frío.`,
    ]
      .filter(Boolean)
      .join('\n'),
  });

  if (error) {
    console.error('[conv] no se pudo guardar la consulta:', error.message);
    return { ok: false, error: 'No pudimos recibir tu consulta. Probá de nuevo en un momento o escribinos por WhatsApp.' };
  }

  const eventId = randomUUID();
  const h = await headers();

  // Lo que sigue no cambia la respuesta: la consulta ya está guardada.
  await Promise.allSettled([
    avisarPorMail({ nombre, negocio, contacto, tipoTexto, mensaje, origen }),
    eventoAMeta({
      evento: 'Lead',
      eventId,
      url: `${SITE_URL || 'https://gastroos.shop'}/conv`,
      fbp: jar.get('_fbp')?.value,
      fbc: jar.get('_fbc')?.value,
      navegador: h.get('user-agent') ?? undefined,
      datos: { producto: 'gastroos', tipo, utm_campaign: atribucion.utm_campaign },
    }).then((r) => {
      if (!r.enviado && r.motivo && !r.motivo.startsWith('sin ')) console.error('[conv] evento a Meta:', r.motivo);
    }),
  ]);

  return { ok: true, eventId };
}

async function avisarPorMail(d: {
  nombre: string;
  negocio: string;
  contacto: string;
  tipoTexto: string;
  mensaje: string;
  origen: string;
}) {
  const para = process.env.CONV_AVISO_A?.trim() || CONTACT_EMAIL;
  if (!para || !mailerConfigured()) {
    console.warn('[conv] consulta guardada sin aviso por mail: falta CONV_AVISO_A/NEXT_PUBLIC_CONTACT_EMAIL o el proveedor de mail');
    return;
  }
  const escapar = (s: string) => s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]!);
  const filas = [
    ['Nombre', d.nombre],
    ['Negocio', d.negocio],
    ['Contacto', d.contacto],
    ['Pidió', d.tipoTexto],
    ['Campaña', d.origen],
    ...(d.mensaje ? [['Mensaje', d.mensaje]] : []),
  ];
  const r = await sendMail({
    to: para,
    subject: `Consulta de GastroOS: ${d.negocio}`,
    text: filas.map(([k, v]) => `${k}: ${v}`).join('\n') + '\n\nEstá en el panel de SOVARE, en Prospección.',
    html: mailLayout({
      title: 'Nueva consulta desde la página de GastroOS',
      body: `<table>${filas.map(([k, v]) => `<tr><td style="padding:4px 12px 4px 0;color:#6B6454">${k}</td><td style="padding:4px 0"><strong>${escapar(v)}</strong></td></tr>`).join('')}</table><p>Está en el panel de SOVARE, en Prospección.</p>`,
    }),
  });
  if (!r.sent) console.error('[conv] no salió el aviso por mail:', r.reason);
}
