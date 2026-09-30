'use client';

import { Suspense, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Loader2 } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Logo } from '@/components/brand/logo';
import { EnterDemoButton } from '@/components/demo/enter-demo-button';
import { APP_TAGLINE, DEMO_MODE } from '@/lib/constants';

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const next = searchParams.get('next') || '/admin';

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
    <div className="flex min-h-screen items-center justify-center bg-stone-50 px-4 py-12">
      <div className="w-full max-w-sm">
        <div className="mb-8 flex flex-col items-center text-center">
          <Logo size="lg" className="flex-col gap-3" />
          <p className="mt-3 text-sm text-stone-500">{APP_TAGLINE}</p>
        </div>

        {/*
          La demo va primero y con su propio botón. Antes esta pantalla le
          pedía al visitante "la contraseña configurada en DEMO_PASSWORD": una
          instrucción para el que programa, en la única pantalla que tiene que
          convencer a alguien que nunca vio el sistema. El que llega desde
          "Probar el sistema" entra de un toque; el formulario de abajo es para
          quien ya es cliente.
        */}
        {DEMO_MODE && (
          <div className="surface mb-4 space-y-3 p-6">
            <div className="text-center">
              <p className="text-sm font-semibold text-stone-900">Probá el sistema ahora</p>
              <p className="mt-1 text-sm leading-relaxed text-stone-600">
                Entrás con datos de ejemplo de una pastelería. No hace falta registrarse ni dejar
                ningún dato.
              </p>
            </div>
            <EnterDemoButton />
          </div>
        )}

        <form onSubmit={handleSubmit} className="surface space-y-4 p-6">
          {DEMO_MODE && (
            <p className="text-center text-sm font-medium text-stone-500">
              ¿Ya tenés tu sistema? Entrá acá
            </p>
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
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center bg-stone-50">
          <Loader2 className="h-5 w-5 animate-spin text-stone-400" />
        </div>
      }
    >
      <LoginForm />
    </Suspense>
  );
}
