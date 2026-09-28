'use client';

import { useState } from 'react';
import { Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { createClient } from '@/lib/supabase/client';

/**
 * Cambio de contraseña.
 *
 * Va contra Supabase desde el navegador y no por una server action: `updateUser`
 * necesita la sesión del usuario, y hacerlo del lado del cliente evita tener
 * que mover la contraseña nueva por el servidor para nada.
 *
 * El mínimo de 8 caracteres no es un capricho nuestro: es el que pide Supabase,
 * y si no lo chequeamos acá el error que vuelve está en inglés.
 */

const MIN_LENGTH = 8;

export function PasswordForm() {
  const [password, setPassword] = useState('');
  const [repeat, setRepeat] = useState('');
  const [saving, setSaving] = useState(false);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();

    if (password.length < MIN_LENGTH) {
      toast.error(`La contraseña tiene que tener al menos ${MIN_LENGTH} caracteres.`);
      return;
    }
    if (password !== repeat) {
      toast.error('Las dos contraseñas no coinciden.');
      return;
    }

    setSaving(true);
    const { error } = await createClient().auth.updateUser({ password });
    setSaving(false);

    if (error) {
      toast.error(
        error.message.includes('should be different')
          ? 'Esa es la contraseña que ya tenías.'
          : 'No se pudo cambiar la contraseña.'
      );
      return;
    }

    setPassword('');
    setRepeat('');
    toast.success('Contraseña cambiada. La próxima vez entrás con la nueva.');
  };

  return (
    <form onSubmit={submit} className="space-y-4">
      <div>
        <label htmlFor="password" className="field-label">
          Contraseña nueva
        </label>
        <input
          id="password"
          type="password"
          className="field"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          autoComplete="new-password"
          minLength={MIN_LENGTH}
          required
        />
      </div>

      <div>
        <label htmlFor="repeat" className="field-label">
          Repetila
        </label>
        <input
          id="repeat"
          type="password"
          className="field"
          value={repeat}
          onChange={(event) => setRepeat(event.target.value)}
          autoComplete="new-password"
          minLength={MIN_LENGTH}
          required
        />
      </div>

      <button
        type="submit"
        disabled={saving}
        className="inline-flex h-10 items-center gap-2 rounded-lg bg-brand-800 px-5 text-sm font-medium text-white transition-colors hover:bg-brand-900 disabled:opacity-60"
      >
        {saving && <Loader2 className="h-4 w-4 animate-spin" />}
        Cambiar contraseña
      </button>
    </form>
  );
}
