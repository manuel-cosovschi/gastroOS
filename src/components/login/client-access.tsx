'use client';

import { useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { KeyRound, Loader2 } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { DEMO_MODE } from '@/lib/constants';

/**
 * La puerta de los clientes.
 *
 * Está detrás de un botón a propósito. Esta pantalla atiende a dos personas
 * distintas —una que nunca vio el sistema y llegó desde "Probar el sistema", y
 * otra que ya tiene su instalación y viene a trabajar— y antes las dos cosas
 * se veían como un solo bloque con un formulario suelto abajo: el que venía a
 * probar se quedaba mirando dos campos que no tenía cómo completar.
 *
 * En la instalación de un cliente `DEMO_MODE` es falso: ahí no hay demo, no
 * hay nada que separar y el formulario está abierto de entrada.
 */
export function ClientAccess() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const next = searchParams.get('next') || '/admin';

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  // Si el middleware lo mandó acá desde una pantalla del panel, ya sabemos que
  // venía a entrar a lo suyo: el formulario arranca abierto.
  const [open, setOpen] = useState(!DEMO_MODE || searchParams.has('next'));

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError('');
    setLoading(true);

    const supabase = createClient();
    const { error: authError } = await supabase.auth.signInWithPassword({ email, password });

    if (authError) {
      setError('Email o contraseña incorrectos.');
      setLoading(false);
      return;
    }

    router.push(next);
    router.refresh();
  };

  if (!open) return <ClientAccessClosed onOpen={() => setOpen(true)} />;

  return (
    <form onSubmit={handleSubmit} className="surface space-y-4 p-6">
      {DEMO_MODE && (
        <div className="text-center">
          <p className="text-sm font-semibold text-stone-900">Entrá a tu sistema</p>
          <p className="mt-1 text-sm text-stone-600">Con el mail y la contraseña de tu negocio.</p>
        </div>
      )}

      <div>
        <Label htmlFor="email">Email</Label>
        <Input
          id="email"
          type="email"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          className="mt-1.5"
          autoComplete="email"
          required
        />
      </div>

      <div>
        <Label htmlFor="password">Contraseña</Label>
        <Input
          id="password"
          type="password"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          className="mt-1.5"
          autoComplete="current-password"
          required
        />
      </div>

      {error && <p className="text-sm text-rose-600">{error}</p>}

      <Button type="submit" className="w-full" disabled={loading}>
        {loading && <Loader2 className="h-4 w-4 animate-spin" />}
        Entrar
      </Button>
    </form>
  );
}

/**
 * La tarjeta cerrada.
 *
 * Se exporta aparte para que la página la use como `fallback` del `Suspense`:
 * así es lo que se pinta desde el servidor y lo que se ve mientras carga el
 * JavaScript, en vez de un lugar vacío que después salta.
 */
export function ClientAccessClosed({ onOpen }: { onOpen?: () => void }) {
  return (
    <div className="surface space-y-3 p-6 text-center">
      <p className="text-sm font-semibold text-stone-900">Ya tengo mi sistema</p>
      <p className="text-sm leading-relaxed text-stone-600">
        Si tu negocio ya trabaja con GastroOS, entrá a tu panel con el mail y la contraseña que te
        dimos.
      </p>
      <Button variant="outline" className="w-full" onClick={onOpen} disabled={!onOpen}>
        <KeyRound className="mr-2 h-4 w-4" />
        Entrar a mi sistema
      </Button>
    </div>
  );
}

/**
 * El formulario mientras carga, para la instalación de un cliente.
 *
 * Ahí no hay demo y el formulario está abierto de entrada, así que el
 * `fallback` tiene que tener su forma: con la tarjeta cerrada de arriba se
 * vería un instante la puerta equivocada.
 */
export function ClientAccessSkeleton() {
  return (
    <div className="surface space-y-4 p-6">
      <div className="space-y-1.5">
        <div className="h-3.5 w-14 rounded bg-stone-200/70" />
        <div className="h-10 w-full rounded-lg bg-stone-100" />
      </div>
      <div className="space-y-1.5">
        <div className="h-3.5 w-20 rounded bg-stone-200/70" />
        <div className="h-10 w-full rounded-lg bg-stone-100" />
      </div>
      <div className="h-10 w-full rounded-lg bg-stone-200/70" />
    </div>
  );
}
