'use client';

import { Suspense, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { KeyRound, Loader2 } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Logo } from '@/components/brand/logo';
import { EnterDemoButton } from '@/components/demo/enter-demo-button';
import { APP_TAGLINE, DEMO_MODE } from '@/lib/constants';

/**
 * Esta pantalla atiende a dos personas distintas, y hasta ahora no lo decía.
 *
 * Una nunca vio el sistema y llegó desde "Probar el sistema": lo único que
 * tiene que hacer es tocar un botón. La otra ya es clienta, tiene su propia
 * instalación y viene a entrar a su negocio con su mail y su contraseña.
 *
 * Antes las dos cosas se veían como un solo bloque con un formulario suelto
 * abajo, y el que venía a probar se quedaba mirando dos campos que no tenía
 * cómo completar. Ahora la demo es la acción de la pantalla y el ingreso de
 * clientes está detrás de un botón que dice para quién es: el formulario
 * aparece sólo si alguien dice que es suyo.
 *
 * En la instalación de un cliente `DEMO_MODE` es falso: ahí no hay demo, no
 * hay nada que separar y el formulario es la pantalla entera, como siempre.
 */
function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const next = searchParams.get('next') || '/admin';

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  // Si el middleware lo mandó acá desde una pantalla del panel, ya sabemos que
  // venía a entrar a lo suyo: el formulario arranca abierto.
  const [showForm, setShowForm] = useState(!DEMO_MODE || searchParams.has('next'));

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

        {DEMO_MODE && (
          <div className="surface space-y-3 p-6">
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

        {DEMO_MODE && (
          <div className="my-5 flex items-center gap-3">
            <span className="h-px flex-1 bg-stone-200" />
            <span className="text-xs font-medium uppercase tracking-wider text-stone-400">o</span>
            <span className="h-px flex-1 bg-stone-200" />
          </div>
        )}

        {DEMO_MODE && !showForm ? (
          <div className="surface space-y-3 p-6 text-center">
            <p className="text-sm font-semibold text-stone-900">Ya tengo mi sistema</p>
            <p className="text-sm leading-relaxed text-stone-600">
              Si tu negocio ya trabaja con GastroOS, entrá a tu panel con el mail y la contraseña
              que te dimos.
            </p>
            <Button variant="outline" className="w-full" onClick={() => setShowForm(true)}>
              <KeyRound className="mr-2 h-4 w-4" />
              Entrar a mi sistema
            </Button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="surface space-y-4 p-6">
            {DEMO_MODE && (
              <div className="text-center">
                <p className="text-sm font-semibold text-stone-900">Entrá a tu sistema</p>
                <p className="mt-1 text-sm text-stone-600">
                  Con el mail y la contraseña de tu negocio.
                </p>
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
        )}

        {DEMO_MODE && (
          <p className="mt-6 text-center text-sm text-stone-500">
            ¿Todavía no tenés el tuyo?{' '}
            <Link href="/contratar" className="font-medium text-brand-700 hover:underline">
              Mirá los planes
            </Link>
          </p>
        )}
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
