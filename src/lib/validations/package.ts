import { z } from 'zod';

export const packageItemSchema = z.object({
  product_id: z.string().uuid(),
  quantity: z.number().int().min(1),
});

export const packageSchema = z.object({
  name: z.string().min(1, 'El nombre es obligatorio'),
  description: z.string().optional(),
  image_url: z.string().url().optional().nullable(),
  price: z.number().positive('El precio debe ser mayor a 0'),
  is_editable: z.boolean().default(false),
  is_active: z.boolean().default(true),
  items: z.array(packageItemSchema).min(1, 'El paquete debe tener al menos un producto'),
});

export type PackageFormValues = z.infer<typeof packageSchema>;
