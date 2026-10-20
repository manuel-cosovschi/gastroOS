'use client';

import { useState } from 'react';
import { CALCULATOR } from '@/lib/marketing';
import { cn } from '@/lib/utils';
import { TARJETA } from '@/lib/comercial/tema';

/**
 * La calculadora, con los números del que lee.
 *
 * Dos de los tres resultados son aritmética pura y el tercero es un condicional
 * dicho como tal. No promete un retorno ni un ahorro: no lo medimos, y un número
 * inventado se nota y se lleva puesta la confianza en todo lo demás. Los
 * supuestos van debajo de cada resultado, no en una nota al pie.
 */

const plata = (n: number) =>
  new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS', maximumFractionDigits: 0 }).format(n);

export function Calculadora() {
  const [pedidos, setPedidos] = useState(CALCULATOR.fields.orders.initial);
  const [ticket, setTicket] = useState(CALCULATOR.fields.ticket.initial);

  const anual = pedidos * ticket * 12;
  const horas = (pedidos * CALCULATOR.minutesSavedPerOrder) / 60;
  const margen = (anual * CALCULATOR.marginErrorPct) / 100;

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,22rem)_1fr] lg:gap-10">
      <div className={cn(TARJETA, 'space-y-7 p-6')}>
        <Perilla
          id="calc-pedidos"
          etiqueta={CALCULATOR.fields.orders.label}
          valor={pedidos}
          mostrar={String(pedidos)}
          {...CALCULATOR.fields.orders}
          alCambiar={setPedidos}
        />
        <Perilla
          id="calc-ticket"
          etiqueta={CALCULATOR.fields.ticket.label}
          valor={ticket}
          mostrar={plata(ticket)}
          {...CALCULATOR.fields.ticket}
          alCambiar={setTicket}
        />
        <p className="border-t border-white/[0.09] pt-4 text-sm leading-relaxed text-stone-300">
          {CALCULATOR.cta}
        </p>
      </div>

      {/* `aria-live`: el que usa un lector de pantalla mueve la perilla y no
          ve que los números de al lado cambiaron. Así se los dice. */}
      <div className="grid gap-4 sm:grid-cols-3" aria-live="polite">
        <Resultado
          etiqueta={CALCULATOR.results.revenue.label}
          valor={plata(anual)}
          nota={CALCULATOR.results.revenue.note}
        />
        <Resultado
          etiqueta={CALCULATOR.results.hours.label}
          valor={`${horas.toFixed(1).replace('.', ',')} h`}
          nota={CALCULATOR.results.hours.note}
        />
        <Resultado
          etiqueta={CALCULATOR.results.margin.label}
          valor={plata(margen)}
          nota={CALCULATOR.results.margin.note}
          acento
        />
      </div>
    </div>
  );
}

function Perilla({
  id,
  etiqueta,
  valor,
  mostrar,
  min,
  max,
  step,
  alCambiar,
}: {
  id: string;
  etiqueta: string;
  valor: number;
  mostrar: string;
  min: number;
  max: number;
  step: number;
  alCambiar: (n: number) => void;
}) {
  return (
    <div>
      <div className="flex items-baseline justify-between gap-3">
        <label htmlFor={id} className="text-sm font-semibold text-stone-100">
          {etiqueta}
        </label>
        <span className="text-lg font-bold tabular-nums text-stone-50">{mostrar}</span>
      </div>
      <input
        id={id}
        type="range"
        min={min}
        max={max}
        step={step}
        value={valor}
        onChange={(e) => alCambiar(Number(e.target.value))}
        className="mt-3 w-full cursor-pointer accent-brand-400"
      />
    </div>
  );
}

/**
 * El tercer resultado va en el acento: es plata en riesgo, y es el número que
 * el que lee no tiene a mano. Los otros dos son los suyos, devueltos.
 */
function Resultado({
  etiqueta,
  valor,
  nota,
  acento = false,
}: {
  etiqueta: string;
  valor: string;
  nota: string;
  acento?: boolean;
}) {
  return (
    <div className={cn(TARJETA, 'flex flex-col p-5', acento && 'border-brand-400/40')}>
      <p className="text-sm font-semibold leading-snug text-stone-300">{etiqueta}</p>
      <p
        className={cn(
          'mt-2 text-2xl font-black tabular-nums tracking-tight',
          acento ? 'text-brand-400' : 'text-stone-50'
        )}
      >
        {valor}
      </p>
      <p className="mt-3 text-sm leading-relaxed text-stone-300">{nota}</p>
    </div>
  );
}
