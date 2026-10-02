import { mailButton, mailLayout } from '@/lib/mailer';
import { escapeHtml, oneLine } from '@/lib/html';

/**
 * El aviso que recibe el dueño cuando un vendedor carga un cliente.
 *
 * Es una función pura y no está dentro de la acción por dos motivos. Un archivo
 * `'use server'` sólo puede exportar funciones asíncronas, y esta se puede probar
 * sin mandar un mail. Y lo que carga un vendedor entra al HTML, así que conviene
 * poder mirar exactamente qué sale.
 */

export interface VendorSaleNotice {
  vendorName: string;
  business: string;
  planLabel: string;
  contact: string | null;
  whatsapp: string | null;
  email: string | null;
  city: string | null;
  notes: string | null;
  /** Dirección de la pantalla de revisión en el panel; vacía si el panel no está configurado. */
  reviewUrl: string;
}

export function buildVendorSaleNotice(notice: VendorSaleNotice): {
  subject: string;
  html: string;
  text: string;
} {
  const rows: [string, string | null][] = [
    ['Negocio', notice.business],
    ['Plan que dice', notice.planLabel],
    ['Persona', notice.contact],
    ['WhatsApp', notice.whatsapp],
    ['Mail', notice.email],
    ['Ciudad', notice.city],
    ['Su nota', notice.notes],
  ];
  const filled = rows.filter((row): row is [string, string] => Boolean(row[1]));

  const html = mailLayout({
    title: `${escapeHtml(notice.vendorName)} cargó un cliente`,
    body: `
      <p style="margin:0 0 16px;">Hay un cliente nuevo esperando que lo apruebes. Hasta que lo hagas no suma a nadie.</p>
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
      ${notice.reviewUrl ? `<p style="margin:0;">${mailButton(escapeHtml(notice.reviewUrl), 'Revisar y aprobar')}</p>` : ''}
    `,
    footer: 'Aviso automático de la página de vendedores.',
  });

  const text = [
    `${notice.vendorName} cargó un cliente y espera que lo apruebes.`,
    '',
    ...filled.map(([label, value]) => `${label}: ${value}`),
    ...(notice.reviewUrl ? ['', `Revisar y aprobar: ${notice.reviewUrl}`] : []),
  ].join('\n');

  return {
    // Corto y con las dos cosas que importan para decidir si abrirlo ya.
    subject: `${oneLine(notice.vendorName, 30)} cargó a ${oneLine(notice.business, 45)}`,
    html,
    text,
  };
}
