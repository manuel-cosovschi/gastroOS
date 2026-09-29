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

const RESEND_URL = 'https://api.resend.com/emails';

export interface MailResult {
  sent: boolean;
  reason?: string;
}

export function mailerConfigured(): boolean {
  return Boolean(process.env.RESEND_API_KEY && process.env.MAIL_FROM);
}

export async function sendMail(params: {
  to: string;
  subject: string;
  html: string;
  text: string;
  replyTo?: string;
}): Promise<MailResult> {
  const key = process.env.RESEND_API_KEY;
  const from = process.env.MAIL_FROM;

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
<body style="margin:0;padding:24px 12px;background:#fafaf9;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;color:#1c1917;">
  <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="max-width:560px;margin:0 auto;background:#ffffff;border:1px solid #e7e5e4;border-radius:16px;">
    <tr><td style="padding:28px 28px 8px;">
      <p style="margin:0;font-size:11px;letter-spacing:.18em;text-transform:uppercase;color:#a8a29e;">GastroOS</p>
      <h1 style="margin:8px 0 0;font-size:22px;line-height:1.3;font-weight:600;">${params.title}</h1>
    </td></tr>
    <tr><td style="padding:8px 28px 28px;font-size:15px;line-height:1.6;color:#44403c;">${params.body}</td></tr>
    <tr><td style="padding:16px 28px 24px;border-top:1px solid #f5f5f4;font-size:12px;line-height:1.6;color:#a8a29e;">
      ${params.footer || 'GastroOS es un producto de SOVARE.'}
    </td></tr>
  </table>
</body></html>`;
}

export function mailButton(href: string, label: string): string {
  return `<a href="${href}" style="display:inline-block;background:#047857;color:#ffffff;text-decoration:none;font-weight:600;font-size:15px;padding:12px 22px;border-radius:10px;">${label}</a>`;
}
