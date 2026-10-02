import Link from 'next/link';
import { notFound } from 'next/navigation';
import { AlertTriangle, ArrowLeft, MessageCircle } from 'lucide-react';
import { createServerClient } from '@/lib/supabase/server';
import { Badge, SectionCard } from '@/components/ui';
import { SaleDecision } from '@/components/vendedores/sale-decision';
import { CreateClientFromSale, VoidSale } from '@/components/vendedores/sale-actions';
import { linkWhatsApp, formatearNumero } from '@/lib/whatsapp';
import { longDate, money, monthLabel } from '@/lib/utils';
import {
  VENDOR_SALE_STATUS_META,
  type Plan,
  type SaleMatch,
  type Vendor,
  type VendorSale,
} from '@/types';

export const metadata = { title: 'Cliente de un vendedor' };
export const dynamic = 'force-dynamic';

/** Dónde se mira cada tipo de coincidencia. */
const MATCH_META: Record<SaleMatch['kind'], { label: string; href: (id: string) => string }> = {
  venta: { label: 'Otra venta de vendedores', href: (id) => `/vendedores/ventas/${id}` },
  contratacion: { label: 'Contratación desde la página', href: (id) => `/contrataciones/${id}` },
  cliente: { label: 'Ya es un cliente', href: (id) => `/clientes/${id}` },
};

export default async function VendorSalePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createServerClient();

  const { data } = await supabase.from('vendor_sales').select('*').eq('id', id).maybeSingle();
  if (!data) notFound();
  const sale = data as VendorSale;

  const [vendorRes, plansRes, matchesRes] = await Promise.all([
    supabase.from('vendors').select('*').eq('id', sale.vendor_id).maybeSingle(),
    supabase.from('plans').select('*').eq('is_active', true).order('sort_order'),
    supabase.rpc('sale_matches', { p_sale: id }),
  ]);

  const vendor = vendorRes.data as Vendor | null;
  if (!vendor) notFound();

  const plans = (plansRes.data ?? []) as Plan[];
  const matches = (matchesRes.data ?? []) as SaleMatch[];
  const status = VENDOR_SALE_STATUS_META[sale.status];
  const chat = linkWhatsApp(sale.whatsapp);

  return (
    <div className="space-y-6">
      <Link
        href={`/vendedores/${vendor.id}`}
        className="inline-flex items-center gap-1.5 text-sm text-stone-500 transition-colors hover:text-stone-900"
      >
        <ArrowLeft className="h-4 w-4" />
        {vendor.name}
      </Link>

      <header className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <h1 className="text-2xl font-semibold tracking-tight text-stone-900">
            {sale.business_name}
          </h1>
          <p className="mt-1 text-sm text-stone-500">
            Lo cargó {vendor.name} el {longDate(sale.submitted_at)}
          </p>
        </div>
        <Badge className={status.badge}>{status.label}</Badge>
      </header>

      {matches.length > 0 && sale.status === 'pendiente' && (
        <div className="flex gap-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" />
          <div className="min-w-0 text-sm text-stone-800">
            <p className="font-medium">Este cliente ya aparece en otros lados.</p>
            <p className="mt-0.5 leading-relaxed text-stone-600">
              Mirá las coincidencias de al lado antes de aprobar: puede ser un cliente que ya
              tenías, o uno que cargó otro vendedor.
            </p>
          </div>
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          {/* ---------- La decisión ---------- */}
          {sale.status === 'pendiente' && (
            <SectionCard title="Tu decisión">
              <div className="px-5 py-5">
                <SaleDecision
                  saleId={sale.id}
                  initialPlan={sale.plan}
                  plans={plans}
                  vendorPct={Number(vendor.commission_pct)}
                  vendorName={vendor.name}
                />
              </div>
            </SectionCard>
          )}

          {sale.status === 'aprobada' && (
            <SectionCard title="Comisión acreditada">
              <div className="space-y-4 px-5 py-4">
                <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
                  <p className="text-2xl font-semibold tabular tracking-tight text-stone-900">
                    {money(Number(sale.commission_amount))}
                  </p>
                  <p className="text-sm text-stone-500">
                    {sale.commission_pct !== null && sale.plan_monthly !== null
                      ? `${Number(sale.commission_pct)}% de ${money(Number(sale.plan_monthly))}, plan ${sale.plan}`
                      : `plan ${sale.plan}`}
                  </p>
                </div>
                <p className="text-sm leading-relaxed text-stone-600">
                  Va al saldo de <strong>{sale.period ? monthLabel(sale.period) : '—'}</strong>.{' '}
                  {sale.settlement_id
                    ? 'Ya está dentro de una liquidación.'
                    : 'Todavía no está liquidada.'}
                  {sale.decision_notes && <> Nota: {sale.decision_notes}</>}
                </p>

                <div className="flex flex-wrap items-start gap-3 border-t border-stone-100 pt-4">
                  {sale.client_id ? (
                    <Link
                      href={`/clientes/${sale.client_id}`}
                      className="inline-flex h-9 items-center rounded-lg border border-stone-300 bg-white px-3 text-sm font-medium text-stone-700 hover:bg-stone-50"
                    >
                      Ver la ficha del cliente
                    </Link>
                  ) : (
                    <CreateClientFromSale saleId={sale.id} />
                  )}
                </div>

                <div className="border-t border-stone-100 pt-4">
                  {sale.settlement_id ? (
                    <p className="text-xs leading-relaxed text-stone-500">
                      Para anularla hay que deshacer primero la liquidación, desde la página de{' '}
                      <Link href={`/vendedores/${vendor.id}`} className="text-brand-800 underline">
                        {vendor.name}
                      </Link>
                      .
                    </p>
                  ) : (
                    <VoidSale saleId={sale.id} />
                  )}
                </div>
              </div>
            </SectionCard>
          )}

          {sale.status === 'rechazada' && (
            <SectionCard title="Rechazada">
              <div className="space-y-1 px-5 py-4">
                <p className="text-sm leading-relaxed text-stone-700">{sale.decision_notes}</p>
                <p className="text-xs text-stone-500">
                  El {longDate(sale.decided_at)}. {vendor.name} lo ve en su página.
                </p>
              </div>
            </SectionCard>
          )}

          {sale.status === 'anulada' && (
            <SectionCard title="Anulada">
              <div className="space-y-1 px-5 py-4">
                <p className="text-sm leading-relaxed text-stone-700">{sale.void_notes}</p>
                <p className="text-xs text-stone-500">
                  El {longDate(sale.voided_at)}. Estaba acreditada por{' '}
                  {money(Number(sale.commission_amount))} y salió del saldo.
                </p>
              </div>
            </SectionCard>
          )}

          {/* ---------- Lo que cargó ---------- */}
          <SectionCard title="Lo que cargó el vendedor">
            <dl className="divide-y divide-stone-100">
              <Row label="Negocio" value={sale.business_name} />
              <Row label="Persona" value={sale.contact_name} />
              <Row label="WhatsApp" value={formatearNumero(sale.whatsapp)} />
              <Row label="Mail" value={sale.email} />
              <Row label="Ciudad" value={sale.city} />
              <Row label="Rubro" value={sale.industry} />
              <Row label="Plan que dijo" value={sale.plan} />
              {sale.notes && (
                <div className="px-5 py-3">
                  <dt className="text-sm text-stone-500">Su nota</dt>
                  <dd className="mt-1 whitespace-pre-line text-sm leading-relaxed text-stone-900">
                    {sale.notes}
                  </dd>
                </div>
              )}
            </dl>
            {chat && (
              <div className="border-t border-stone-200 px-5 py-3">
                <a
                  href={chat}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 text-sm text-stone-600 transition-colors hover:text-stone-900"
                >
                  <MessageCircle className="h-4 w-4" />
                  Escribirle al cliente por WhatsApp
                </a>
              </div>
            )}
          </SectionCard>
        </div>

        {/* ---------- Coincidencias ---------- */}
        <div className="space-y-6">
          <SectionCard title="Coincidencias">
            {matches.length === 0 ? (
              <p className="px-5 py-4 text-sm leading-relaxed text-stone-500">
                No aparece en otras ventas, contrataciones ni fichas. Se compara por mail,
                teléfono y nombre del negocio.
              </p>
            ) : (
              <ul className="divide-y divide-stone-100">
                {matches.map((match) => (
                  <li key={`${match.kind}-${match.ref_id}`}>
                    <Link
                      href={MATCH_META[match.kind].href(match.ref_id)}
                      className="block px-5 py-3 transition-colors hover:bg-stone-50"
                    >
                      <p className="text-[11px] font-semibold uppercase tracking-wider text-stone-400">
                        {MATCH_META[match.kind].label}
                      </p>
                      <p className="mt-0.5 truncate text-sm font-medium text-stone-900">
                        {match.label}
                      </p>
                      <p className="text-xs text-stone-500">
                        {match.status} · {match.detail}
                      </p>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </SectionCard>
        </div>
      </div>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string | null }) {
  return (
    <div className="flex items-start justify-between gap-3 px-5 py-2.5">
      <dt className="shrink-0 text-sm text-stone-500">{label}</dt>
      <dd className="min-w-0 break-words text-right text-sm text-stone-900">{value || '—'}</dd>
    </div>
  );
}
