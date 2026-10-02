import { notFound } from 'next/navigation';
import { AlertCircle, CheckCircle2, Clock, XCircle } from 'lucide-react';
import { getVendorPortal, monthLabel } from '@/lib/vendors';
import { whatsappUrl } from '@/lib/marketing';
import { cn } from '@/lib/utils';
import { VendorSaleForm } from '@/components/vendedor/sale-form';
import type { VendorSaleView, VendorSettlementView } from '@/types/vendor';

export const dynamic = 'force-dynamic';

const money = (value: number) =>
  new Intl.NumberFormat('es-AR', {
    style: 'currency',
    currency: 'ARS',
    maximumFractionDigits: 0,
  }).format(value);

const day = (value: string) =>
  new Intl.DateTimeFormat('es-AR', {
    day: 'numeric',
    month: 'short',
    timeZone: 'America/Argentina/Buenos_Aires',
  }).format(new Date(value));

interface Props {
  params: Promise<{ token: string }>;
}

/**
 * La página de un vendedor.
 *
 * Se abre con un link y nada más: no hay cuenta ni contraseña. Cuatro cosas, en
 * este orden porque es el orden en que importan: cuánto lleva, dónde cargar un
 * cliente, en qué quedó cada uno que cargó, y qué se le pagó.
 */
export default async function VendedorPage({ params }: Props) {
  const { token } = await params;
  const portal = await getVendorPortal(token);
  if (!portal) notFound();

  const firstName = portal.name.trim().split(/\s+/)[0];
  const help = whatsappUrl(`Hola, soy ${portal.name}, tengo una duda con mi página de vendedor.`);
  const waiting = portal.sales.filter((sale) => sale.status === 'pendiente').length;

  return (
    <div className="space-y-10">
      <header>
        <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-brand-700">
          Vendedor de GastroOS
        </p>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight text-stone-900 sm:text-4xl">
          Hola, {firstName}
        </h1>
        <p className="mt-3 text-base leading-relaxed text-stone-600">
          Acá cargás los clientes que conseguís. Cada uno lo reviso yo. Cuando lo apruebo, el{' '}
          <strong className="font-semibold text-stone-900">{portal.commissionPct}%</strong> de la
          cuota del primer mes se suma a tu saldo del mes, y a fin de mes te lo transfiero.
        </p>
      </header>

      {!portal.isActive && (
        <div className="flex gap-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3">
          <AlertCircle className="mt-0.5 h-5 w-5 shrink-0 text-amber-600" />
          <p className="text-sm leading-relaxed text-stone-800">
            Tu acceso está pausado, así que por ahora no podés cargar clientes nuevos. Tu saldo y
            tu historial siguen como estaban.
            {help && (
              <>
                {' '}
                <a href={help} target="_blank" rel="noreferrer" className="text-brand-700 underline">
                  Escribinos
                </a>{' '}
                si querés retomar.
              </>
            )}
          </p>
        </div>
      )}

      {/* ---------- Plata ---------- */}
      <section aria-label="Tu saldo">
        <dl className="grid gap-3 sm:grid-cols-3">
          <Stat
            label={`Saldo de ${monthLabel(portal.summary.currentPeriod).split(' ')[0].toLowerCase()}`}
            value={money(portal.summary.thisMonth)}
            hint="Lo aprobado este mes"
          />
          <Stat
            label="A cobrar"
            value={money(portal.summary.toCollect)}
            hint="Meses cerrados, por transferirte"
            highlight={portal.summary.toCollect > 0}
          />
          <Stat label="Ya cobrado" value={money(portal.summary.collected)} hint="Lo que te transferí" />
        </dl>
        {waiting > 0 && (
          <p className="mt-3 text-sm text-stone-500">
            {waiting === 1
              ? 'Tenés 1 cliente en revisión: todavía no está en tu saldo.'
              : `Tenés ${waiting} clientes en revisión: todavía no están en tu saldo.`}
          </p>
        )}
      </section>

      {/* ---------- Cargar ---------- */}
      {portal.isActive && (
        <section aria-labelledby="cargar">
          <h2 id="cargar" className="text-xl font-semibold tracking-tight text-stone-900">
            Cargar un cliente
          </h2>
          <p className="mt-1 text-sm text-stone-500">
            Un cliente que ya cerraste. Si todavía lo estás hablando, esperá a cerrarlo.
          </p>
          <div className="mt-5 rounded-2xl border border-stone-200 bg-white p-5 shadow-card sm:p-6">
            <VendorSaleForm
              token={token}
              plans={portal.plans}
              commissionPct={portal.commissionPct}
            />
          </div>
        </section>
      )}

      {/* ---------- Lo cargado ---------- */}
      <section aria-labelledby="clientes">
        <h2 id="clientes" className="text-xl font-semibold tracking-tight text-stone-900">
          Tus clientes
        </h2>
        {portal.sales.length === 0 ? (
          <p className="mt-3 text-sm leading-relaxed text-stone-500">
            Todavía no cargaste ninguno. Cuando cargues el primero aparece acá, con su estado.
          </p>
        ) : (
          <ul className="mt-4 divide-y divide-stone-200 overflow-hidden rounded-2xl border border-stone-200 bg-white">
            {portal.sales.map((sale) => (
              <SaleRow key={sale.id} sale={sale} />
            ))}
          </ul>
        )}
      </section>

      {/* ---------- Pagos ---------- */}
      {portal.settlements.length > 0 && (
        <section aria-labelledby="pagos">
          <h2 id="pagos" className="text-xl font-semibold tracking-tight text-stone-900">
            Tus pagos
          </h2>
          <ul className="mt-4 divide-y divide-stone-200 overflow-hidden rounded-2xl border border-stone-200 bg-white">
            {portal.settlements.map((settlement) => (
              <SettlementRow key={settlement.id} settlement={settlement} />
            ))}
          </ul>
        </section>
      )}

      <p className="border-t border-stone-200 pt-6 text-sm leading-relaxed text-stone-500">
        Guardá este link: es tu acceso, y quien lo tenga puede cargar clientes a tu nombre. Si lo
        mandaste a un chat equivocado, avisame y te paso uno nuevo.
        {help && (
          <>
            {' '}
            <a href={help} target="_blank" rel="noreferrer" className="text-brand-700 underline">
              Escribirme por WhatsApp
            </a>
            .
          </>
        )}
      </p>
    </div>
  );
}

function Stat({
  label,
  value,
  hint,
  highlight,
}: {
  label: string;
  value: string;
  hint: string;
  highlight?: boolean;
}) {
  return (
    <div
      className={cn(
        'rounded-xl border bg-white p-4 shadow-card',
        highlight ? 'border-brand-300' : 'border-stone-200'
      )}
    >
      <dt className="text-sm font-medium text-stone-500">{label}</dt>
      <dd className="mt-1.5 text-2xl font-semibold tabular tracking-tight text-stone-900">{value}</dd>
      <p className="mt-1 text-xs text-stone-500">{hint}</p>
    </div>
  );
}

function SaleRow({ sale }: { sale: VendorSaleView }) {
  return (
    <li className="px-4 py-3.5 sm:px-5">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate text-sm font-medium text-stone-900">{sale.business_name}</p>
          <p className="text-xs text-stone-500">Cargado el {day(sale.submitted_at)}</p>
        </div>
        <SaleStatus sale={sale} />
      </div>

      {sale.status === 'aprobada' && sale.period && (
        <p className="mt-1.5 text-xs text-stone-500">
          Sumado a tu saldo de {monthLabel(sale.period).split(' ')[0].toLowerCase()}.
        </p>
      )}
      {sale.status === 'rechazada' && sale.decision_notes && (
        <p className="mt-2 rounded-lg bg-stone-50 px-3 py-2 text-sm leading-relaxed text-stone-700">
          {sale.decision_notes}
        </p>
      )}
      {sale.status === 'anulada' && sale.void_notes && (
        <p className="mt-2 rounded-lg bg-stone-50 px-3 py-2 text-sm leading-relaxed text-stone-700">
          Salió de tu saldo: {sale.void_notes}
        </p>
      )}
    </li>
  );
}

function SaleStatus({ sale }: { sale: VendorSaleView }) {
  if (sale.status === 'aprobada') {
    return (
      <span className="inline-flex shrink-0 items-center gap-1.5 rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-xs font-medium text-emerald-800">
        <CheckCircle2 className="h-3.5 w-3.5" />
        Aprobado{sale.commission_amount !== null && ` · +${money(sale.commission_amount)}`}
      </span>
    );
  }
  if (sale.status === 'rechazada') {
    return (
      <span className="inline-flex shrink-0 items-center gap-1.5 rounded-full border border-rose-200 bg-rose-50 px-2.5 py-1 text-xs font-medium text-rose-700">
        <XCircle className="h-3.5 w-3.5" />
        No aprobado
      </span>
    );
  }
  if (sale.status === 'anulada') {
    return (
      <span className="inline-flex shrink-0 items-center gap-1.5 rounded-full border border-stone-200 bg-stone-100 px-2.5 py-1 text-xs font-medium text-stone-600">
        Anulado
      </span>
    );
  }
  return (
    <span className="inline-flex shrink-0 items-center gap-1.5 rounded-full border border-amber-200 bg-amber-50 px-2.5 py-1 text-xs font-medium text-amber-800">
      <Clock className="h-3.5 w-3.5" />
      En revisión
    </span>
  );
}

function SettlementRow({ settlement }: { settlement: VendorSettlementView }) {
  const paid = settlement.status === 'pagada';
  return (
    <li className="flex items-center justify-between gap-3 px-4 py-3.5 sm:px-5">
      <div className="min-w-0">
        <p className="text-sm font-medium text-stone-900">{monthLabel(settlement.period)}</p>
        <p className="text-xs text-stone-500">
          {settlement.sales_count === 1 ? '1 cliente' : `${settlement.sales_count} clientes`}
          {paid && settlement.paid_at ? ` · transferido el ${day(settlement.paid_at)}` : ''}
        </p>
      </div>
      <div className="flex shrink-0 items-center gap-3">
        <p className="text-base font-semibold tabular text-stone-900">{money(settlement.total)}</p>
        <span
          className={cn(
            'rounded-full border px-2.5 py-1 text-xs font-medium',
            paid
              ? 'border-emerald-200 bg-emerald-50 text-emerald-800'
              : 'border-amber-200 bg-amber-50 text-amber-800'
          )}
        >
          {paid ? 'Pagado' : 'Por transferir'}
        </span>
      </div>
    </li>
  );
}
