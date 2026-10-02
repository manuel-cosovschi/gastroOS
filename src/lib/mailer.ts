/**
 * Envío de mail por Resend.
 *
 * Va con `fetch` y no con el SDK: es una sola llamada HTTP y no justifica una
 * dependencia más en un proyecto que se forkea por cliente.
 *
 * Si no está configurado no tira: devuelve `sent: false` con el motivo. El
 * llamador decide qué hacer, y en la contratación lo que hace es dejar la
 * aprobación igual y mostrar el aviso en el panel, para que el mail se pueda
 * mandar a mano. Un mail que no sale no puede hacer que se pierda un pago que
 * ya entró.
 */

// `RESEND_API_URL` existe para las pruebas locales, que apuntan a un servidor de
// juguete en vez de mandar mails de verdad. En producción no se define.
const RESEND_URL = process.env.RESEND_API_URL || 'https://api.resend.com/emails';

export interface MailResult {
  sent: boolean;
  reason?: string;
}

export function mailerConfigured(): boolean {
  return Boolean(process.env.RESEND_API_KEY && process.env.MAIL_FROM);
}

/**
 * El remitente con otro nombre a la vista y la misma dirección.
 *
 * Los mails de un pedido salen con el nombre del negocio ("Dulce Estudio (vía
 * GastroOS)") y no con el de GastroOS: quien encargó una torta no sabe qué
 * sistema usa la pastelería, y un mail de un remitente desconocido va a spam. La
 * dirección no cambia, porque es la única que el dominio tiene verificada.
 *
 * El nombre lo elige el dueño de cada negocio, así que se limpia: sin comillas,
 * sin ángulos, sin saltos de línea y de largo acotado. Tampoco puede llevar `@`, `:`
 * ni `/`: un nombre como "ceo@banco.com" o "https://banco.com" se lee en la bandeja
 * de entrada como si el mail viniera de ahí.
 */
export function fromWithName(from: string, name: string): string {
  const address = /<([^>]+)>/.exec(from)?.[1]?.trim() || from.trim();
  const clean = name
    // eslint-disable-next-line no-control-regex
    .replace(/[\u0000-\u001f\u007f"<>\\@:/]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 50)
    .trim();
  if (!clean) return from;
  return `"${clean} (vía GastroOS)" <${address}>`;
}

export async function sendMail(params: {
  to: string;
  subject: string;
  html: string;
  text: string;
  replyTo?: string;
  /** Nombre a mostrar como remitente, con la dirección de siempre. */
  fromName?: string;
}): Promise<MailResult> {
  const key = process.env.RESEND_API_KEY;
  const configured = process.env.MAIL_FROM;
  const from = configured && params.fromName ? fromWithName(configured, params.fromName) : configured;

  if (!key || !from) {
    return { sent: false, reason: 'Falta configurar RESEND_API_KEY o MAIL_FROM.' };
  }

  try {
    const response = await fetch(RESEND_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${key}`,
      },
      body: JSON.stringify({
        from,
        to: [params.to],
        subject: params.subject,
        html: params.html,
        text: params.text,
        ...(params.replyTo ? { reply_to: params.replyTo } : {}),
      }),
    });

    if (!response.ok) {
      const detail = await response.text();
      console.error('[sendMail] Resend respondió', response.status, detail);
      return { sent: false, reason: `Resend devolvió ${response.status}.` };
    }

    return { sent: true };
  } catch (error) {
    console.error('[sendMail] no se pudo enviar el mail:', error);
    return { sent: false, reason: 'No se pudo conectar con el servicio de mail.' };
  }
}

/**
 * Envoltura HTML de los mails. Tabla y estilos en línea a propósito: es lo
 * único que se ve parecido en Gmail, Outlook y el mail del teléfono.
 */
export function mailLayout(params: { title: string; body: string; footer?: string }): string {
  return `<!doctype html>
<html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width"></head>
<body style="margin:0;padding:24px 12px;background:#FBF5EA;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;color:#26302A;">
  <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="max-width:560px;margin:0 auto;background:#FFFDF9;border:1px solid #E5DAC6;border-radius:16px;">
    <tr><td style="padding:28px 28px 8px;">
      <p style="margin:0;font-size:11px;letter-spacing:.18em;text-transform:uppercase;color:#9A9080;">GastroOS</p>
      <h1 style="margin:8px 0 0;font-size:22px;line-height:1.3;font-weight:600;">${params.title}</h1>
    </td></tr>
    <tr><td style="padding:8px 28px 28px;font-size:15px;line-height:1.6;color:#45443A;">${params.body}</td></tr>
    <tr><td style="padding:16px 28px 24px;border-top:1px solid #F3EADA;font-size:12px;line-height:1.6;color:#9A9080;">
      ${params.footer || 'GastroOS es un producto de SOVARE.'}
    </td></tr>
  </table>
</body></html>`;
}

export function mailButton(href: string, label: string): string {
  return `<a href="${href}" style="display:inline-block;background:#A04630;color:#ffffff;text-decoration:none;font-weight:600;font-size:15px;padding:12px 22px;border-radius:10px;">${label}</a>`;
}
