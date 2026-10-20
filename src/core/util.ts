import { createHash, createHmac, randomBytes, timingSafeEqual } from 'node:crypto';

export const newId = (prefix: string): string => `${prefix}_${randomBytes(8).toString('hex')}`;
export const token = (bytes = 32): string => randomBytes(bytes).toString('base64url');
export const sha256 = (s: string | Buffer): string => createHash('sha256').update(s).digest('hex');

export function hmac(secret: string, data: string): string {
  return createHmac('sha256', secret).update(data).digest('hex');
}

/** Comparación en tiempo constante; falso si los largos difieren. */
export function safeEqual(a: string, b: string): boolean {
  const x = Buffer.from(a);
  const y = Buffer.from(b);
  return x.length === y.length && timingSafeEqual(x, y);
}

/** La fecha de hoy en Argentina (AAAA-MM-DD): el día comercial de los productos. */
export function todayAR(d = new Date()): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Argentina/Buenos_Aires' }).format(d);
}

export function addDays(day: string, n: number): string {
  const [y, m, dd] = day.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, dd + n)).toISOString().slice(0, 10);
}

export const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export function slug(s: string): string {
  return s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 40);
}

export const ars = (n: number): string => `$${Math.round(n).toLocaleString('es-AR')}`;

export class SmfError extends Error {
  constructor(
    message: string,
    public code: string,
    public details: Record<string, unknown> = {}
  ) {
    super(message);
  }
}
