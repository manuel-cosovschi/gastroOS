'use client';

import { createContext, useContext, useMemo } from 'react';
import { formatPrice as baseFormatPrice } from '@/lib/utils';
import { DEFAULT_CURRENCY, DEFAULT_LOCALE } from '@/lib/constants';
import type { Business } from '@/types';

interface BusinessContextValue {
  business: Business | null;
  /** Formatea con la moneda y el idioma configurados en el negocio. */
  money: (value: number | null | undefined, decimals?: boolean) => string;
  currencySymbol: string;
}

const BusinessContext = createContext<BusinessContextValue>({
  business: null,
  money: (value) => baseFormatPrice(value),
  currencySymbol: '$',
});

/**
 * Pone el negocio activo a disposición de los componentes cliente.
 *
 * Existe sobre todo por la moneda: ningún componente debería asumir pesos.
 * El negocio lo resuelve el layout del panel (server) y baja una sola vez.
 */
export function BusinessProvider({
  business,
  children,
}: {
  business: Business | null;
  children: React.ReactNode;
}) {
  const value = useMemo<BusinessContextValue>(() => {
    const currency = business?.currency || DEFAULT_CURRENCY;
    const locale = business?.locale || DEFAULT_LOCALE;

    return {
      business,
      money: (amount, decimals = false) =>
        baseFormatPrice(amount, { currency, locale, decimals }),
      currencySymbol:
        new Intl.NumberFormat(locale, { style: 'currency', currency })
          .formatToParts(0)
          .find((part) => part.type === 'currency')?.value || '$',
    };
  }, [business]);

  return <BusinessContext.Provider value={value}>{children}</BusinessContext.Provider>;
}

export function useBusiness() {
  return useContext(BusinessContext);
}

/** Atajo para el caso más frecuente: formatear un importe. */
export function useMoney() {
  return useContext(BusinessContext).money;
}
