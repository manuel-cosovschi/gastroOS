import type { TransferDetails } from '@/lib/signups';

/**
 * Lectura automática del comprobante de transferencia.
 *
 * La división de tareas es a propósito y vale la pena dejarla escrita: el
 * modelo **lee**, el código **decide**. Al modelo se le pregunta qué dice el
 * papel —monto, fecha, a quién, si parece retocado— y nada más. Si eso alcanza
 * para aprobar lo resuelve `judgeReceipt`, comparando contra el monto que
 * esperábamos y contra nuestros propios datos bancarios. Dejar la aprobación en
 * manos del modelo sería pedirle una decisión de plata a algo que puede
 * alucinar un número.
 *
 * Todo lo que no sea un sí redondo termina en revisión manual. Nunca rechaza
 * solo: un comprobante legítimo mal leído y rechazado de una es perder un
 * cliente, y esa asimetría manda.
 */

/** Formatos que el modelo puede mirar. Un PDF o un HEIC van a revisión manual. */
export const AI_READABLE_TYPES = ['image/jpeg', 'image/png', 'image/webp'];

// `OPENAI_API_URL` existe para las pruebas locales (ver `mailer.ts`); en producción no se define.
const OPENAI_URL = process.env.OPENAI_API_URL || 'https://api.openai.com/v1/chat/completions';
const DEFAULT_MODEL = 'gpt-4o';
const TIMEOUT_MS = 45_000;

/** Con menos que esto no se aprueba solo, por más que el resto cierre. */
const MIN_CONFIDENCE = 0.75;

/** Tolerancia en pesos al comparar montos: absorbe redondeos, no descuentos. */
const AMOUNT_TOLERANCE = 1;

export interface ReceiptReading {
  legible: boolean;
  es_comprobante: boolean;
  monto: number | null;
  fecha: string | null;
  destinatario: string | null;
  alias_o_cbu: string | null;
  banco_origen: string | null;
  referencia: string | null;
  senales_de_edicion: boolean;
  observaciones: string;
  confianza: number;
}

export interface ReceiptJudgement {
  verdict: 'valido' | 'dudoso' | 'invalido';
  confidence: number;
  summary: string;
  approve: boolean;
  reading: ReceiptReading | null;
}

export function aiConfigured(): boolean {
  return Boolean(process.env.OPENAI_API_KEY);
}

const PROMPT = `Sos un asistente que lee comprobantes de transferencia bancaria argentinos.

Mirá la imagen y contestá SOLO con un objeto JSON con estas claves:

- "legible": true si se puede leer el contenido, false si está borroso, cortado o ilegible.
- "es_comprobante": true si es un comprobante de transferencia o pago real de un banco o billetera virtual (Mercado Pago, Ualá, Brubank, Galicia, etc.). false si es otra cosa: una captura de un catálogo, una foto cualquiera, una plantilla en blanco, un presupuesto.
- "monto": el importe transferido, sólo el número, sin símbolo ni separadores de miles, con punto decimal. null si no se lee.
- "fecha": la fecha de la operación en formato YYYY-MM-DD. null si no se lee.
- "destinatario": el nombre de quien recibe el dinero, tal como aparece. null si no aparece.
- "alias_o_cbu": el alias, CBU o CVU de destino, tal como aparece. null si no aparece.
- "banco_origen": el banco o billetera desde donde se envió. null si no aparece.
- "referencia": el número de operación o comprobante. null si no aparece.
- "senales_de_edicion": true si ves indicios de que la imagen fue retocada: tipografías que no coinciden entre sí, bordes de texto con halo o pixelado distinto al resto, alineaciones imposibles, restos de otro número debajo del monto. Si no ves nada raro, false.
- "observaciones": una o dos frases en español explicando qué viste, y cualquier cosa que llame la atención.
- "confianza": un número de 0 a 1 con lo seguro que estás de la lectura del monto y del destinatario.

No decidas si el pago se aprueba. No inventes datos: lo que no está, va en null.`;

/** Le pregunta al modelo qué dice el comprobante. */
async function readReceipt(image: Buffer, mimeType: string): Promise<ReceiptReading | null> {
  const key = process.env.OPENAI_API_KEY;
  if (!key) return null;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);

  try {
    const response = await fetch(OPENAI_URL, {
      method: 'POST',
      signal: controller.signal,
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${key}`,
      },
      body: JSON.stringify({
        model: process.env.OPENAI_MODEL || DEFAULT_MODEL,
        temperature: 0,
        response_format: { type: 'json_object' },
        messages: [
          {
            role: 'user',
            content: [
              { type: 'text', text: PROMPT },
              {
                type: 'image_url',
                image_url: { url: `data:${mimeType};base64,${image.toString('base64')}` },
              },
            ],
          },
        ],
      }),
    });

    if (!response.ok) {
      console.error('[readReceipt] OpenAI respondió', response.status, await response.text());
      return null;
    }

    const payload = await response.json();
    const content = payload?.choices?.[0]?.message?.content;
    if (typeof content !== 'string') return null;

    const parsed = JSON.parse(content) as Partial<ReceiptReading>;
    return {
      legible: parsed.legible === true,
      es_comprobante: parsed.es_comprobante === true,
      monto: numberOrNull(parsed.monto),
      fecha: stringOrNull(parsed.fecha),
      destinatario: stringOrNull(parsed.destinatario),
      alias_o_cbu: stringOrNull(parsed.alias_o_cbu),
      banco_origen: stringOrNull(parsed.banco_origen),
      referencia: stringOrNull(parsed.referencia),
      senales_de_edicion: parsed.senales_de_edicion === true,
      observaciones: stringOrNull(parsed.observaciones) || '',
      confianza: clamp01(numberOrNull(parsed.confianza) ?? 0),
    };
  } catch (error) {
    // Un timeout o una caída de OpenAI no puede tumbar la contratación: el
    // comprobante ya está guardado y queda para revisión manual.
    console.error('[readReceipt] falló la lectura del comprobante:', error);
    return null;
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Decide qué hacer con lo que leyó el modelo. Acá no hay IA: son comparaciones.
 */
export async function judgeReceipt(params: {
  image: Buffer;
  mimeType: string;
  expectedAmount: number;
  transfer: TransferDetails;
}): Promise<ReceiptJudgement> {
  const { image, mimeType, expectedAmount, transfer } = params;

  if (!aiConfigured()) {
    return manual('No hay lectura automática configurada, así que lo revisa una persona.');
  }
  if (!AI_READABLE_TYPES.includes(mimeType)) {
    return manual(`Los archivos ${mimeType} no se leen automáticamente; lo revisa una persona.`);
  }

  const reading = await readReceipt(image, mimeType);
  if (!reading) {
    return manual('No se pudo leer el comprobante automáticamente; lo revisa una persona.');
  }

  // Lo que descarta de entrada: no es un comprobante, o está tocado.
  if (!reading.es_comprobante) {
    return {
      verdict: 'invalido',
      confidence: reading.confianza,
      summary: `No parece un comprobante de transferencia. ${reading.observaciones}`.trim(),
      approve: false,
      reading,
    };
  }
  if (reading.senales_de_edicion) {
    return {
      verdict: 'invalido',
      confidence: reading.confianza,
      summary: `La imagen muestra señales de edición. ${reading.observaciones}`.trim(),
      approve: false,
      reading,
    };
  }
  if (!reading.legible || reading.monto === null) {
    return {
      verdict: 'dudoso',
      confidence: reading.confianza,
      summary: `No se pudo leer el monto. ${reading.observaciones}`.trim(),
      approve: false,
      reading,
    };
  }

  const amountMatches = Math.abs(reading.monto - expectedAmount) <= AMOUNT_TOLERANCE;
  const destinationMatches = matchesDestination(reading, transfer);
  const confident = reading.confianza >= MIN_CONFIDENCE;

  const reasons: string[] = [];
  if (!amountMatches) {
    reasons.push(`el comprobante dice ${formatArs(reading.monto)} y esperábamos ${formatArs(expectedAmount)}`);
  }
  if (!destinationMatches) reasons.push('el destinatario no coincide con nuestra cuenta');
  if (!confident) reasons.push('la lectura no es del todo segura');

  if (reasons.length === 0) {
    return {
      verdict: 'valido',
      confidence: reading.confianza,
      summary: `Transferencia de ${formatArs(reading.monto)} a ${reading.destinatario || transfer.holder}${
        reading.fecha ? ` del ${reading.fecha}` : ''
      }. Coincide con lo esperado.`,
      approve: true,
      reading,
    };
  }

  // Un monto que no cierra no es un fraude: puede ser una transferencia parcial
  // o un plan distinto al que eligió. Va a revisión, no al tacho.
  return {
    verdict: 'dudoso',
    confidence: reading.confianza,
    summary: `Queda para revisar porque ${reasons.join(', y ')}. ${reading.observaciones}`.trim(),
    approve: false,
    reading,
  };
}

/**
 * ¿La transferencia fue a nuestra cuenta? Se compara contra el alias, el CBU y
 * el titular, porque cada banco muestra uno u otro y a veces sólo el nombre.
 */
function matchesDestination(reading: ReceiptReading, transfer: TransferDetails): boolean {
  const target = normalize(`${reading.destinatario || ''} ${reading.alias_o_cbu || ''}`);
  if (!target.trim()) return false;

  const alias = normalize(transfer.alias);
  const cbu = transfer.cbu.replace(/\D/g, '');
  const digits = target.replace(/\D/g, '');

  if (alias && target.includes(alias)) return true;
  if (cbu.length >= 8 && digits.includes(cbu)) return true;

  // Del titular basta con que aparezcan sus dos primeras palabras: los bancos
  // recortan, abrevian y reordenan nombre y apellido.
  const words = normalize(transfer.holder).split(/\s+/).filter((word) => word.length > 2);
  const hits = words.filter((word) => target.includes(word)).length;
  return words.length > 0 && hits >= Math.min(2, words.length);
}

function manual(summary: string): ReceiptJudgement {
  return { verdict: 'dudoso', confidence: 0, summary, approve: false, reading: null };
}

function normalize(value: string): string {
  return value
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function numberOrNull(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string') {
    const parsed = Number(value.replace(/[^\d.-]/g, ''));
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

function stringOrNull(value: unknown): string | null {
  return typeof value === 'string' && value.trim() ? value.trim() : null;
}

function clamp01(value: number): number {
  return Math.min(Math.max(value, 0), 1);
}

function formatArs(value: number): string {
  return new Intl.NumberFormat('es-AR', {
    style: 'currency',
    currency: 'ARS',
    maximumFractionDigits: 0,
  }).format(value);
}
