'use client';

import { useState, useTransition } from 'react';
import { ArrowRight, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { enterDemo } from '@/actions/demo';
import { cn } from '@/lib/utils';

/**
 * Botón de entrada a la demo.
 *
 * Sin formulario y sin contraseña: un toque y adentro. La sesión la abre el
 * servidor; acá sólo se muestra el estado mientras tanto.
 */
export function EnterDemoButton({
  label = 'Entrar a la demo',
  size = 'lg',
  className,
}: {
  label?: string;
  size?: 'default' | 'sm' | 'lg';
  className?: string;
}) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  return (
    <div className={cn('w-full', className)}>
      <Button
        size={size}
        className="w-full"
        disabled={pending}
        onClick={() =>
          startTransition(async () => {
            setError(null);
            // Si sale bien no vuelve: la acción redirige al panel.
            const result = await enterDemo();
            if (result?.error) setError(result.error);
          })
        }
      >
        {pending ? (
          <>
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            Abriendo la demo…
          </>
        ) : (
          <>
            {label}
            <ArrowRight className="ml-2 h-4 w-4" />
          </>
        )}
      </Button>
      {error && <p className="mt-2 text-center text-sm text-rose-600">{error}</p>}
    </div>
  );
}
