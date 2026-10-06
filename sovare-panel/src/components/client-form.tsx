'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { createClientRecord, updateClientRecord } from '@/actions/clients';
import { Field } from '@/components/ui';
import { todayISO } from '@/lib/utils';
import { CLIENT_STATUSES, CLIENT_STATUS_META, type Client } from '@/types';

/**
 * Alta y edición del cliente.
 *
 * Es un formulario largo y a propósito no está partido en pasos: quien lo
 * carga ya tiene los datos delante y un asistente de cuatro pantallas sólo
 * agrega clics. Se agrupa en bloques para que se pueda saltear lo que todavía
 * no se sabe —casi todo es opcional menos el nombre.
 */
export function ClientForm({ client }: { client?: Client }) {
  const router = useRouter();
  const [saving, setSaving] = useState(false);

  const submit = async (formData: FormData) => {
    setSaving(true);
    const result = client
      ? await updateClientRecord(client.id, formData)
      : await createClientRecord(formData);
    setSaving(false);

    if (!result.success) {
      toast.error(result.error ?? 'No se pudo guardar.');
      return;
    }

    toast.success(client ? 'Cambios guardados.' : 'Cliente creado.');
    router.push(`/clientes/${result.id}`);
    router.refresh();
  };

  return (
    <form action={submit} className="space-y-6">
      <Block title="El negocio">
        <Field label="Nombre del negocio" className="sm:col-span-2">
          <input name="business_name" className="field" defaultValue={client?.business_name} required />
        </Field>
        <Field label="Rubro">
          <input
            name="industry"
            className="field"
            defaultValue={client?.industry ?? ''}
            placeholder="Pastelería, catering…"
          />
        </Field>
        <Field label="Ciudad">
          <input name="city" className="field" defaultValue={client?.city ?? ''} />
        </Field>
      </Block>

      <Block title="Contacto">
        <Field label="Nombre">
          <input name="contact_name" className="field" defaultValue={client?.contact_name ?? ''} />
        </Field>
        <Field label="WhatsApp" hint="Con código de país, sin + ni espacios">
          <input
            name="whatsapp"
            className="field"
            defaultValue={client?.whatsapp ?? ''}
            placeholder="5492235383082"
          />
        </Field>
        <Field label="Email">
          <input name="email" type="email" className="field" defaultValue={client?.email ?? ''} />
        </Field>
        <Field label="De dónde vino" hint="Instagram, recomendación, la web…">
          <input name="source" className="field" defaultValue={client?.source ?? ''} />
        </Field>
      </Block>

      <Block title="Estado">
        <Field label="Situación">
          <select name="status" className="field" defaultValue={client?.status ?? 'prospecto'}>
            {CLIENT_STATUSES.map((status) => (
              <option key={status} value={status}>
                {CLIENT_STATUS_META[status].label}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Primer contacto">
          <input
            name="first_contact_at"
            type="date"
            className="field"
            defaultValue={client?.first_contact_at ?? todayISO()}
          />
        </Field>
        <Field label="Alta como cliente">
          <input
            name="started_at"
            type="date"
            className="field"
            defaultValue={client?.started_at ?? ''}
          />
        </Field>
        <Field label="Baja">
          <input
            name="churned_at"
            type="date"
            className="field"
            defaultValue={client?.churned_at ?? ''}
          />
        </Field>
      </Block>

      <Block title="Suscripción">
        <Field label="Plan">
          <input name="plan" className="field" defaultValue={client?.plan ?? ''} />
        </Field>
        <Field label="Mensualidad">
          <input
            name="monthly_amount"
            type="number"
            min="0"
            step="100"
            className="field"
            defaultValue={client?.monthly_amount ?? ''}
          />
        </Field>
        <Field label="Puesta a punto" hint="Pago único de la implementación">
          <input
            name="setup_amount"
            type="number"
            min="0"
            step="100"
            className="field"
            defaultValue={client?.setup_amount ?? ''}
          />
        </Field>
        <Field label="Moneda">
          <input name="currency" className="field" defaultValue={client?.currency ?? 'ARS'} />
        </Field>
        <Field label="Día de cobro" hint="Del 1 al 28, para que exista en todos los meses">
          <input
            name="billing_day"
            type="number"
            min="1"
            max="28"
            className="field"
            defaultValue={client?.billing_day ?? ''}
          />
        </Field>
      </Block>

      <Block title="Su instalación">
        <Field label="URL del panel">
          <input name="panel_url" className="field" defaultValue={client?.panel_url ?? ''} />
        </Field>
        <Field label="URL de la tienda">
          <input
            name="storefront_url"
            className="field"
            defaultValue={client?.storefront_url ?? ''}
          />
        </Field>
        <Field label="Proyecto de Supabase" hint="El ref, para encontrarlo rápido">
          <input name="supabase_ref" className="field" defaultValue={client?.supabase_ref ?? ''} />
        </Field>
        <Field label="Proyecto de Vercel">
          <input
            name="vercel_project"
            className="field"
            defaultValue={client?.vercel_project ?? ''}
          />
        </Field>
        <Field label="Repositorio" className="sm:col-span-2">
          <input name="repo_url" className="field" defaultValue={client?.repo_url ?? ''} />
        </Field>
      </Block>

      <Block title="Prospección">
        <Field
          label="Asunto del mail"
          hint="Corto y concreto de este negocio. Si queda vacío, el botón de mail usa la segunda oración del mensaje recortada, que funciona pero se nota."
          className="sm:col-span-2"
        >
          <input
            name="outreach_subject"
            className="field"
            defaultValue={client?.outreach_subject ?? ''}
          />
        </Field>
        <Field
          label="Mensaje para escribirle"
          hint="Es lo que el botón de WhatsApp precarga. Conviene que arranque con algo cierto y puntual de este negocio: eso es lo que separa un mensaje de una plantilla."
          className="sm:col-span-2"
        >
          <textarea
            name="outreach_message"
            rows={6}
            className="field h-auto py-2"
            defaultValue={client?.outreach_message ?? ''}
          />
        </Field>
        <Field
          label="De dónde salió el contacto"
          hint="La página donde vimos el teléfono. Cuando el chat no existe, es dónde ir a mirar."
          className="sm:col-span-2"
        >
          <input name="source_url" className="field" defaultValue={client?.source_url ?? ''} />
        </Field>
      </Block>

      <Block title="Notas">
        <Field label="Lo que no entra en ningún campo" className="sm:col-span-2">
          <textarea
            name="notes"
            rows={4}
            className="field h-auto py-2"
            defaultValue={client?.notes ?? ''}
          />
        </Field>
      </Block>

      <div className="flex items-center gap-3">
        <button
          type="submit"
          disabled={saving}
          className="inline-flex h-10 items-center gap-2 rounded-lg bg-brand-800 px-5 text-sm font-medium text-white transition-colors hover:bg-brand-900 disabled:opacity-60"
        >
          {saving && <Loader2 className="h-4 w-4 animate-spin" />}
          {client ? 'Guardar cambios' : 'Crear cliente'}
        </button>
        <Link
          href={client ? `/clientes/${client.id}` : '/clientes'}
          className="text-sm text-stone-500 transition-colors hover:text-stone-900"
        >
          Cancelar
        </Link>
      </div>
    </form>
  );
}

function Block({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="surface p-5">
      <h2 className="text-sm font-semibold text-stone-900">{title}</h2>
      <div className="mt-4 grid gap-4 sm:grid-cols-2">{children}</div>
    </section>
  );
}
