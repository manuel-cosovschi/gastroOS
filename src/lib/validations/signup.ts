import { z } from 'zod';

/**
 * El formulario de contratación. No incluye el monto ni el precio del plan a
 * propósito: eso lo pone el servidor leyendo `sovare.plans`. Lo único que elige
 * quien contrata es cuál plan, y eso se valida contra la tabla.
 */
export const signupFormSchema = z.object({
  business_name: z
    .string()
    .trim()
    .min(2, 'Necesitamos el nombre del negocio')
    .max(120, 'El nombre del negocio es muy largo'),
  contact_name: z.string().trim().min(2, '¿Con quién hablamos?').max(120, 'Ese nombre es muy largo'),
  email: z.string().trim().email('Revisá el email: ahí te mandamos todo').max(200),
  whatsapp: z
    .string()
    .trim()
    .min(8, 'Un WhatsApp con característica, para poder escribirte')
    .max(40, 'Revisá el WhatsApp'),
  city: z.string().trim().max(80).optional().or(z.literal('')),
  industry: z.string().trim().max(80).optional().or(z.literal('')),
  plan: z.string().trim().min(1, 'Elegí un plan'),
});

export type SignupFormValues = z.infer<typeof signupFormSchema>;

const libre = (max = 600) => z.string().trim().max(max).optional().or(z.literal(''));

/**
 * La encuesta de alta. Casi todo es opcional porque se completa una vez y de
 * apuro: es mejor recibir la mitad y preguntar el resto por WhatsApp que perder
 * el alta entera porque alguien no sabía su CUIT de memoria.
 */
export const onboardingSchema = z.object({
  legal_name: z.string().trim().min(2, 'El nombre del negocio, aunque sea el de todos los días'),
  display_name: libre(120),
  industry: libre(80),
  city: libre(80),
  address: libre(200),

  palette: libre(300),
  typography: libre(200),
  brand_notes: libre(),

  public_phone: libre(60),
  public_email: z.string().trim().email('Revisá este email').optional().or(z.literal('')),
  instagram: libre(80),

  delivery: libre(20),
  delivery_zones: libre(),
  pickup_hours: libre(300),
  advance_notice: libre(200),

  catalog_size: libre(80),
  uses_recipes: libre(20),

  domain: libre(120),
  team: libre(300),

  extra: libre(1200),
});

export type OnboardingFormValues = z.infer<typeof onboardingSchema>;

/**
 * La contraseña que elige quien contrató un plan de autoservicio.
 *
 * El tope de 72 es el de bcrypt, que es lo que usa Supabase por debajo: pasado
 * eso los caracteres sobrantes se ignoran en silencio, y quien eligió una frase
 * larga entraría con cualquier continuación.
 */
export const passwordSchema = z
  .string()
  .min(8, 'La contraseña tiene que tener al menos 8 caracteres')
  .max(72, 'La contraseña puede tener hasta 72 caracteres');
