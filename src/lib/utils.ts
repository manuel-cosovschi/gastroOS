import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { DEFAULT_CURRENCY, DEFAULT_LOCALE } from './constants';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function slugify(text: string): string {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)+/g, '');
}

interface MoneyOptions {
  currency?: string;
  locale?: string;
  /** Muestra decimales. Por defecto redondea: los montos del rubro son enteros. */
  decimals?: boolean;
}

/**
 * Formatea un monto con la moneda del negocio.
 * Los componentes que ya tienen el negocio en contexto pasan `currency`/`locale`;
 * el resto cae a los valores por defecto de la instancia.
 */
export function formatPrice(value: number | null | undefined, options: MoneyOptions = {}): string {
  const { currency = DEFAULT_CURRENCY, locale = DEFAULT_LOCALE, decimals = false } = options;
  const amount = Number(value ?? 0);

  return new Intl.NumberFormat(locale, {
    style: 'currency',
    currency,
    minimumFractionDigits: decimals ? 2 : 0,
    maximumFractionDigits: decimals ? 2 : 0,
  }).format(amount);
}

/** Formato compacto para ejes de gráficos: $120k, $1.2M. */
export function formatCompact(value: number, currencySymbol = '$'): string {
  const abs = Math.abs(value);
  if (abs >= 1_000_000) return `${currencySymbol}${(value / 1_000_000).toFixed(1)}M`;
  if (abs >= 1_000) return `${currencySymbol}${Math.round(value / 1_000)}k`;
  return `${currencySymbol}${Math.round(value)}`;
}

export function formatNumber(value: number, locale = DEFAULT_LOCALE, decimals = 0): string {
  return new Intl.NumberFormat(locale, {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(value);
}

export function formatPercent(value: number, locale = DEFAULT_LOCALE): string {
  return `${new Intl.NumberFormat(locale, { maximumFractionDigits: 1 }).format(value)}%`;
}

/**
 * Convierte una fecha "plana" (YYYY-MM-DD, sin hora) en un Date local.
 * `new Date('2026-03-04')` la interpreta como UTC y en Argentina retrocede un
 * día; esto la ancla al mediodía local para que nunca cambie de fecha.
 */
export function parseDateOnly(value: string | Date): Date {
  if (value instanceof Date) return value;
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (match) {
    return new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]), 12, 0, 0);
  }
  return new Date(value);
}

export function formatDate(date: string | Date, locale = DEFAULT_LOCALE): string {
  return new Intl.DateTimeFormat(locale, {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  }).format(parseDateOnly(date));
}

/** "Mar 4 de marzo" — para encabezados de agenda. */
export function formatDateLong(date: string | Date, locale = DEFAULT_LOCALE): string {
  return new Intl.DateTimeFormat(locale, {
    weekday: 'short',
    day: 'numeric',
    month: 'long',
  }).format(parseDateOnly(date));
}

export function formatDateTime(date: string | Date, locale = DEFAULT_LOCALE): string {
  return new Intl.DateTimeFormat(locale, {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(date));
}

/** Postgres devuelve TIME como "10:30:00"; mostramos "10:30". */
export function formatTime(time: string | null): string {
  if (!time) return '';
  return time.slice(0, 5);
}

/** Fecha de hoy en formato YYYY-MM-DD, en hora local. */
export function todayISO(): string {
  return toISODate(new Date());
}

export function toISODate(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export function addDays(date: Date, days: number): Date {
  const copy = new Date(date);
  copy.setDate(copy.getDate() + days);
  return copy;
}

export function startOfMonth(date = new Date()): Date {
  return new Date(date.getFullYear(), date.getMonth(), 1);
}

export function endOfMonth(date = new Date()): Date {
  return new Date(date.getFullYear(), date.getMonth() + 1, 0);
}

/** Variación porcentual contra el período anterior. */
export function percentChange(current: number, previous: number): number | null {
  if (!previous) return current ? null : 0;
  return Math.round(((current - previous) / Math.abs(previous)) * 1000) / 10;
}

export function round2(value: number): number {
  return Math.round(value * 100) / 100;
}

/** Iniciales para el avatar de un cliente. */
export function initials(name: string): string {
  return name
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? '')
    .join('');
}
