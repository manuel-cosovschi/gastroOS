'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { Loader2, Store } from 'lucide-react';
import { updateBusiness } from '@/actions/business';
import { ImageUpload } from '@/components/admin/products/image-upload';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { INDUSTRY_OPTIONS } from '@/lib/constants';
import type { Business } from '@/types';

/** Monedas y zonas horarias frecuentes en la región. La lista es ampliable. */
const CURRENCIES = ['ARS', 'USD', 'UYU', 'CLP', 'PEN', 'MXN', 'COP', 'EUR', 'BRL'];

const TIMEZONES = [
  'America/Argentina/Buenos_Aires',
  'America/Montevideo',
  'America/Santiago',
  'America/Lima',
  'America/Bogota',
  'America/Mexico_City',
  'America/Sao_Paulo',
  'Europe/Madrid',
];

export function BusinessSettingsForm({ business }: { business: Business }) {
  const router = useRouter();
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    name: business.name,
    industry: business.industry || '',
    logo_url: business.logo_url,
    phone: business.phone || '',
    email: business.email || '',
    instagram: business.instagram || '',
    address: business.address || '',
    currency: business.currency,
    timezone: business.timezone,
    storefront_enabled: business.storefront_enabled,
  });

  const setField = <K extends keyof typeof form>(key: K, value: (typeof form)[K]) =>
    setForm((current) => ({ ...current, [key]: value }));

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!form.name.trim()) return toast.error('El nombre comercial es obligatorio.');

    setSaving(true);
    const result = await updateBusiness(form);
    setSaving(false);

    if (!result.success) {
      toast.error(result.error || 'No se pudo guardar.');
      return;
    }

    toast.success('Configuración guardada');
    router.refresh();
  };

  return (
    <form onSubmit={handleSubmit} className="max-w-3xl space-y-6">
      <section className="surface p-5">
        <h2 className="mb-4 text-sm font-semibold text-stone-900">Mi negocio</h2>

        <div className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <Label htmlFor="name">Nombre comercial *</Label>
              <Input
                id="name"
                value={form.name}
                onChange={(event) => setField('name', event.target.value)}
                className="mt-1.5"
                required
              />
            </div>

            <div>
              <Label htmlFor="industry">Rubro</Label>
              <Input
                id="industry"
                list="industries"
                value={form.industry}
                onChange={(event) => setField('industry', event.target.value)}
                placeholder="Pastelería artesanal"
                className="mt-1.5"
              />
              <datalist id="industries">
                {INDUSTRY_OPTIONS.map((option) => (
                  <option key={option} value={option} />
                ))}
              </datalist>
            </div>
          </div>

          <div>
            <Label>Logo</Label>
            <div className="mt-1.5">
              <ImageUpload
                value={form.logo_url}
                onChange={(url) => setField('logo_url', url)}
              />
            </div>
          </div>
        </div>
      </section>

      <section className="surface p-5">
        <h2 className="mb-4 text-sm font-semibold text-stone-900">Contacto</h2>

        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <Label htmlFor="phone">Teléfono</Label>
            <Input
              id="phone"
              value={form.phone}
              onChange={(event) => setField('phone', event.target.value)}
              className="mt-1.5"
              inputMode="tel"
            />
          </div>
          <div>
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              type="email"
              value={form.email}
              onChange={(event) => setField('email', event.target.value)}
              className="mt-1.5"
            />
          </div>
          <div>
            <Label htmlFor="instagram">Instagram</Label>
            <Input
              id="instagram"
              value={form.instagram}
              onChange={(event) => setField('instagram', event.target.value)}
              placeholder="minegocio"
              className="mt-1.5"
            />
          </div>
          <div>
            <Label htmlFor="address">Dirección</Label>
            <Input
              id="address"
              value={form.address}
              onChange={(event) => setField('address', event.target.value)}
              className="mt-1.5"
            />
          </div>
        </div>
      </section>

      <section className="surface p-5">
        <h2 className="mb-4 text-sm font-semibold text-stone-900">Regional</h2>

        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <Label htmlFor="currency">Moneda</Label>
            <select
              id="currency"
              value={form.currency}
              onChange={(event) => setField('currency', event.target.value)}
              className="mt-1.5 h-10 w-full rounded-md border border-stone-300 bg-white px-3 text-sm"
            >
              {CURRENCIES.map((currency) => (
                <option key={currency} value={currency}>
                  {currency}
                </option>
              ))}
            </select>
            <p className="mt-1 text-xs text-stone-500">
              Todos los importes de la aplicación se muestran en esta moneda.
            </p>
          </div>

          <div>
            <Label htmlFor="timezone">Zona horaria</Label>
            <select
              id="timezone"
              value={form.timezone}
              onChange={(event) => setField('timezone', event.target.value)}
              className="mt-1.5 h-10 w-full rounded-md border border-stone-300 bg-white px-3 text-sm"
            >
              {TIMEZONES.map((timezone) => (
                <option key={timezone} value={timezone}>
                  {timezone.replace(/_/g, ' ')}
                </option>
              ))}
            </select>
          </div>
        </div>
      </section>

      <section className="surface p-5">
        <div className="flex items-start gap-3">
          <Store className="mt-0.5 h-4 w-4 shrink-0 text-stone-400" />
          <div className="flex-1">
            <h2 className="text-sm font-semibold text-stone-900">Tienda pública</h2>
            <p className="mt-1 text-sm text-stone-500">
              Publica tu catálogo para que tus clientes carguen el pedido solos. Los pedidos
              entran directo al panel como pendientes.
            </p>

            <label className="mt-3 inline-flex cursor-pointer items-center gap-2">
              <input
                type="checkbox"
                checked={form.storefront_enabled}
                onChange={(event) => setField('storefront_enabled', event.target.checked)}
                className="h-4 w-4 rounded border-stone-300 text-brand-600 focus:ring-brand-500"
              />
              <span className="text-sm text-stone-700">Tienda pública activa</span>
            </label>
          </div>
        </div>
      </section>

      <div className="flex justify-end">
        <Button type="submit" disabled={saving}>
          {saving && <Loader2 className="h-4 w-4 animate-spin" />}
          Guardar cambios
        </Button>
      </div>
    </form>
  );
}
