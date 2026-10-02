import { mailButton, mailLayout } from '@/lib/mailer';
import { escapeHtml, oneLine } from '@/lib/html';

/**
 * Los mails de una contratación.
 *
 * Son funciones puras que devuelven asunto, HTML y texto: no mandan nada. Así se
 * pueden mirar enteras sin depender de Resend, y lo que cada una dice se puede
 * revisar en un solo lugar. Todo lo que escribió un tercero (el nombre del
 * negocio, la persona) pasa por `escapeHtml` antes de entrar al HTML.
 *
 * Hay dos clases de plan y cada una tiene su propio mail, porque lo que se
 * promete es distinto:
 *
 *   - autoservicio (el Taller, sin puesta a punto): al aprobar el pago el cliente
 *     ya tiene su negocio creado. Lo que sigue es elegir su contraseña, cargar su
 *     catálogo y compartir su tienda. No hay instalación ni videollamada.
 *   - con puesta a punto (Negocio en adelante): lo que sigue es el formulario de
 *     alta, y después lo armamos nosotros.
 */

export interface MailContent {
  subject: string;
  html: string;
  text: string;
}

interface BaseContext {
  token: string;
  contactName: string | null;
  businessName: string;
  planLabel: string;
  /** La dirección del sitio, sin barra al final. Vacía si no está configurada. */
  siteUrl: string;
  /** Link de WhatsApp para consultas; vacío si no hay número cargado. */
  whatsappUrl: string;
}

const money = (value: number) =>
  new Intl.NumberFormat('es-AR', {
    style: 'currency',
    currency: 'ARS',
    maximumFractionDigits: 0,
  }).format(value);

function greeting(contactName: string | null): string {
  const first = contactName?.trim().split(/\s+/)[0];
  return first ? `Hola ${first},` : 'Hola,';
}

function statusUrl(ctx: BaseContext): string {
  return `${ctx.siteUrl}/contratar/${ctx.token}`;
}

function help(ctx: BaseContext): { html: string; text: string } {
  if (!ctx.whatsappUrl) return { html: '', text: '' };
  return {
    html: `<a href="${escapeHtml(ctx.whatsappUrl)}" style="color:#047857;">mandar un WhatsApp</a>`,
    text: ctx.whatsappUrl,
  };
}

// ============================================
// Aprobación: plan de autoservicio
// ============================================

export function buildSelfServiceApprovalMail(
  ctx: BaseContext & {
    amount: number;
    /** Dirección pública de su tienda; null si todavía no está activa. */
    storeUrl: string | null;
    /** La cuenta se creó y todavía no eligió su contraseña. */
    needsPassword: boolean;
  }
): MailContent {
  const saludo = greeting(ctx.contactName);
  const entrada = ctx.needsPassword ? statusUrl(ctx) : `${ctx.siteUrl}/login`;
  const boton = ctx.needsPassword ? 'Elegir mi contraseña' : 'Entrar a mi panel';
  const ayuda = help(ctx);

  const tienda = ctx.storeUrl
    ? `Tu tienda ya está online en <a href="${escapeHtml(ctx.storeUrl)}" style="color:#047857;">${escapeHtml(ctx.storeUrl.replace(/^https?:\/\//, ''))}</a>. Compartila con tus clientes cuando tengas cargados tus productos.`
    : 'Tu tienda online se activa en las próximas horas. Apenas esté lista te escribimos con la dirección.';
  const tiendaTexto = ctx.storeUrl
    ? `Tu tienda ya está online en ${ctx.storeUrl}. Compartila con tus clientes cuando tengas cargados tus productos.`
    : 'Tu tienda online se activa en las próximas horas. Apenas esté lista te escribimos con la dirección.';

  const body = `
    <p style="margin:0 0 16px;">${escapeHtml(saludo)}</p>
    <p style="margin:0 0 16px;">Recibimos tu transferencia de <strong>${money(ctx.amount)}</strong> y
    quedó confirmado el plan <strong>${escapeHtml(ctx.planLabel)}</strong> para
    <strong>${escapeHtml(ctx.businessName)}</strong>. Gracias por la confianza.</p>

    <p style="margin:0 0 16px;">Tu cuenta ya está creada. No hay que esperar a nadie para empezar.</p>

    <p style="margin:0 0 8px;"><strong>Lo que sigue</strong></p>
    <ol style="margin:0 0 20px;padding-left:20px;">
      <li style="margin-bottom:8px;">${ctx.needsPassword ? 'Elegí tu contraseña y entrá a tu panel.' : 'Entrá a tu panel con tu mail y tu contraseña.'}</li>
      <li style="margin-bottom:8px;">Cargá tus productos y tus precios. El panel trae una guía que te lleva
      por cada pantalla.</li>
      <li style="margin-bottom:8px;">${tienda}</li>
    </ol>

    <p style="margin:0 0 20px;">${mailButton(escapeHtml(entrada), boton)}</p>

    <p style="margin:0 0 16px;">En el plan Taller la carga del catálogo la hacés vos. Si te trabás en
    algún paso${ayuda.html ? `, podés ${ayuda.html} y te ayudamos` : ', escribinos y te ayudamos'}.</p>

    <p style="margin:0;">El estado de tu contratación lo podés ver siempre en
    <a href="${escapeHtml(statusUrl(ctx))}" style="color:#047857;">este link</a>. Guardalo.</p>
  `;

  const text = `${saludo}

Recibimos tu transferencia de ${money(ctx.amount)} y quedó confirmado el plan ${ctx.planLabel} para ${ctx.businessName}. Gracias por la confianza.

Tu cuenta ya está creada. No hay que esperar a nadie para empezar.

Lo que sigue:
1. ${ctx.needsPassword ? 'Elegí tu contraseña y entrá a tu panel' : 'Entrá a tu panel con tu mail y tu contraseña'}: ${entrada}
2. Cargá tus productos y tus precios. El panel trae una guía que te lleva por cada pantalla.
3. ${tiendaTexto}

En el plan Taller la carga del catálogo la hacés vos. Si te trabás en algún paso, escribinos${ayuda.text ? ` por WhatsApp: ${ayuda.text}` : ''} y te ayudamos.

El estado de tu contratación: ${statusUrl(ctx)}`;

  return {
    subject: 'Tu cuenta de GastroOS está lista',
    html: mailLayout({ title: '¡Listo! Tu cuenta está activa', body }),
    text,
  };
}

// ============================================
// Aprobación: autoservicio, pero la cuenta no se pudo crear sola
// ============================================

/**
 * El pago entró y la cuenta no salió sola (el mail ya tenía una cuenta, o falló
 * algo de nuestro lado). No se le promete lo que no está: se le dice que la
 * estamos terminando de preparar. Al dueño de SOVARE le llega el aviso aparte.
 */
export function buildSelfServicePendingMail(ctx: BaseContext & { amount: number }): MailContent {
  const saludo = greeting(ctx.contactName);
  const ayuda = help(ctx);

  const body = `
    <p style="margin:0 0 16px;">${escapeHtml(saludo)}</p>
    <p style="margin:0 0 16px;">Recibimos tu transferencia de <strong>${money(ctx.amount)}</strong> y
    quedó confirmado el plan <strong>${escapeHtml(ctx.planLabel)}</strong> para
    <strong>${escapeHtml(ctx.businessName)}</strong>. Gracias por la confianza.</p>
    <p style="margin:0 0 16px;">Estamos terminando de preparar tu cuenta. En unas horas te escribimos con
    el acceso${ayuda.html ? `; si necesitás algo antes, podés ${ayuda.html}` : ''}.</p>
    <p style="margin:0;">El estado de tu contratación lo podés ver siempre en
    <a href="${escapeHtml(statusUrl(ctx))}" style="color:#047857;">este link</a>. Guardalo.</p>
  `;

  const text = `${saludo}

Recibimos tu transferencia de ${money(ctx.amount)} y quedó confirmado el plan ${ctx.planLabel} para ${ctx.businessName}. Gracias por la confianza.

Estamos terminando de preparar tu cuenta. En unas horas te escribimos con el acceso.${ayuda.text ? ` Si necesitás algo antes, escribinos por WhatsApp: ${ayuda.text}` : ''}

El estado de tu contratación: ${statusUrl(ctx)}`;

  return {
    subject: 'Recibimos tu pago de GastroOS',
    html: mailLayout({ title: 'Recibimos tu pago', body }),
    text,
  };
}

// ============================================
// Aprobación: plan con puesta a punto
// ============================================

export function buildSetupApprovalMail(ctx: BaseContext & { amount: number }): MailContent {
  const saludo = greeting(ctx.contactName);
  const altaUrl = `${ctx.siteUrl}/alta/${ctx.token}`;
  const ayuda = help(ctx);

  const body = `
    <p style="margin:0 0 16px;">${escapeHtml(saludo)}</p>
    <p style="margin:0 0 16px;">Recibimos tu transferencia de <strong>${money(ctx.amount)}</strong> y
    quedó confirmada la contratación del plan <strong>${escapeHtml(ctx.planLabel)}</strong> para
    <strong>${escapeHtml(ctx.businessName)}</strong>. Gracias por la confianza.</p>

    <p style="margin:0 0 8px;"><strong>Lo que sigue</strong></p>
    <ol style="margin:0 0 20px;padding-left:20px;">
      <li style="margin-bottom:8px;">Completás el formulario de alta: son los datos con los que
      armamos tu instalación, o sea tu marca, tus colores, tu catálogo y tus horarios.</li>
      <li style="margin-bottom:8px;">Con eso montamos tu sistema y tu tienda. Te avisamos en cuanto
      esté para que lo veas.</li>
      <li style="margin-bottom:8px;">Hacemos una videollamada de capacitación con tu equipo y
      quedás andando.</li>
    </ol>

    <p style="margin:0 0 20px;">${mailButton(escapeHtml(altaUrl), 'Completar el formulario de alta')}</p>

    <p style="margin:0 0 16px;">Tarda unos diez minutos y se puede completar desde el teléfono.${
      ayuda.html ? ` Si preferís pasarnos los datos hablando, podés ${ayuda.html} y lo hacemos juntos.` : ''
    }</p>

    <p style="margin:0;">El estado de tu contratación lo podés ver siempre en
    <a href="${escapeHtml(statusUrl(ctx))}" style="color:#047857;">este link</a>. Guardalo.</p>
  `;

  const text = `${saludo}

Recibimos tu transferencia de ${money(ctx.amount)} y quedó confirmada la contratación del plan ${ctx.planLabel} para ${ctx.businessName}. Gracias por la confianza.

Lo que sigue:
1. Completás el formulario de alta: ${altaUrl}
2. Con eso montamos tu sistema y tu tienda, y te avisamos cuando esté.
3. Hacemos una videollamada de capacitación con tu equipo.

${ayuda.text ? `Si preferís pasarnos los datos hablando, escribinos por WhatsApp: ${ayuda.text}\n\n` : ''}El estado de tu contratación: ${statusUrl(ctx)}`;

  return {
    subject: 'Tu contratación de GastroOS está confirmada',
    html: mailLayout({ title: '¡Listo! Tu pago está confirmado', body }),
    text,
  };
}

// ============================================
// "Tu sistema está listo" (planes con puesta a punto)
// ============================================

export function buildReadyMail(
  ctx: BaseContext & {
    /** Dónde entra: el panel de siempre, o la dirección que le dejamos a mano. */
    entryUrl: string;
    entryLabel: string;
    storeUrl: string | null;
    /** Un renglón nuestro para este cliente; se escapa. */
    note: string | null;
  }
): MailContent {
  const saludo = greeting(ctx.contactName);
  const ayuda = help(ctx);
  const nota = ctx.note?.trim() || '';

  const body = `
    <p style="margin:0 0 16px;">${escapeHtml(saludo)}</p>
    <p style="margin:0 0 16px;">Terminamos de armar el sistema de <strong>${escapeHtml(ctx.businessName)}</strong>.
    Ya lo podés ver y usar.</p>

    ${nota ? `<p style="margin:0 0 16px;padding:12px 14px;background:#FBF5EA;border-radius:8px;font-size:14px;">${escapeHtml(nota)}</p>` : ''}

    <p style="margin:0 0 20px;">${mailButton(escapeHtml(ctx.entryUrl), escapeHtml(ctx.entryLabel))}</p>

    ${
      ctx.storeUrl
        ? `<p style="margin:0 0 16px;">Tu tienda está en <a href="${escapeHtml(ctx.storeUrl)}" style="color:#047857;">${escapeHtml(ctx.storeUrl.replace(/^https?:\/\//, ''))}</a>.</p>`
        : ''
    }

    <p style="margin:0 0 16px;"><strong>El próximo paso</strong> es la videollamada de capacitación con tu
    equipo, para que quedés andando.${
      ayuda.html ? ` Coordinamos el día y la hora por WhatsApp: ${ayuda.html}.` : ' Escribinos para coordinar el día y la hora.'
    }</p>

    <p style="margin:0;">El estado de tu contratación lo podés ver siempre en
    <a href="${escapeHtml(statusUrl(ctx))}" style="color:#047857;">este link</a>.</p>
  `;

  const text = `${saludo}

Terminamos de armar el sistema de ${ctx.businessName}. Ya lo podés ver y usar.
${nota ? `\n${nota}\n` : ''}
${ctx.entryLabel}: ${ctx.entryUrl}
${ctx.storeUrl ? `\nTu tienda: ${ctx.storeUrl}\n` : ''}
El próximo paso es la videollamada de capacitación con tu equipo. ${ayuda.text ? `Coordinamos por WhatsApp: ${ayuda.text}` : 'Escribinos para coordinar el día y la hora.'}

El estado de tu contratación: ${statusUrl(ctx)}`;

  return {
    subject: 'Tu sistema de GastroOS está listo',
    html: mailLayout({ title: '¡Tu sistema está listo!', body }),
    text,
  };
}

// ============================================
// Elegir una contraseña nueva
// ============================================

export function buildAccessMail(ctx: BaseContext): MailContent {
  const saludo = greeting(ctx.contactName);
  const url = statusUrl(ctx);

  const body = `
    <p style="margin:0 0 16px;">${escapeHtml(saludo)}</p>
    <p style="margin:0 0 16px;">Te dejamos el link para elegir una contraseña nueva para la cuenta de
    <strong>${escapeHtml(ctx.businessName)}</strong> en GastroOS.</p>
    <p style="margin:0 0 20px;">${mailButton(escapeHtml(url), 'Elegir mi contraseña')}</p>
    <p style="margin:0;font-size:14px;color:#565042;">Si no lo pediste, ignorá este mail: tu cuenta sigue como estaba.</p>
  `;

  const text = `${saludo}

Te dejamos el link para elegir una contraseña nueva para la cuenta de ${ctx.businessName} en GastroOS:

${url}

Si no lo pediste, ignorá este mail: tu cuenta sigue como estaba.`;

  return {
    subject: 'Elegí una contraseña nueva para GastroOS',
    html: mailLayout({ title: 'Elegí tu contraseña', body }),
    text,
  };
}

// ============================================
// Avisos para el dueño de SOVARE
// ============================================

export type OwnerAlertKind =
  | 'pago_aprobado'
  | 'pago_a_revisar'
  | 'alta_completa'
  | 'tienda_con_problema';

export interface OwnerAlertContext {
  kind: OwnerAlertKind;
  businessName: string;
  planLabel: string;
  amount: number;
  contactName: string | null;
  email: string;
  whatsapp: string | null;
  /** Qué pasó con la tienda o con la lectura del comprobante, en una oración. */
  detail: string | null;
  /** Dirección de la pantalla de la contratación en el panel; vacía si no está configurado. */
  reviewUrl: string;
}

const ALERT_TITLES: Record<OwnerAlertKind, { title: string; lead: string; cta: string }> = {
  pago_aprobado: {
    title: 'Pago aprobado',
    lead: 'La lectura automática aprobó el comprobante. No hace falta que hagas nada.',
    cta: 'Ver la contratación',
  },
  pago_a_revisar: {
    title: 'Comprobante para revisar',
    lead: 'La lectura automática no se animó a decidir. Mirá el comprobante y aprobalo o rechazalo.',
    cta: 'Revisar el comprobante',
  },
  alta_completa: {
    title: 'Alta completada',
    lead: 'Completó el formulario de alta. Ya tenés con qué armarle el sistema.',
    cta: 'Ver las respuestas',
  },
  tienda_con_problema: {
    title: 'La tienda no se pudo crear',
    lead: 'El pago está aprobado pero el negocio no se creó solo. Hay que resolverlo a mano.',
    cta: 'Abrir la contratación',
  },
};

export function buildOwnerAlert(ctx: OwnerAlertContext): MailContent {
  const meta = ALERT_TITLES[ctx.kind];
  const rows: [string, string | null][] = [
    ['Negocio', ctx.businessName],
    ['Plan', ctx.planLabel],
    ['Importe', money(ctx.amount)],
    ['Persona', ctx.contactName],
    ['Mail', ctx.email],
    ['WhatsApp', ctx.whatsapp],
    ['Detalle', ctx.detail],
  ];
  const filled = rows.filter((row): row is [string, string] => Boolean(row[1]));

  const html = mailLayout({
    title: escapeHtml(meta.title),
    body: `
      <p style="margin:0 0 16px;">${escapeHtml(meta.lead)}</p>
      <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="margin:0 0 20px;">
        ${filled
          .map(
            ([label, value]) => `
        <tr>
          <td style="padding:4px 12px 4px 0;font-size:13px;color:#9A9080;white-space:nowrap;vertical-align:top;">${label}</td>
          <td style="padding:4px 0;font-size:15px;color:#26302A;">${escapeHtml(value)}</td>
        </tr>`
          )
          .join('')}
      </table>
      ${ctx.reviewUrl ? `<p style="margin:0;">${mailButton(escapeHtml(ctx.reviewUrl), escapeHtml(meta.cta))}</p>` : ''}
    `,
    footer: 'Aviso automático de las contrataciones.',
  });

  const text = [
    `${meta.title}: ${ctx.businessName}`,
    meta.lead,
    '',
    ...filled.map(([label, value]) => `${label}: ${value}`),
    ...(ctx.reviewUrl ? ['', `${meta.cta}: ${ctx.reviewUrl}`] : []),
  ].join('\n');

  return {
    subject: `${meta.title}: ${oneLine(ctx.businessName, 45)}`,
    html,
    text,
  };
}
