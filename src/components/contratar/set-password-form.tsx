'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Eye, EyeOff, Loader2 } from 'lucide-react';
import { setOwnerPassword } from '@/actions/signups';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

/**
 * Elegir la contraseña de la cuenta recién creada.
 *
 * Usa `onSubmit` y no `<form action>`: con una acción de formulario, React 19
 * vacía los campos cuando la acción termina, aunque haya devuelto un error, y
 * quien se equivocó en una letra tendría que escribir todo de nuevo.
 *
 * Al terminar bien, la sesión ya está abierta (la abre el servidor), así que se
 * va directo al panel. Si no se pudo abrir, se lo manda a la pantalla de acceso
 * con la contraseña que acaba de elegir.
 */
export function SetPasswordForm({ token }: { token: string }) {
  const router = useRouter();
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [visible, setVisible] = useState(false);
  const [error, setError] = useState('');
  const [pending, setPending] = useState(false);

  const onSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError('');

    if (password.length < 8) {
      setError('La contraseña tiene que tener al menos 8 caracteres.');
      return;
    }
    if (password !== confirm) {
      setError('Las dos contraseñas no coinciden.');
      return;
    }

    setPending(true);
    const result = await setOwnerPassword(token, password);
    if (!result.success) {
      setPending(false);
      setError(result.error);
      return;
    }

    router.push(result.data.signedIn ? '/admin' : '/login');
    router.refresh();
  };

  return (
    <form onSubmit={onSubmit} className="mt-5 space-y-4" noValidate>
      <div>
        <Label htmlFor="new-password">Elegí tu contraseña</Label>
        <div className="relative mt-1.5">
          <Input
            id="new-password"
            type={visible ? 'text' : 'password'}
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            autoComplete="new-password"
            placeholder="Al menos 8 caracteres"
            className="pr-10"
            required
          />
          <button
            type="button"
            onClick={() => setVisible((current) => !current)}
            className="absolute inset-y-0 right-0 flex w-10 items-center justify-center text-stone-400 hover:text-stone-600"
            aria-label={visible ? 'Ocultar la contraseña' : 'Mostrar la contraseña'}
          >
            {visible ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
          </button>
        </div>
      </div>

      <div>
        <Label htmlFor="confirm-password">Repetila</Label>
        <Input
          id="confirm-password"
          type={visible ? 'text' : 'password'}
          value={confirm}
          onChange={(event) => setConfirm(event.target.value)}
          autoComplete="new-password"
          className="mt-1.5"
          required
        />
      </div>

      {error && (
        <p role="alert" className="text-sm text-rose-600">
          {error}
        </p>
      )}

      <Button type="submit" size="lg" className="w-full" disabled={pending}>
        {pending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
        Entrar a mi panel
      </Button>
    </form>
  );
}
