'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { Loader2 } from 'lucide-react';
import { createCustomer, updateCustomer } from '@/actions/customers';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import type { Customer } from '@/types';

export function CustomerForm({ customer }: { customer?: Customer }) {
  const router = useRouter();
  const isEditing = !!customer;

  const [form, setForm] = useState({
    first_name: customer?.first_name || '',
    last_name: customer?.last_name || '',
    phone: customer?.phone || '',
    email: customer?.email || '',
    instagram: customer?.instagram || '',
    address: customer?.address || '',
    notes: customer?.notes || '',
  });
  const [saving, setSaving] = useState(false);

  const setField = (key: keyof typeof form) => (value: string) =>
    setForm((current) => ({ ...current, [key]: value }));

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!form.first_name.trim()) return toast.error('El nombre es obligatorio.');

    setSaving(true);

    let savedId = customer?.id;
    let error: string | undefined;

    if (isEditing) {
      const result = await updateCustomer(customer.id, form);
      error = result.success ? undefined : result.error || 'No se pudo guardar el cliente.';
    } else {
      const result = await createCustomer(form);
      error = result.success ? undefined : result.error || 'No se pudo guardar el cliente.';
      savedId = result.customer?.id;
    }

    setSaving(false);

    if (error) {
      toast.error(error);
      return;
    }

    toast.success(isEditing ? 'Cliente actualizado' : 'Cliente creado');
    router.push(savedId ? `/admin/clientes/${savedId}` : '/admin/clientes');
    router.refresh();
  };

  return (
    <form onSubmit={handleSubmit} className="surface max-w-2xl space-y-4 p-5">
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Nombre *" id="first_name">
          <Input
            id="first_name"
            value={form.first_name}
            onChange={(event) => setField('first_name')(event.target.value)}
            required
          />
        </Field>
        <Field label="Apellido" id="last_name">
          <Input
            id="last_name"
            value={form.last_name}
            onChange={(event) => setField('last_name')(event.target.value)}
          />
        </Field>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Teléfono" id="phone">
          <Input
            id="phone"
            value={form.phone}
            onChange={(event) => setField('phone')(event.target.value)}
            inputMode="tel"
          />
        </Field>
        <Field label="Email" id="email">
          <Input
            id="email"
            type="email"
            value={form.email}
            onChange={(event) => setField('email')(event.target.value)}
          />
        </Field>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Instagram" id="instagram" hint="Sin @, se normaliza al guardar">
          <Input
            id="instagram"
            value={form.instagram}
            onChange={(event) => setField('instagram')(event.target.value)}
            placeholder="nombredelnegocio"
          />
        </Field>
        <Field label="Dirección" id="address">
          <Input
            id="address"
            value={form.address}
            onChange={(event) => setField('address')(event.target.value)}
          />
        </Field>
      </div>

      <Field label="Notas" id="notes" hint="Preferencias, alergias, referencias de entrega…">
        <Textarea
          id="notes"
          value={form.notes}
          onChange={(event) => setField('notes')(event.target.value)}
          rows={3}
        />
      </Field>

      <div className="flex items-center justify-end gap-2 border-t border-stone-100 pt-4">
        <Button type="button" variant="outline" onClick={() => router.back()}>
          Cancelar
        </Button>
        <Button type="submit" disabled={saving}>
          {saving && <Loader2 className="h-4 w-4 animate-spin" />}
          {isEditing ? 'Guardar cambios' : 'Crear cliente'}
        </Button>
      </div>
    </form>
  );
}

function Field({
  label,
  id,
  hint,
  children,
}: {
  label: string;
  id: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <Label htmlFor={id}>{label}</Label>
      <div className="mt-1.5">{children}</div>
      {hint && <p className="mt-1 text-xs text-stone-500">{hint}</p>}
    </div>
  );
}
