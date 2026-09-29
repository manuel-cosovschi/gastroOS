import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { CheckCircle, Search } from 'lucide-react';

/**
 * El parámetro se llama `numero`: es el que manda el formulario del pedido.
 * Antes acá se leía `order`, así que el bloque con el número no se dibujaba
 * nunca y el cliente terminaba el pedido sin enterarse del único dato que
 * después le van a pedir para seguirlo.
 */
interface Props {
  searchParams: Promise<{ numero?: string }>;
}

export default async function ConfirmacionPage({ searchParams }: Props) {
  const { numero } = await searchParams;

  return (
    <main className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-lg text-center">
        <div className="flex justify-center">
          <CheckCircle className="h-16 w-16 text-green-500" />
        </div>

        <h1 className="mt-6 text-3xl font-bold text-stone-900">¡Pedido recibido!</h1>

        {numero ? (
          <>
            <p className="mt-4 text-lg text-stone-600">
              Tu pedido quedó registrado con el número
            </p>
            <p className="mt-2 text-4xl font-bold tabular tracking-tight text-stone-900">
              #{numero}
            </p>
            <p className="mt-2 text-sm text-stone-500">
              Anotalo o sacale una foto: con ese número seguís el estado cuando quieras.
            </p>
          </>
        ) : (
          <p className="mt-4 text-lg text-stone-600">Tu pedido quedó registrado correctamente.</p>
        )}

        {/*
          Acá antes decía que iba a llegar un email de confirmación y otro por
          cada cambio de estado. No existe: el sistema no manda mails todavía.
          Prometer algo que no pasa deja al cliente esperando y al negocio
          quedando mal, así que la pantalla dice lo que realmente ocurre.
        */}
        <div className="mt-6 rounded-lg border border-stone-200 bg-stone-50 p-4 text-left">
          <p className="text-sm text-stone-600">
            Revisamos cada pedido a mano para confirmar disponibilidad. Te contactamos por
            teléfono o WhatsApp con los datos que dejaste, y mientras tanto podés ver en qué
            estado está con tu número de pedido.
          </p>
        </div>

        <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:justify-center">
          {numero && (
            <Button asChild>
              <Link href={`/pedido/seguimiento/${numero}`}>
                <Search className="mr-2 h-4 w-4" />
                Seguir mi pedido
              </Link>
            </Button>
          )}
          <Button asChild variant={numero ? 'outline' : 'default'}>
            <Link href="/catalogo">Seguir comprando</Link>
          </Button>
          <Button asChild variant="outline">
            <Link href="/">Volver al inicio</Link>
          </Button>
        </div>
      </div>
    </main>
  );
}
