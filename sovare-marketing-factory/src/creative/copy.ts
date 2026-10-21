/**
 * Validación de copys.
 *
 * Todo texto que va a un anuncio —lo arme la Factory o lo escriba Claude desde
 * Cowork— pasa por acá antes de guardarse. Lo que bloquea:
 *
 *   - Números (precios, porcentajes, cantidades) que no aparecen en los hechos
 *     verificados del producto. Un «ahorrá 10 horas» inventado no pasa.
 *   - Testimonios y prueba social que no existe: citas atribuidas, «miles de
 *     clientes», «el más elegido», calificaciones con estrellas.
 *   - Promesas absolutas: «garantizado», «el mejor», «#1», «100%».
 *   - Afirmar atributos personales del que lee (política de Meta).
 *   - Largos que Meta corta o rechaza.
 *
 * Lo que sólo advierte queda en `warnings`: el texto se guarda, pero el panel y
 * la Skill lo muestran.
 */

import type { Product, ProductFacts } from '../catalog/types.ts';

export interface CopyInput {
  hook: string;
  headline: string;
  primary_text: string;
  cta: string;
}

export interface CopyCheck {
  ok: boolean;
  errors: string[];
  warnings: string[];
}

const PROHIBIDOS: [RegExp, string][] = [
  [/garantizad[oa]s?|garant[ií]a de resultados/i, 'promesa de resultado garantizado'],
  [/\b(el|la) mejor\b|\bn[º°o]\.?\s?1\b|#\s?1\b|l[ií]der del mercado/i, 'superlativo sin respaldo'],
  [/\b(miles|cientos|decenas) de (clientes|negocios|complejos|usuarios)/i, 'prueba social no medida'],
  [/m[aá]s elegid[oa]|todo el mundo (lo )?usa|que (casi )?todos (eligen|usan)/i, 'prueba social no medida'],
  [/[★⭐]|\b\d([.,]\d)?\s?estrellas\b/i, 'calificación inexistente'],
  [/[«"“][^»"”]{12,}[»"”]\s*[—–-]\s*[A-ZÁÉÍÓÚ][a-záéíóú]+/, 'parece un testimonio atribuido'],
  [/\b100\s?%/, 'absoluto («100%»)'],
  [/gratis para siempre|sin costo alguno/i, 'oferta que no existe'],
];

/** Meta prohíbe afirmar o insinuar atributos personales (salud, finanzas, etc.). */
const ATRIBUTOS = /¿\s*(ten[eé]s|sufr[ií]s|est[aá]s)\s+(deudas?|problemas? de salud|ansiedad|depresi[oó]n|sobrepeso)/i;

const LARGOS = { hook: 90, headline: 60, primary_text: 1200, cta: 30 };

/** Todos los números que se pueden afirmar de este producto. */
export function allowedNumbers(product: Product, facts: ProductFacts): Set<string> {
  const textos = [
    ...product.claims.filter((c) => facts.verifiedClaims.includes(c.id)).map((c) => c.text),
    ...product.angles.filter((a) => facts.verifiedAngles.includes(a.id)).flatMap((a) => [a.eyebrow, a.headline, a.body]),
    ...product.audiences.map((a) => `${a.label} ${a.detail ?? ''}`),
    product.tagline,
    product.pricing.as_of_evidence.contains,
  ];
  const nums = new Set<string>();
  for (const t of textos) for (const n of numbersIn(t)) nums.add(n);
  for (const plan of facts.pricing.plans) {
    for (const k of ['monthly', 'setup']) {
      const v = plan[k];
      if (typeof v === 'number') nums.add(String(v));
    }
    for (const k of ['limit', 'units']) if (typeof plan[k] === 'string') for (const n of numbersIn(plan[k] as string)) nums.add(n);
  }
  // Años y el mes de los precios, que aparecen al fecharlos.
  nums.add('2026');
  return nums;
}

/** Normaliza «$15.000», «15 000», «29_000» → «15000». */
export function numbersIn(text: string): string[] {
  const out: string[] = [];
  for (const m of text.matchAll(/\d[\d.,_ ]*\d|\d/g)) {
    let raw = m[0].trim();
    // 15.000 / 15,000 / 15 000 → miles. 2,40 → decimal (se quita la coma).
    if (/^\d{1,3}([.,_ ]\d{3})+$/.test(raw)) raw = raw.replace(/[.,_ ]/g, '');
    else raw = raw.replace(/[_ ]/g, '').replace(',', '.');
    out.push(String(Number(raw)));
  }
  return out;
}

export function checkCopy(copy: CopyInput, product: Product, facts: ProductFacts): CopyCheck {
  const errors: string[] = [];
  const warnings: string[] = [];
  const todo = `${copy.hook}\n${copy.headline}\n${copy.primary_text}\n${copy.cta}`;

  for (const [k, max] of Object.entries(LARGOS) as [keyof CopyInput, number][]) {
    const v = copy[k] ?? '';
    if (!v.trim()) errors.push(`«${k}» está vacío`);
    else if (v.length > max) errors.push(`«${k}» tiene ${v.length} caracteres (máximo ${max})`);
  }
  if (copy.headline.length > 40) warnings.push('el titular pasa de 40 caracteres: Meta lo puede cortar en algunas ubicaciones');

  for (const [re, motivo] of PROHIBIDOS) if (re.test(todo)) errors.push(`no se puede: ${motivo}`);
  if (ATRIBUTOS.test(todo)) errors.push('afirma un atributo personal del que lee (política de Meta)');

  const permitidos = allowedNumbers(product, facts);
  for (const n of numbersIn(todo)) {
    if (!permitidos.has(n)) errors.push(`el número ${n} no está en los hechos verificados de ${product.name}`);
  }

  if (/\$\s?\d/.test(todo) && /2026/.test(product.pricing.price_note) && !/2026/.test(todo)) {
    warnings.push(`menciona un precio sin la fecha («${product.pricing.price_note}»)`);
  }
  if (/!{2,}|¡{2,}/.test(todo)) warnings.push('signos de exclamación repetidos');
  if ((todo.match(/[A-ZÁÉÍÓÚÑ]{6,}/g) ?? []).length > 2) warnings.push('demasiadas palabras en mayúsculas');

  return { ok: errors.length === 0, errors: [...new Set(errors)], warnings };
}
