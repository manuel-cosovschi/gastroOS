import { z } from 'zod';
import { DELIVERY_METHODS, PAYMENT_METHODS } from '@/types';

export const orderItemSchema = z
  .object({
    product_id: z.string().uuid().optional(),
    package_id: z.string().uuid().optional(),
    quantity: z.number().int().min(1, 'La cantidad debe ser al menos 1'),
    notes: z.string().optional(),
  })
  .refine((data) => data.product_id || data.package_id, {
    message: 'Cada línea debe referenciar un producto o un combo',
  });

/** Pedido cargado desde el panel: el negocio puede omitir datos de contacto. */
export const adminOrderSchema = z
  .object({
    customer_id: z.string().uuid().optional(),
    contact_name: z.string().min(1, 'El nombre del cliente es obligatorio'),
    phone: z.string().optional(),
    email: z.string().email('Email inválido').optional().or(z.literal('')),
    delivery_method: z.enum(DELIVERY_METHODS),
    address: z.string().optional(),
    city: z.string().optional(),
    delivery_date: z.string().min(1, 'La fecha de entrega es obligatoria'),
    delivery_time: z.string().optional(),
    deposit_amount: z.number().min(0).optional(),
    payment_method: z.enum(PAYMENT_METHODS).optional(),
    observations: z.string().optional(),
    admin_notes: z.string().optional(),
    items: z.array(orderItemSchema).min(1, 'El pedido debe tener al menos un producto'),
  })
  .refine((data) => data.delivery_method !== 'delivery' || !!data.address?.trim(), {
    message: 'La dirección es obligatoria para envíos a domicilio',
    path: ['address'],
  });

/** Pedido desde la tienda pública: contacto obligatorio y fecha no pasada. */
export const storefrontOrderSchema = z
  .object({
    contact_name: z.string().min(1, 'El nombre es obligatorio'),
    phone: z.string().min(6, 'El teléfono es obligatorio'),
    email: z.string().email('Email inválido'),
    delivery_method: z.enum(DELIVERY_METHODS),
    address: z.string().optional(),
    city: z.string().optional(),
    delivery_date: z
      .string()
      .min(1, 'La fecha de entrega es obligatoria')
      .refine((value) => {
        const [y, m, d] = value.split('-').map(Number);
        if (!y || !m || !d) return false;
        const picked = new Date(y, m - 1, d);
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        return picked.getTime() >= today.getTime();
      }, 'La fecha de entrega no puede ser anterior a hoy'),
    observations: z.string().optional(),
    items: z.array(orderItemSchema).min(1, 'El pedido debe tener al menos un producto'),
  })
  .refine((data) => data.delivery_method !== 'delivery' || !!data.address?.trim(), {
    message: 'La dirección es obligatoria para envíos a domicilio',
    path: ['address'],
  });

export type AdminOrderValues = z.infer<typeof adminOrderSchema>;
export type StorefrontOrderValues = z.infer<typeof storefrontOrderSchema>;
