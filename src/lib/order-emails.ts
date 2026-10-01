import { mailLayout, mailerConfigured, sendMail } from '@/lib/mailer';
import { createServiceClient } from '@/lib/supabase/service';
import { formatDateLong, formatPrice } from '@/lib/utils';
import { ORDER_STATUS_LABELS } from '@/types';
import type { Business, Order, OrderItem, OrderStatus } from '@/types';

/**
 * Los mails de un pedido.
 *
 * Tres, y cada uno tiene un destinatario distinto:
 *
 *   1. Al cliente, cuando encarga: su número de pedido y el detalle.
 *   2. Al negocio, cuando entra un pedido por la tienda.
 *   3. Al cliente, cuando su pedido cambia de estado.
 *
 * Todo sale con el nombre y los datos del negocio, no con los de GastroOS: el
 * cliente del negocio no tiene por qué saber qué sistema usan adentro.
 *
 * Ninguna de las tres lanza. Se llaman después de que el pedido ya está
 * guardado, y un servicio de mail caído no puede hacer que se pierda un pedido
 * que ya entró. Los errores van al log del servidor.
 */

export interface OrderMailLine {
  item_name: string;
  quantity: number;
  subtotal: number;
}

/** El negocio, con lo justo para armar un mail. */
type MailBusiness = Pick<Business, 'name' | 'email' | 'phone' | 'currency' | 'locale'>;

const money = (value: number, business: MailBusiness) =>
  formatPrice(value, { currency: business.currency, locale: business.locale });

function linesHtml(items: OrderMailLine[], business: MailBusiness): string {
  return items
    .map(
      (item) =>
        `<tr>
          <td style="padding:6px 0;border-bottom:1px solid #F3EADA;">${item.item_name} <span style="color:#9A9080;">× ${item.quantity}</span></td>
          <td style="padding:6px 0;border-bottom:1px solid #F3EADA;text-align:right;white-space:nowrap;">${money(Number(item.subtotal), business)}</td>
        </tr>`
    )
    .join('');
}

function linesText(items: OrderMailLine[], business: MailBusiness): string {
  return items
    .map((item) => `· ${item.item_name} x${item.quantity} — ${money(Number(item.subtotal), business)}`)
    .join('\n');
}

function deliveryLabel(order: Pick<Order, 'delivery_method'>): string {
  return order.delivery_method === 'pickup' ? 'Retiro en el local' : 'Envío a domicilio';
}

// ============================================
// 1. Al cliente, cuando encarga
// ============================================

export async function sendOrderConfirmation(params: {
  business: MailBusiness;
  order: Pick<Order, 'order_number' | 'contact_name' | 'email' | 'delivery_date' | 'delivery_method' | 'subtotal'>;
  items: OrderMailLine[];
  trackingUrl?: string;
}) {
  const { business, order, items, trackingUrl } = params;
  if (!order.email) return;

  const saludo = `Hola ${order.contact_name.split(' ')[0]},`;
  const total = money(Number(order.subtotal), business);
  const fecha = formatDateLong(order.delivery_date, business.locale);

  const body = `
    <p style="margin:0 0 16px;">${saludo}</p>
    <p style="margin:0 0 20px;">Recibimos tu pedido. Te escribimos apenas confirmemos la
    disponibilidad.</p>

    <p style="margin:0 0 6px;color:#9A9080;font-size:13px;">Tu número de pedido</p>
    <p style="margin:0 0 20px;font-size:28px;font-weight:600;">#${order.order_number}</p>

    <table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="font-size:14px;margin-bottom:16px;">
      ${linesHtml(items, business)}
      <tr>
        <td style="padding:10px 0 0;font-weight:600;">Total estimado</td>
        <td style="padding:10px 0 0;text-align:right;font-weight:600;">${total}</td>
      </tr>
    </table>

    <p style="margin:0 0 16px;font-size:14px;color:#565042;">
      ${deliveryLabel(order)} · ${fecha}
    </p>

    ${trackingUrl ? `<p style="margin:0;font-size:14px;">Podés ver en qué estado está tu pedido <a href="${trackingUrl}" style="color:#A04630;">en este link</a>.</p>` : ''}
  `;

  const text = `${saludo}

Recibimos tu pedido. Te escribimos apenas confirmemos la disponibilidad.

Tu número de pedido: #${order.order_number}

${linesText(items, business)}

Total estimado: ${total}
${deliveryLabel(order)} · ${fecha}
${trackingUrl ? `\nSeguí tu pedido: ${trackingUrl}` : ''}`;

  await deliver({
    to: order.email,
    subject: `Pedido #${order.order_number} recibido — ${business.name}`,
    html: mailLayout({ title: `Recibimos tu pedido`, body, footer: business.name }),
    text,
    replyTo: business.email || undefined,
    context: 'confirmación al cliente',
  });
}

// ============================================
// 2. Al negocio, cuando entra un pedido
// ============================================

export async function sendNewOrderNotification(params: {
  business: MailBusiness;
  order: Pick<Order, 'order_number' | 'contact_name' | 'phone' | 'email' | 'delivery_date' | 'delivery_method' | 'address' | 'subtotal' | 'observations'>;
  items: OrderMailLine[];
  adminUrl?: string;
}) {
  const { business, order, items, adminUrl } = params;

  // A dónde avisar. Sin mail del negocio cargado no hay a quién escribirle, y
  // eso no es un error: es una configuración que falta.
  const to = process.env.ORDER_NOTIFICATION_EMAIL?.trim() || business.email;
  if (!to) return;

  const contacto = [order.phone, order.email].filter(Boolean).join(' · ');

  const body = `
    <p style="margin:0 0 16px;">Entró un pedido por la tienda.</p>

    <p style="margin:0 0 4px;font-size:18px;font-weight:600;">
      #${order.order_number} · ${order.contact_name}
    </p>
    <p style="margin:0 0 20px;font-size:14px;color:#565042;">${contacto || 'sin datos de contacto'}</p>

    <table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="font-size:14px;margin-bottom:16px;">
      ${linesHtml(items, business)}
      <tr>
        <td style="padding:10px 0 0;font-weight:600;">Total</td>
        <td style="padding:10px 0 0;text-align:right;font-weight:600;">${money(Number(order.subtotal), business)}</td>
      </tr>
    </table>

    <p style="margin:0 0 8px;font-size:14px;color:#565042;">
      ${deliveryLabel(order)} · ${formatDateLong(order.delivery_date, business.locale)}
      ${order.address ? `<br>${order.address}` : ''}
    </p>
    ${order.observations ? `<p style="margin:0 0 16px;font-size:14px;"><strong>Observaciones:</strong> ${order.observations}</p>` : ''}
    ${adminUrl ? `<p style="margin:16px 0 0;"><a href="${adminUrl}" style="color:#A04630;font-weight:600;">Abrir el pedido en el panel</a></p>` : ''}
  `;

  const text = `Entró un pedido por la tienda.

#${order.order_number} · ${order.contact_name}
${contacto}

${linesText(items, business)}

Total: ${money(Number(order.subtotal), business)}
${deliveryLabel(order)} · ${formatDateLong(order.delivery_date, business.locale)}
${order.address || ''}
${order.observations ? `Observaciones: ${order.observations}` : ''}
${adminUrl ? `\nAbrilo en el panel: ${adminUrl}` : ''}`;

  await deliver({
    to,
    subject: `Pedido nuevo #${order.order_number} — ${order.contact_name}`,
    html: mailLayout({ title: 'Pedido nuevo', body, footer: business.name }),
    text,
    replyTo: order.email || undefined,
    context: 'aviso al negocio',
  });
}

// ============================================
// 3. Al cliente, cuando cambia el estado
// ============================================

/**
 * Qué se le dice al cliente en cada estado.
 *
 * `null` significa que ese cambio no se avisa: pasar un pedido a "en
 * preparación" es información interna, y un mail por cada movimiento de la
 * cocina hace que el próximo lo manden a spam.
 */
const STATUS_MESSAGE: Partial<Record<OrderStatus, { subject: string; body: string }>> = {
  confirmed: {
    subject: 'Tu pedido está confirmado',
    body: 'Confirmamos la disponibilidad: tu pedido está en marcha. Te avisamos cuando esté listo.',
  },
  ready: {
    subject: 'Tu pedido está listo',
    body: 'Ya está listo. Te esperamos en la fecha y el horario que acordamos.',
  },
  delivered: {
    subject: 'Tu pedido fue entregado',
    body: '¡Gracias por elegirnos! Si algo no salió como esperabas, contanos y lo resolvemos.',
  },
  cancelled: {
    subject: 'Tu pedido fue cancelado',
    body: 'Cancelamos tu pedido. Si fue un error o querés retomarlo, escribinos y lo vemos.',
  },
};

export async function sendOrderStatusUpdate(params: {
  business: MailBusiness;
  order: Pick<Order, 'order_number' | 'contact_name' | 'email'>;
  status: OrderStatus;
  notes?: string | null;
  trackingUrl?: string;
}) {
  const { business, order, status, notes, trackingUrl } = params;
  if (!order.email) return;

  const message = STATUS_MESSAGE[status];
  if (!message) return;

  const saludo = `Hola ${order.contact_name.split(' ')[0]},`;

  const body = `
    <p style="margin:0 0 16px;">${saludo}</p>
    <p style="margin:0 0 16px;">Tu pedido <strong>#${order.order_number}</strong> pasó a
    <strong>${ORDER_STATUS_LABELS[status]}</strong>.</p>
    <p style="margin:0 0 ${notes || trackingUrl ? '16px' : '0'};">${message.body}</p>
    ${notes ? `<p style="margin:0 0 16px;padding:12px 14px;background:#FBF5EA;border-radius:8px;font-size:14px;">${notes}</p>` : ''}
    ${trackingUrl ? `<p style="margin:0;font-size:14px;">Ver el detalle <a href="${trackingUrl}" style="color:#A04630;">acá</a>.</p>` : ''}
  `;

  const text = `${saludo}

Tu pedido #${order.order_number} pasó a ${ORDER_STATUS_LABELS[status]}.

${message.body}
${notes ? `\n${notes}` : ''}
${trackingUrl ? `\nVer el detalle: ${trackingUrl}` : ''}`;

  await deliver({
    to: order.email,
    subject: `${message.subject} — ${business.name}`,
    html: mailLayout({ title: message.subject, body, footer: business.name }),
    text,
    replyTo: business.email || undefined,
    context: `cambio de estado a ${status}`,
  });
}

// ============================================
// Helpers
// ============================================

async function deliver(params: {
  to: string;
  subject: string;
  html: string;
  text: string;
  replyTo?: string;
  context: string;
}) {
  if (!mailerConfigured()) return;

  const result = await sendMail(params);
  if (!result.sent) {
    console.error(`[order-emails] no salió el mail (${params.context}):`, result.reason);
  }
}

/**
 * Las líneas de un pedido, para los mails que se mandan desde la tienda.
 *
 * Va con la service role porque quien encarga no tiene sesión y `order_items`
 * no es legible sin ser miembro del negocio. Si no está configurada, no hay
 * mail: se devuelve vacío y el llamador no manda nada.
 */
export async function loadOrderLines(orderId: string): Promise<OrderMailLine[]> {
  const supabase = createServiceClient();
  if (!supabase) return [];

  const { data, error } = await supabase
    .from('order_items')
    .select('item_name, quantity, subtotal')
    .eq('order_id', orderId);

  if (error) {
    console.error('[order-emails] no se pudieron leer las líneas:', error);
    return [];
  }
  return (data as OrderItem[]) as OrderMailLine[];
}
