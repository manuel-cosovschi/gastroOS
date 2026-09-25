import { z } from 'zod';

export const productSchema = z.object({
  name: z.string().min(1, 'El nombre es obligatorio'),
  category_id: z.string().uuid().optional().nullable(),
  short_description: z.string().optional(),
  long_description: z.string().optional(),
  ingredients: z.string().optional(),
  price: z.number().positive('El precio debe ser mayor a 0'),
  cost_override: z
    .union([z.number().nonnegative('El costo no puede ser negativo'), z.nan()])
    .optional()
    .nullable()
    .transform((value) => (value == null || Number.isNaN(value) ? null : value)),
  image_url: z.string().url().optional().nullable(),
  gallery_urls: z.array(z.string().url()).optional(),
  sale_unit: z.string().default('unidad'),
  min_quantity: z.number().int().min(1).default(1),
  min_advance_hours: z.number().int().min(1).optional().nullable(),
  batch_size: z.number().int().min(1).default(1),
  is_active: z.boolean().default(true),
});

export type ProductFormValues = z.infer<typeof productSchema>;
