/**
 * El día del negocio, visto desde un servidor en UTC. No hay corredor de tests
 * en este proyecto, así que se corre a mano:
 *
 *   npx tsx src/lib/__tests__/fechas.manual.mts
 *
 * Lo que se prueba es la hora en la que esto se rompía: entre las 21 y las 24 de
 * Argentina, un servidor en UTC ya está en el día siguiente. Ahí "los pedidos de
 * mañana" pasaban a ser los de pasado mañana, "este mes" cambiaba de mes el día
 * 31 a la noche, y el panel de SOVARE guardaba un cobro con un período distinto
 * del que usa la base, que sí calcula en hora de Argentina.
 *
 * El reloj se congela cambiando `Date` por una clase que devuelve un instante
 * fijo cuando se la llama sin argumentos. Con argumentos sigue siendo la de
 * siempre, que es como la usan los helpers para armar una fecha.
 */

const RealDate = Date;

/** Congela `new Date()` en un instante; el resto de `Date` queda igual. */
function congelar(iso: string) {
  const fijo = new RealDate(iso).getTime();
  class Congelada extends RealDate {
    constructor(...args: ConstructorParameters<typeof Date>) {
      // @ts-expect-error — el spread sobre el constructor de Date no se tipa.
      if (args.length === 0) super(fijo); else super(...args);
    }
    static now() {
      return fijo;
    }
  }
  globalThis.Date = Congelada as DateConstructor;
}

function descongelar() {
  globalThis.Date = RealDate;
}

let fallas = 0;
const igual = (real: unknown, esperado: unknown, nombre: string) => {
  const ok = real === esperado;
  if (!ok) fallas += 1;
  console.log(
    `${ok ? 'OK    ' : 'FALLA '} ${nombre}` +
      (ok ? '' : `  [esperaba ${JSON.stringify(esperado)}, dio ${JSON.stringify(real)}]`)
  );
};

const { todayISO, toISODate, addDays, startOfMonth, endOfMonth, nowLocal } = await import(
  '../utils'
);

// --- Las 22:30 de un 30 de septiembre en Argentina. En UTC ya es el 1 de octubre.
congelar('2026-10-01T01:30:00Z');
igual(todayISO(), '2026-09-30', 'a las 22:30 de Argentina, hoy sigue siendo el 30');
igual(toISODate(addDays(nowLocal(), 1)), '2026-10-01', 'y mañana es el 1, no el 2');
igual(toISODate(startOfMonth()), '2026-09-01', 'el mes en curso todavía es septiembre');
igual(toISODate(endOfMonth()), '2026-09-30', 'y termina el 30');
descongelar();

// --- Las 21:00 del 31 de diciembre: el año tampoco se adelanta.
congelar('2027-01-01T00:00:00Z');
igual(todayISO(), '2026-12-31', 'el 31 de diciembre a las 21 todavía es 2026');
igual(toISODate(startOfMonth()), '2026-12-01', 'y el mes es diciembre');
descongelar();

// --- Media mañana: sin diferencia entre UTC y Argentina.
congelar('2026-10-06T14:00:00Z');
igual(todayISO(), '2026-10-06', 'a las 11 de la mañana los dos coinciden');
igual(toISODate(addDays(nowLocal(), 1)), '2026-10-07', 'mañana es el 7');
igual(toISODate(addDays(nowLocal(), -29)), '2026-09-07', 'los últimos 30 días arrancan el 7/9');
descongelar();

// --- Un 29 de febrero, por las dudas.
congelar('2028-02-29T15:00:00Z');
igual(todayISO(), '2028-02-29', 'el 29 de febrero existe');
igual(toISODate(endOfMonth()), '2028-02-29', 'y es el último día del mes');
descongelar();

console.log(fallas === 0 ? '\nTODO OK' : `\n${fallas} FALLAS`);
process.exit(fallas === 0 ? 0 : 1);
