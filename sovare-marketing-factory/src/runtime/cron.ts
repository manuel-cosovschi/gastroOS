/**
 * Expresiones cron de 5 campos (minuto hora día-del-mes mes día-de-semana),
 * evaluadas en hora de Argentina: «todos los días a las 9» son las 9 de acá,
 * no de UTC. Admite `*`, listas `1,2`, rangos `1-5` y pasos `*\/15`, `0-30/10`.
 */

const TZ = 'America/Argentina/Buenos_Aires';

function field(expr: string, min: number, max: number): Set<number> {
  const out = new Set<number>();
  for (const part of expr.split(',')) {
    const [rango, pasoTxt] = part.split('/');
    const paso = pasoTxt ? Number(pasoTxt) : 1;
    let [a, b] = rango === '*' ? [min, max] : rango.split('-').map(Number);
    if (b === undefined) b = pasoTxt ? max : a;
    if (![a, b, paso].every(Number.isFinite) || a < min || b > max || paso < 1) throw new Error(`cron inválido: «${expr}»`);
    for (let v = a; v <= b; v += paso) out.add(v);
  }
  return out;
}

export interface Cron {
  minute: Set<number>;
  hour: Set<number>;
  dom: Set<number>;
  month: Set<number>;
  dow: Set<number>;
  domStar: boolean;
  dowStar: boolean;
}

export function parseCron(expr: string): Cron {
  const p = expr.trim().split(/\s+/);
  if (p.length !== 5) throw new Error(`cron inválido (hacen falta 5 campos): «${expr}»`);
  const dow = field(p[4], 0, 7);
  if (dow.has(7)) dow.add(0);
  return { minute: field(p[0], 0, 59), hour: field(p[1], 0, 23), dom: field(p[2], 1, 31), month: field(p[3], 1, 12), dow, domStar: p[2] === '*', dowStar: p[4] === '*' };
}

/** Las partes de una fecha en hora de Argentina. */
export function partsAR(d: Date): { y: number; mo: number; d: number; h: number; mi: number; dow: number } {
  const f = new Intl.DateTimeFormat('en-US', { timeZone: TZ, year: 'numeric', month: 'numeric', day: 'numeric', hour: 'numeric', minute: 'numeric', weekday: 'short', hourCycle: 'h23' });
  const o = Object.fromEntries(f.formatToParts(d).map((x) => [x.type, x.value]));
  const dows: Record<string, number> = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };
  return { y: Number(o.year), mo: Number(o.month), d: Number(o.day), h: Number(o.hour), mi: Number(o.minute), dow: dows[o.weekday] };
}

export function matches(c: Cron, date: Date): boolean {
  const t = partsAR(date);
  if (!c.minute.has(t.mi) || !c.hour.has(t.h) || !c.month.has(t.mo)) return false;
  // Regla clásica de cron: si se restringen día del mes y de la semana, alcanza con uno.
  if (!c.domStar && !c.dowStar) return c.dom.has(t.d) || c.dow.has(t.dow);
  return c.dom.has(t.d) && c.dow.has(t.dow);
}

/** Los minutos (en ms, redondeados) en los que tocaba correr entre `desde` y `hasta`. */
export function slotsBetween(expr: string, desde: Date, hasta: Date, max = 1000): Date[] {
  const c = parseCron(expr);
  const out: Date[] = [];
  let t = Math.floor(desde.getTime() / 60000) * 60000 + 60000;
  const fin = Math.floor(hasta.getTime() / 60000) * 60000;
  for (; t <= fin && out.length < max; t += 60000) if (matches(c, new Date(t))) out.push(new Date(t));
  return out;
}
