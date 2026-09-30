'use client';

import { useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Loader2 } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

/**
 * El ingreso de un cliente a su sistema.
 *
 * Sólo se monta en la instalación de un cliente, donde es toda la pantalla.
 * En `gastroos.shop` no aparece: ahí no hay ninguna cuenta de cliente que
 * pueda entrar, porque cada uno tiene su propia instalación con su propia
 * base de datos, y entra por su propio dominio.
 */
export function ClientAccess() {
  const router = useRouter();
  const next = useSearchParams().get('next') || '/admin';

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

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

  return (
    <form onSubmit={handleSubmit} className="surface space-y-4 p-6">
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
 * El formulario mientras carga.
 *
 * Es el `fallback` del `Suspense`: el formulario lee el `?next=` de la URL y
 * eso obliga a renderizarlo en el cliente, así que del servidor tiene que
 * salir algo con su forma y no un lugar vacío que después salta.
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
