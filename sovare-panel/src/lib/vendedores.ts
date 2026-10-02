import type { VendorBalance, VendorSettlement } from '@/types';

/**
 * Lo que comparten las pantallas de vendedores.
 */

/**
 * Dónde vive la página del vendedor.
 *
 * Está en la landing y no en este panel: este panel le exige sesión de
 * administrador a todo lo que sirve, y el vendedor no tiene cuenta. La landing ya
 * tiene el patrón de "página pública que se abre con un token" (las
 * contrataciones), y es la que puede escribir en este esquema.
 */
export const LANDING_URL = (process.env.NEXT_PUBLIC_LANDING_URL || 'https://gastroos.shop').replace(
  /\/$/,
  ''
);

export function vendorUrl(token: string): string {
  return `${LANDING_URL}/vendedor/${token}`;
}

/**
 * El mensaje con el que se le manda su link a un vendedor nuevo.
 *
 * Dice cómo funciona la plata en las mismas palabras que va a ver en su página:
 * si el WhatsApp promete una cosa y la página otra, la primera discusión es
 * sobre qué se dijo.
 */
export function mensajeInvitacion(nombre: string, url: string, porcentaje: number): string {
  const primerNombre = nombre.trim().split(/\s+/)[0] || 'che';
  const pct = Number.isInteger(porcentaje) ? String(porcentaje) : porcentaje.toFixed(1);

  return [
    `Hola ${primerNombre}, ya te armé tu página para cargar los clientes de GastroOS que consigas. Entrás desde acá, sin crear cuenta:`,
    '',
    url,
    '',
    `Cada cliente que cargues lo reviso yo. Cuando lo apruebo, el ${pct}% de la cuota del primer mes se suma a tu saldo del mes, y a fin de mes te lo transfiero.`,
    '',
    'Guardate el link, es solo tuyo.',
  ].join('\n');
}

/** Cuánto le corresponde a una venta si se aprueba con este plan y este porcentaje. */
export function comisionSugerida(cuotaMensual: number, porcentaje: number): number {
  return Math.round((cuotaMensual * porcentaje) / 100);
}

export interface ResumenVendedor {
  /** Aprobado y todavía sin liquidar, de todos los meses. */
  sinLiquidar: number;
  /** Lo mismo, pero sólo del mes en curso. */
  delMes: number;
  /** Liquidado y todavía sin transferir. */
  porTransferir: number;
  /** Ya transferido. */
  pagado: number;
  /** Ventas aprobadas en total. */
  aprobadas: number;
}

/**
 * Junta en un solo lugar las cuentas de un vendedor.
 *
 * Lo que sale de la vista y de las liquidaciones llega como número o como texto
 * según cómo lo entregue la API (el tipo `numeric` de Postgres), así que todo
 * pasa por Number() antes de sumar.
 */
export function resumir(
  balances: VendorBalance[],
  liquidaciones: VendorSettlement[]
): ResumenVendedor {
  const suma = (valores: number[]) => valores.reduce((total, valor) => total + valor, 0);

  return {
    sinLiquidar: suma(balances.map((b) => Number(b.unsettled))),
    delMes: suma(balances.filter((b) => b.is_current).map((b) => Number(b.unsettled))),
    porTransferir: suma(
      liquidaciones.filter((l) => l.status === 'liquidada').map((l) => Number(l.total))
    ),
    pagado: suma(liquidaciones.filter((l) => l.status === 'pagada').map((l) => Number(l.total))),
    aprobadas: suma(balances.map((b) => Number(b.sales_count))),
  };
}

/**
 * Los errores que el usuario puede leer.
 *
 * Las funciones de la base lanzan sus propios mensajes en castellano
 * (`RAISE EXCEPTION`, código P0001): esos se muestran tal cual, porque están
 * escritos para eso. Cualquier otro error trae texto de Postgres que no le dice
 * nada a nadie y a veces nombra tablas, así que se reemplaza.
 */
export function mensajeDeError(
  error: { code?: string; message?: string } | null | undefined,
  porDefecto: string
): string {
  if (!error) return porDefecto;
  if (error.code === 'P0001' && error.message) return error.message;
  if (error.code === '42501') return 'No tenés permiso.';
  if (error.code === '23505') return 'Ya existe un registro igual.';
  return porDefecto;
}
