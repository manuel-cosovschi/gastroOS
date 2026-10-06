import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function money(value: number | null | undefined, currency = 'ARS') {
  if (value === null || value === undefined) return '—';
  return new Intl.NumberFormat('es-AR', {
    style: 'currency',
    currency,
    maximumFractionDigits: 0,
  }).format(value);
}

/**
 * Convierte a Date lo que venga de la base.
 *
 * Una fecha sola (`2026-09-29`) se lee al mediodía y no a medianoche: parseada
 * como UTC a las 00:00, en Argentina cae el día anterior a las 21 y las fechas
 * se muestran corridas un día. A un timestamp completo no hay que hacerle nada,
 * y pegarle la hora encima lo rompía: `new Date('…T03:52:00+00:00T12:00:00')`
 * es Invalid Date, y eso tumbaba la página entera.
 */
function parseDate(value: string): Date {
  return new Date(value.includes('T') ? value : `${value}T12:00:00`);
}

export function shortDate(value: string | null | undefined) {
  if (!value) return '—';
  return new Intl.DateTimeFormat('es-AR', { day: '2-digit', month: 'short' }).format(
    parseDate(value)
  );
}

export function longDate(value: string | null | undefined) {
  if (!value) return '—';
  return new Intl.DateTimeFormat('es-AR', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  }).format(parseDate(value));
}

export function monthLabel(value: string) {
  const label = new Intl.DateTimeFormat('es-AR', { month: 'long', year: 'numeric' }).format(
    new Date(`${value}T12:00:00`)
  );
  // Mayúscula sólo en la primera letra. La clase `capitalize` de CSS la pondría
  // en cada palabra y devolvía "Septiembre De 2026".
  return label.charAt(0).toUpperCase() + label.slice(1);
}

/**
 * Las fechas del panel son días de Argentina, no instantes en UTC.
 *
 * El servidor corre en UTC, así que `new Date().toISOString()` entre las 21 y
 * las 24 de Argentina ya devuelve el día siguiente. No es un detalle de
 * presentación: `monthStart()` es el período con el que se guarda un cobro, y la
 * base lo calcula en `America/Argentina/Buenos_Aires` (ver
 * `sovare.provision_business()`). Si los dos no coinciden, en las últimas tres
 * horas de cada día el mismo cobro entra dos veces: la clave única es
 * (cliente, período, concepto), y con dos períodos distintos no choca con nada.
 */
const AR_DAY = new Intl.DateTimeFormat('en-CA', {
  timeZone: 'America/Argentina/Buenos_Aires',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
});

/** Hoy en Argentina, en ISO y sin la hora. */
export function todayISO() {
  const parts = AR_DAY.formatToParts(new Date());
  const get = (type: string) => parts.find((part) => part.type === type)?.value ?? '';
  return `${get('year')}-${get('month')}-${get('day')}`;
}

/**
 * El primer día de un mes, que es como se guarda el período de un cobro.
 * `monthStart()` es el mes en curso; `monthStart(3)`, el de hace tres meses.
 *
 * Cuenta meses en vez de correr un `Date` a propósito. La forma obvia,
 * `d.setMonth(d.getMonth() - n)`, se rompe los días 29, 30 y 31: un 31 de
 * octubre menos un mes da un "31 de septiembre", que JavaScript convierte en el
 * 1 de octubre. El gráfico del tablero, armado así, esos días repetía un mes y
 * se comía otro.
 */
export function monthStart(monthsBack = 0) {
  const [year, month] = todayISO().split('-').map(Number);
  const total = year * 12 + (month - 1) - monthsBack;
  return `${Math.floor(total / 12)}-${String((total % 12) + 1).padStart(2, '0')}-01`;
}
