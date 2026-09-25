import { notFound } from 'next/navigation';
import { getStorefrontBusiness } from '@/lib/business';
import { CartProvider } from '@/components/cart/cart-provider';
import { BusinessProvider } from '@/components/admin/business-provider';
import { StorefrontHeader } from '@/components/layout/header';
import { StorefrontFooter } from '@/components/layout/footer';

/**
 * Shell de la tienda pública.
 *
 * Todo lo que se ve (nombre, logo, contacto) sale del negocio configurado en
 * la base. Si no hay ninguno con la tienda habilitada, no existe tienda: 404.
 */
export default async function StorefrontLayout({ children }: { children: React.ReactNode }) {
  const business = await getStorefrontBusiness();
  if (!business) notFound();

  return (
    <BusinessProvider business={business}>
      <CartProvider>
        <div className="flex min-h-screen flex-col bg-white">
          <StorefrontHeader business={business} />
          <main className="flex-1">{children}</main>
          <StorefrontFooter business={business} />
        </div>
      </CartProvider>
    </BusinessProvider>
  );
}
