'use client';

import { useMemo, useState } from 'react';
import { Clock, TrendingDown, Wallet } from 'lucide-react';
import { CALCULATOR } from '@/lib/marketing';

/**
 * Calculadora de la home.
 *
 * Dos de los tres resultados son aritmética pura y el tercero es un
 * condicional que se enuncia como tal. No promete un retorno ni un ahorro:
 * un número inventado se nota, y lo que se lleva puesto es la confianza en
 * todo lo demás de la página.
 *
 * Los supuestos se muestran debajo de cada resultado, no en una nota al pie.
 */

const money = (value: number) =>
  new Intl.NumberFormat('es-AR', {
    style: 'currency',
    currency: 'ARS',
    maximumFractionDigits: 0,
  }).format(value);

export function ProfitCalculator() {
  const [orders, setOrders] = useState(CALCULATOR.fields.orders.initial);
  const [ticket, setTicket] = useState(CALCULATOR.fields.ticket.initial);

  const results = useMemo(() => {
    const yearlyRevenue = orders * ticket * 12;
    const hoursPerMonth = (orders * CALCULATOR.minutesSavedPerOrder) / 60;
    const marginGap = (yearlyRevenue * CALCULATOR.marginErrorPct) / 100;
    return { yearlyRevenue, hoursPerMonth, marginGap };
  }, [orders, ticket]);

  return (
    <div className="grid gap-8 lg:grid-cols-[minmax(0,22rem)_1fr] lg:gap-12">
      <div className="surface space-y-6 p-6">
        <Slider
          label={CALCULATOR.fields.orders.label}
          value={orders}
          display={String(orders)}
          min={CALCULATOR.fields.orders.min}
          max={CALCULATOR.fields.orders.max}
          step={CALCULATOR.fields.orders.step}
          onChange={setOrders}
        />
        <Slider
          label={CALCULATOR.fields.ticket.label}
          value={ticket}
          display={money(ticket)}
          min={CALCULATOR.fields.ticket.min}
          max={CALCULATOR.fields.ticket.max}
          step={CALCULATOR.fields.ticket.step}
          onChange={setTicket}
        />
        <p className="border-t border-stone-100 pt-4 text-xs leading-relaxed text-stone-500">
          {CALCULATOR.cta}
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-3 lg:gap-5">
        <Result
          icon={Wallet}
          label={CALCULATOR.results.revenue.label}
          value={money(results.yearlyRevenue)}
          note={CALCULATOR.results.revenue.note}
        />
        <Result
          icon={Clock}
          label={CALCULATOR.results.hours.label}
          value={`${results.hoursPerMonth.toFixed(1).replace('.', ',')} h`}
          note={CALCULATOR.results.hours.note}
        />
        <Result
          icon={TrendingDown}
          label={CALCULATOR.results.margin.label}
          value={money(results.marginGap)}
          note={CALCULATOR.results.margin.note}
          accent
        />
      </div>
    </div>
  );
}

function Slider({
  label,
  value,
  display,
  min,
  max,
  step,
  onChange,
}: {
  label: string;
  value: number;
  display: string;
  min: number;
  max: number;
  step: number;
  onChange: (value: number) => void;
}) {
  const id = `calc-${label.replace(/\s+/g, '-').toLowerCase()}`;

  return (
    <div>
      <div className="flex items-baseline justify-between gap-3">
        <label htmlFor={id} className="text-sm font-medium text-stone-700">
          {label}
        </label>
        <span className="text-lg font-semibold tabular-nums text-stone-900">{display}</span>
      </div>
      <input
        id={id}
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(event) => onChange(Number(event.target.value))}
        className="mt-3 h-1.5 w-full cursor-pointer appearance-none rounded-full bg-stone-200 accent-brand-600"
      />
    </div>
  );
}

/**
 * El tercer resultado va en ámbar y no en el verde de marca: es plata en
 * riesgo, y en esta paleta el verde se lee como "esto está bien".
 */
function Result({
  icon: Icon,
  label,
  value,
  note,
  accent = false,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string;
  note: string;
  accent?: boolean;
}) {
  return (
    <div className="surface flex flex-col p-5">
      <Icon className={accent ? 'h-5 w-5 text-amber-600' : 'h-5 w-5 text-stone-400'} />
      <p className="mt-3 text-sm font-medium leading-snug text-stone-500">{label}</p>
      <p
        className={`mt-1 text-2xl font-semibold tabular-nums tracking-tight ${
          accent ? 'text-amber-700' : 'text-stone-900'
        }`}
      >
        {value}
      </p>
      <p className="mt-3 text-xs leading-relaxed text-stone-500">{note}</p>
    </div>
  );
}
