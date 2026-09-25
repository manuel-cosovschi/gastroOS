'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { Loader2 } from 'lucide-react';
import { updateOrderStatus } from '@/actions/orders';
import { cn } from '@/lib/utils';
import { ORDER_STATUS_LABELS, VALID_TRANSITIONS, type OrderStatus } from '@/types';

/**
 * Cambio de estado de un pedido.
 *
 * El siguiente estado natural se ofrece como acción principal; el resto de las
 * transiciones válidas quedan como secundarias. Cancelar se separa del resto
 * para que no se toque por error.
 */
export function OrderStatusActions({
  orderId,
  currentStatus,
}: {
  orderId: string;
  currentStatus: OrderStatus;
}) {
  const router = useRouter();
  const [pending, setPending] = useState<OrderStatus | null>(null);

  const available = VALID_TRANSITIONS[currentStatus];
  const forward = available.filter((status) => status !== 'cancelled');
  const [next, ...rest] = forward;

  const changeStatus = async (status: OrderStatus) => {
    if (status === 'cancelled' && !confirm('¿Cancelar este pedido?')) return;

    setPending(status);
    const result = await updateOrderStatus(orderId, status);
    setPending(null);

    if (!result.success) {
      toast.error(result.error || 'No se pudo cambiar el estado.');
      return;
    }

    toast.success(`Pedido marcado como "${ORDER_STATUS_LABELS[status]}"`);
    // Las advertencias de stock no bloquean: el pedido ya cambió de estado.
    result.warnings?.forEach((warning) => toast.warning(warning, { duration: 6000 }));
    router.refresh();
  };

  if (available.length === 0) {
    return (
      <p className="text-sm text-stone-500">
        Este pedido está cerrado: no admite más cambios de estado.
      </p>
    );
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      {next && (
        <StatusButton
          status={next}
          variant="primary"
          loading={pending === next}
          disabled={pending !== null}
          onClick={() => changeStatus(next)}
        />
      )}

      {rest.map((status) => (
        <StatusButton
          key={status}
          status={status}
          variant="secondary"
          loading={pending === status}
          disabled={pending !== null}
          onClick={() => changeStatus(status)}
        />
      ))}

      {available.includes('cancelled') && (
        <>
          <span className="mx-1 hidden h-5 w-px bg-stone-200 sm:block" />
          <StatusButton
            status="cancelled"
            variant="danger"
            loading={pending === 'cancelled'}
            disabled={pending !== null}
            onClick={() => changeStatus('cancelled')}
          />
        </>
      )}
    </div>
  );
}

function StatusButton({
  status,
  variant,
  loading,
  disabled,
  onClick,
}: {
  status: OrderStatus;
  variant: 'primary' | 'secondary' | 'danger';
  loading: boolean;
  disabled: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={cn(
        'inline-flex h-9 items-center gap-2 rounded-lg px-3.5 text-sm font-medium transition-colors disabled:opacity-50',
        variant === 'primary' && 'bg-stone-900 text-white hover:bg-stone-800',
        variant === 'secondary' &&
          'border border-stone-200 bg-white text-stone-700 hover:border-stone-300 hover:bg-stone-50',
        variant === 'danger' && 'text-rose-600 hover:bg-rose-50'
      )}
    >
      {loading && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
      {variant === 'primary' ? `Marcar como ${ORDER_STATUS_LABELS[status].toLowerCase()}` : ORDER_STATUS_LABELS[status]}
    </button>
  );
}
