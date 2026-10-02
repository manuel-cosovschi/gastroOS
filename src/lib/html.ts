/**
 * Texto de un tercero que entra a un mail.
 *
 * El nombre de un negocio, lo que escribe un cliente en las observaciones de un
 * pedido, lo que carga un vendedor: todo eso llega al HTML de un mail que sale
 * con nuestra dirección de remitente. Sin escapar, quien lo escribe puede meter
 * un link o un botón propio en un mensaje que parece nuestro.
 */

export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/**
 * Una sola línea y de largo acotado, para asuntos y nombres de remitente: un
 * salto de línea no tiene lugar ahí, y uno de 120 caracteres se corta a la mitad
 * en la bandeja de entrada de todos modos.
 */
export function oneLine(value: string, max: number): string {
  const flat = value.replace(/\s+/g, ' ').trim();
  return flat.length > max ? `${flat.slice(0, max - 1).trimEnd()}…` : flat;
}
