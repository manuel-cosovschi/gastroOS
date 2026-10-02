/**
 * Armado de links de WhatsApp a partir de un teléfono argentino.
 *
 * El problema real: los números se publican de cinco formas distintas —
 * "(0223) 474-8469", "+54 223 539-6261", "2236886676", "+549223..." — y wa.me
 * no perdona ninguna. Necesita exactamente 54, después un 9, después el área
 * sin el 0 y el número sin el 15.
 *
 * Y hay una trampa peor que el formato: **la mitad de los teléfonos publicados
 * son fijos y no tienen WhatsApp**. Un link a un fijo abre un chat vacío con un
 * número que no existe, que es la peor forma de descubrirlo. En la zona de Mar
 * del Plata los fijos se reconocen por el primer dígito del abonado, así que se
 * puede filtrar antes de mostrar el botón.
 */

/** Áreas de Mar del Plata y alrededores, con el dígito que delata un fijo. */
const AREAS: Record<string, { ciudad: string; fijos: string[] }> = {
  // Mar del Plata, Batán, Santa Clara del Mar, Camet.
  '223': { ciudad: 'Mar del Plata', fijos: ['4'] },
  // Necochea y Quequén.
  '2262': { ciudad: 'Necochea', fijos: ['4', '5'] },
  // Miramar.
  '2291': { ciudad: 'Miramar', fijos: ['4'] },
  // Balcarce.
  '2266': { ciudad: 'Balcarce', fijos: ['4'] },
  // Tandil.
  '249': { ciudad: 'Tandil', fijos: ['4'] },
  // Villa Gesell.
  '2255': { ciudad: 'Villa Gesell', fijos: ['4'] },
  // Pinamar.
  '2254': { ciudad: 'Pinamar', fijos: ['4'] },
  // Mar de Ajó y San Bernardo.
  '2257': { ciudad: 'Mar de Ajó', fijos: ['4'] },
  // Buenos Aires. Acá el primer dígito no distingue fijo de celular, así que no
  // se puede filtrar: el botón va a aparecer igual y si el número es fijo, el
  // chat no va a existir. Es el precio de no tener regla; en el interior sí la hay.
  '11': { ciudad: 'Buenos Aires', fijos: [] },
};

/**
 * Qué tan seguros estamos de que a este número se le puede escribir.
 *
 * - `celular`: lo dice el número mismo. Trae el 15 después del área, o el 9
 *   después del 54. Las dos marcas significan "móvil" y no hay que adivinar.
 * - `fijo`: el área tiene una regla conocida y el abonado la cumple.
 * - `dudoso`: no hay ninguna señal. Mostramos el botón igual, porque perderse un
 *   prospecto es peor que abrir un chat que no existe, pero avisamos.
 */
export type Certeza = 'celular' | 'fijo' | 'dudoso';

export interface Numero {
  /** Sólo dígitos, sin 54 y sin el 9: "2235396261". */
  nacional: string;
  area: string;
  abonado: string;
  ciudad: string | null;
  certeza: Certeza;
  /** Un fijo no tiene WhatsApp. */
  esFijo: boolean;
}

/**
 * Lee un teléfono escrito de cualquier manera y devuelve sus partes, o null si
 * no se puede interpretar con confianza. Preferimos null a adivinar: un link
 * roto cuesta más que un botón que no aparece.
 */
export function leerNumero(crudo: string | null | undefined): Numero | null {
  if (!crudo) return null;

  let d = crudo.replace(/\D/g, '');
  if (!d) return null;

  // Que el número venga como celular queda anotado acá: más abajo los prefijos
  // se descartan y con ellos se perdería la única señal confiable que hay.
  let esCelularSeguro = false;

  // Prefijos internacionales y de larga distancia, en orden.
  if (d.startsWith('0054')) d = d.slice(4);
  else if (d.startsWith('54')) d = d.slice(2);
  // El 9 después del 54 sólo lo llevan los móviles.
  if (d.length > 10 && d.startsWith('9')) {
    d = d.slice(1);
    esCelularSeguro = true;
  }
  // El 0 de larga distancia nacional.
  if (d.startsWith('0')) d = d.slice(1);
  // El 15 va después del área: se saca abajo, cuando sabemos cuál es el área.

  // El área más larga que coincida gana: 2262 antes que 226 inexistente.
  const area = Object.keys(AREAS)
    .sort((a, b) => b.length - a.length)
    .find((a) => d.startsWith(a));

  if (!area) {
    // Fuera de la zona conocida no sabemos cómo se parte ni si es fijo: sólo
    // aceptamos un largo plausible y lo dejamos marcado como dudoso.
    if (d.length < 10 || d.length > 11) return null;
    return {
      nacional: d,
      area: d.slice(0, 3),
      abonado: d.slice(3),
      ciudad: null,
      certeza: esCelularSeguro ? 'celular' : 'dudoso',
      esFijo: false,
    };
  }

  let abonado = d.slice(area.length);

  // El 15 es la marca de móvil del interior. Vale más que cualquier heurística:
  // en Necochea un celular se publica "02262 15 41-7254", con el abonado
  // empezando en 4, que es justo el dígito de los fijos.
  //
  // El largo esperado se calcula a partir del área en vez de ponerlo fijo: el
  // abonado tiene 7 dígitos con un área de 3 (Mar del Plata) y 6 con un área de
  // 4 (Necochea), así que un "15" sobrante mide distinto en cada ciudad.
  const largoAbonado = 10 - area.length;
  if (abonado.length === largoAbonado + 2 && abonado.startsWith('15')) {
    abonado = abonado.slice(2);
    esCelularSeguro = true;
  }

  // Área + abonado tiene que dar 10 dígitos en todo el país.
  if (area.length + abonado.length !== 10) return null;

  const { ciudad, fijos } = AREAS[area];
  const certeza: Certeza = esCelularSeguro
    ? 'celular'
    : fijos.includes(abonado[0])
      ? 'fijo'
      : fijos.length > 0
        ? 'celular'
        : 'dudoso';

  return { nacional: area + abonado, area, abonado, ciudad, certeza, esFijo: certeza === 'fijo' };
}

/**
 * El link que abre el chat con el mensaje ya escrito, o null si a este número
 * no se le puede escribir.
 */
export function linkWhatsApp(
  telefono: string | null | undefined,
  mensaje?: string | null
): string | null {
  const n = leerNumero(telefono);
  if (!n || n.esFijo) return null;
  const texto = mensaje?.trim() ? `?text=${encodeURIComponent(mensaje.trim())}` : '';
  return `https://wa.me/549${n.nacional}${texto}`;
}

/**
 * Cómo se escribe un número para que una persona lo lea.
 *
 * Los últimos cuatro dígitos van siempre después del guión, y lo que sobra
 * queda antes. Así sale 223 688-6676 en Mar del Plata, 2262 42-1234 en
 * Necochea y 11 5063-8726 en Buenos Aires, que es como se escriben.
 */
export function formatearNumero(telefono: string | null | undefined): string | null {
  const n = leerNumero(telefono);
  if (!n) return telefono?.trim() || null;
  const corte = Math.max(2, n.abonado.length - 4);
  return `${n.area} ${n.abonado.slice(0, corte)}-${n.abonado.slice(corte)}`;
}

/** Por qué un prospecto no tiene botón, para poder decirlo en pantalla. */
export function motivoSinWhatsApp(telefono: string | null | undefined): string | null {
  if (!telefono?.trim()) return 'Sin teléfono cargado';
  const n = leerNumero(telefono);
  if (!n) return 'El teléfono no se entiende';
  if (n.esFijo) return `Es un fijo de ${n.ciudad ?? 'la zona'}: hay que llamar`;
  return null;
}

/**
 * La advertencia para los números que no sabemos si tienen WhatsApp. Devuelve
 * null cuando no hay nada que aclarar.
 */
export function avisoNumeroDudoso(telefono: string | null | undefined): string | null {
  const n = leerNumero(telefono);
  if (!n || n.certeza !== 'dudoso') return null;
  return 'No sabemos si este número tiene WhatsApp: si el chat no existe, hay que llamarlo.';
}
