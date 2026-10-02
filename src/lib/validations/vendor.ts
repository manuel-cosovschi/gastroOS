import { z } from 'zod';

const libre = (max: number) => z.string().trim().max(max).optional().or(z.literal(''));

/**
 * Lo que un vendedor carga de un cliente.
 *
 * Pide poco: lo que el vendedor sabe de alguien con quien acaba de cerrar. El plan
 * es obligatorio porque de ahí sale la comisión, pero no es definitivo: lo
 * confirma el dueño al aprobar.
 *
 * Tiene que haber alguna forma de encontrar al cliente. Sin teléfono ni mail no
 * hay nada que verificar, y aprobar una comisión sobre un cliente que no se puede
 * ubicar es pagar a ciegas.
 */
export const vendorSaleSchema = z
  .object({
    business_name: z.string().trim().min(2, 'Poné el nombre del negocio').max(120),
    contact_name: libre(120),
    whatsapp: libre(40),
    email: z.string().trim().email('Revisá el mail').optional().or(z.literal('')),
    city: libre(80),
    industry: libre(80),
    plan: z.string().trim().min(1, 'Elegí el plan que contrató'),
    notes: libre(600),
  })
  .refine(
    (value) => {
      const digits = (value.whatsapp ?? '').replace(/\D/g, '');
      return digits.length >= 8 || Boolean(value.email);
    },
    { message: 'Poné un WhatsApp o un mail del cliente, para poder ubicarlo', path: ['whatsapp'] }
  );

export type VendorSaleValues = z.infer<typeof vendorSaleSchema>;
