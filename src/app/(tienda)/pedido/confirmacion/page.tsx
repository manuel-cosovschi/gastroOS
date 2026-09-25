import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { CheckCircle } from 'lucide-react';

interface Props {
  searchParams: Promise<{ order?: string }>;
}

export default async function ConfirmacionPage({ searchParams }: Props) {
  const { order } = await searchParams;

  return (
    <>
      <main className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-lg text-center">
          <div className="flex justify-center">
            <CheckCircle className="h-16 w-16 text-green-500" />
          </div>

          <h1 className="mt-6 text-3xl font-bold text-stone-900">
            ¡Pedido recibido!
          </h1>

          {order && (
            <p className="mt-4 text-lg text-stone-600">
              Tu pedido <strong>#{order}</strong> fue registrado correctamente.
            </p>
          )}

          <p className="mt-4 text-stone-500">
            Vas a recibir un email de confirmación con los detalles. Te vamos a
            contactar cuando revisemos tu pedido para confirmar disponibilidad.
          </p>

          <div className="mt-4 rounded-lg bg-stone-50 border border-stone-200 p-4">
            <p className="text-sm text-stone-600">
              Revisamos cada pedido manualmente para garantizar calidad y disponibilidad
              de ingredientes. Te avisamos por email cada vez que tu pedido cambie de estado.
            </p>
          </div>

          <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:justify-center">
            <Button asChild>
              <Link href="/catalogo">Seguir comprando</Link>
            </Button>
            <Button asChild variant="outline">
              <Link href="/">Volver al inicio</Link>
            </Button>
          </div>
        </div>
      </main>
    </>
  );
}
