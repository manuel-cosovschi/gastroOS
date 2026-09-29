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

/** Hoy en ISO, sin la hora. Todas las fechas del panel son días, no instantes. */
export function todayISO() {
  return new Date().toISOString().slice(0, 10);
}

/** Primer día del mes de una fecha, que es como se guarda el período de un cobro. */
export function monthStart(date = new Date()) {
  return new Date(date.getFullYear(), date.getMonth(), 1).toISOString().slice(0, 10);
}

export function addMonths(iso: string, months: number) {
  const d = new Date(`${iso}T12:00:00`);
  d.setMonth(d.getMonth() + months);
  return d.toISOString().slice(0, 10);
}
