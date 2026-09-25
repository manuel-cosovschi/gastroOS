import { CartSummary } from '@/components/cart/cart-summary';
import { OrderForm } from '@/components/order/order-form';

export default function PedidoPage() {
  return (
    <>
      <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        <h1 className="text-3xl font-bold text-stone-900">Tu pedido</h1>
        <p className="mt-2 text-stone-500">
          Revisá tu pedido, completá tus datos y envialo.
        </p>

        <div className="mt-8 grid grid-cols-1 gap-8 lg:grid-cols-5">
          {/* Cart */}
          <div className="lg:col-span-2">
            <div className="rounded-lg border border-stone-200 bg-white p-6">
              <CartSummary />
            </div>
          </div>

          {/* Form */}
          <div className="lg:col-span-3">
            <div className="rounded-lg border border-stone-200 bg-white p-6">
              <OrderForm />
            </div>
          </div>
        </div>
      </main>
    </>
  );
}
