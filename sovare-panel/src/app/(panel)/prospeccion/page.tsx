import Link from 'next/link';
import { ExternalLink, Instagram, Mail, Plus } from 'lucide-react';
import { createServerClient } from '@/lib/supabase/server';
import { Badge, EmptyState, SectionCard } from '@/components/ui';
import { BotonCopiar, BotonLlamar, BotonMail, BotonWhatsApp } from '@/components/contactar';
import { DescartarProspecto, PegarProspectos } from '@/components/pegar-prospectos';
import { avisoNumeroDudoso, formatearNumero, linkWhatsApp, motivoSinWhatsApp } from '@/lib/whatsapp';
import { cn, shortDate } from '@/lib/utils';
import type { Client } from '@/types';

export const metadata = { title: 'Prospección' };
export const dynamic = 'force-dynamic';

/**
 * La lista de a quién hay que escribirle, con el mensaje de cada uno.
 *
 * Es la misma tabla que Clientes —un prospecto es una ficha en estado
 * 'prospecto'— pero ordenada por la única pregunta que importa cuando uno se
 * sienta a prospectar: a quién le falta. Los que ya recibieron mensaje caen
 * abajo y quedan apagados.
 */
export default async function ProspeccionPage({
  searchParams,
}: {
  searchParams: Promise<{ ciudad?: string }>;
}) {
  const { ciudad } = await searchParams;
  const supabase = await createServerClient();

  const { data } = await supabase
    .from('clients')
    .select('*')
    .eq('status', 'prospecto')
    .order('contacted_at', { ascending: true, nullsFirst: true })
    .order('business_name');

  const todos = (data ?? []) as Client[];
  const ciudades = [...new Set(todos.map((c) => c.city).filter(Boolean))].sort() as string[];
  const prospectos = ciudad ? todos.filter((c) => c.city === ciudad) : todos;

  const pendientes = prospectos.filter((p) => !p.contacted_at);
  const contactados = prospectos.filter((p) => p.contacted_at);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-stone-900">Prospección</h1>
          <p className="mt-1 text-sm text-stone-500">
            {pendientes.length === 0
              ? 'No queda nadie sin escribir'
              : `${pendientes.length} sin escribir`}
            {contactados.length > 0 && ` · ${contactados.length} ya contactado${contactados.length === 1 ? '' : 's'}`}
          </p>
        </div>
        <Link
          href="/clientes/nuevo"
          className="inline-flex h-9 items-center gap-2 rounded-lg bg-brand-800 px-4 text-sm font-medium text-white transition-colors hover:bg-brand-900"
        >
          <Plus className="h-4 w-4" />
          Nuevo prospecto
        </Link>
      </div>

      <PegarProspectos />

      {ciudades.length > 1 && (
        <div className="flex flex-wrap items-center gap-2">
          <Chip href="/prospeccion" label={`Todas (${todos.length})`} active={!ciudad} />
          {ciudades.map((c) => (
            <Chip
              key={c}
              href={`/prospeccion?ciudad=${encodeURIComponent(c)}`}
              label={`${c} (${todos.filter((p) => p.city === c).length})`}
              active={ciudad === c}
            />
          ))}
        </div>
      )}

      <SectionCard title={ciudad ? `Sin escribir · ${ciudad}` : 'Sin escribir'}>
        {pendientes.length === 0 ? (
          <EmptyState
            title="Les escribiste a todos"
            description="Cuando cargues prospectos nuevos van a aparecer acá, arriba de los que ya contactaste."
          />
        ) : (
          <ul className="divide-y divide-stone-100">
            {pendientes.map((p) => (
              <Fila key={p.id} p={p} />
            ))}
          </ul>
        )}
      </SectionCard>

      {contactados.length > 0 && (
        <SectionCard title="Ya contactados">
          <ul className="divide-y divide-stone-100">
            {contactados.map((p) => (
              <Fila key={p.id} p={p} apagado />
            ))}
          </ul>
        </SectionCard>
      )}
    </div>
  );
}

function Fila({ p, apagado = false }: { p: Client; apagado?: boolean }) {
  const mensaje = p.outreach_message?.trim() || '';
  const href = linkWhatsApp(p.whatsapp, mensaje);
  const sinWhats = motivoSinWhatsApp(p.whatsapp);
  const numero = formatearNumero(p.whatsapp);
  const yaFue = Boolean(p.contacted_at);

  const asunto = p.outreach_subject?.trim() || asuntoDelMensaje(mensaje);

  return (
    <li className={cn('px-5 py-4', apagado && 'opacity-60')}>
      <div className="flex flex-wrap items-start gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <Link
              href={`/clientes/${p.id}`}
              className="text-sm font-semibold text-stone-900 hover:text-brand-800 hover:underline"
            >
              {p.business_name}
            </Link>
            {p.city && (
              <Badge className="border-stone-200 bg-stone-100 text-stone-600">{p.city}</Badge>
            )}
            {yaFue && (
              <span className="text-xs text-stone-400">
                escrito el {shortDate(p.contacted_at)}
              </span>
            )}
          </div>

          {p.industry && <p className="mt-0.5 text-xs text-stone-500">{p.industry}</p>}

          {/* El número a la vista. Era lo que faltaba en la versión en archivo:
              el link de WhatsApp lo lleva adentro, pero no se puede leer. */}
          <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs">
            {numero && (
              <a
                href={`tel:+54${p.whatsapp?.replace(/\D/g, '')}`}
                className="font-mono text-stone-700 hover:text-brand-800"
              >
                {numero}
              </a>
            )}
            {p.email && (
              <a
                href={`mailto:${p.email}`}
                className="inline-flex items-center gap-1 text-stone-500 hover:text-brand-800"
              >
                <Mail className="h-3 w-3" />
                {p.email}
              </a>
            )}
            {p.source && p.source.startsWith('@') && (
              <span className="inline-flex items-center gap-1 text-stone-500">
                <Instagram className="h-3 w-3" />
                {p.source}
              </span>
            )}
            {p.source_url && (
              <a
                href={p.source_url}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 text-stone-400 hover:text-brand-800"
                title="De dónde salió el contacto"
              >
                <ExternalLink className="h-3 w-3" />
                fuente
              </a>
            )}
          </div>
        </div>

        <div className="flex shrink-0 flex-wrap items-center gap-2">
          {href ? (
            <BotonWhatsApp clienteId={p.id} href={href} yaContactado={yaFue} />
          ) : (
            p.whatsapp && <BotonLlamar telefono={p.whatsapp.replace(/\D/g, '')} motivo={sinWhats ?? ''} />
          )}
          {p.email && mensaje && (
            <BotonMail
              clienteId={p.id}
              mail={p.email}
              asunto={asunto}
              cuerpo={mensaje}
              yaContactado={yaFue}
            />
          )}
          {mensaje && <BotonCopiar texto={mensaje} />}
          <DescartarProspecto id={p.id} nombre={p.business_name} />
        </div>
      </div>

      {mensaje ? (
        <details className="group mt-3">
          <summary className="cursor-pointer list-none text-xs font-medium text-stone-500 hover:text-stone-800">
            <span className="group-open:hidden">Ver el mensaje</span>
            <span className="hidden group-open:inline">Ocultar el mensaje</span>
          </summary>
          <p className="mt-2 whitespace-pre-wrap rounded-lg bg-stone-50 p-3 text-sm leading-relaxed text-stone-700">
            {mensaje}
          </p>
        </details>
      ) : (
        <p className="mt-3 text-xs text-amber-700">
          Sin mensaje escrito: el botón manda el chat vacío.{' '}
          <Link href={`/clientes/${p.id}/editar`} className="underline">
            Escribir uno
          </Link>
        </p>
      )}

      {(sinWhats || avisoNumeroDudoso(p.whatsapp)) && (
        <p className="mt-2 text-xs text-stone-500">
          {sinWhats ?? avisoNumeroDudoso(p.whatsapp)}
        </p>
      )}
    </li>
  );
}

/**
 * El asunto de respaldo, para cuando el prospecto no tiene uno escrito.
 *
 * Toma la segunda oración y no la primera, porque la primera es siempre la
 * presentación ("Hola, soy Manuel, de SOVARE"), que como asunto no dice nada.
 * El corte es por palabra y nunca por caracter.
 *
 * Es un respaldo y no la fuente: lo bueno es escribir el asunto a mano en la
 * ficha. Una oración recortada sirve para que el botón nunca quede sin asunto,
 * no para enamorar a nadie.
 */
function asuntoDelMensaje(mensaje: string): string {
  const POR_DEFECTO = 'Veinte minutos para mostrarte algo';
  const segunda = mensaje.split(/(?<=[.?])\s+/)[1]?.trim();
  if (!segunda) return POR_DEFECTO;

  const limpia = segunda.replace(/[.?]+$/, '');
  if (limpia.length <= 72) return limpia;

  const corte = limpia.slice(0, 72).lastIndexOf(' ');
  return corte > 24 ? `${limpia.slice(0, corte)}…` : POR_DEFECTO;
}

function Chip({ href, label, active }: { href: string; label: string; active: boolean }) {
  return (
    <Link
      href={href}
      className={cn(
        'inline-flex h-9 items-center rounded-lg border px-3 text-sm font-medium transition-colors',
        active
          ? 'border-brand-800 bg-brand-800 text-white'
          : 'border-stone-300 bg-white text-stone-600 hover:bg-stone-50'
      )}
    >
      {label}
    </Link>
  );
}
