import { z } from 'zod';

/** Una evidencia: el texto exacto que tiene que estar en un archivo de un repo. */
export const Evidence = z.object({
  file: z.string().min(1),
  contains: z.string().min(1),
});
export type Evidence = z.infer<typeof Evidence>;

const Extract = z.object({
  type: z.enum(['ts-const', 'md-table']),
  file: z.string(),
  name: z.string().optional(),
  path: z.string().optional(),
  section: z.string().optional(),
  map: z.record(z.string()).optional(),
});

export const Product = z.object({
  id: z.string().regex(/^[a-z0-9-]+$/),
  name: z.string(),
  brand_owner: z.string(),
  status: z.enum(['active', 'in_development', 'paused', 'retired']),
  marketable: z.boolean(),
  category: z.string(),
  tagline: z.string(),
  country: z.string().default('AR'),
  currency: z.string().default('ARS'),
  language: z.string().default('es-AR'),
  urls: z.object({ home: z.string().url(), conv: z.string().url(), demo: z.string().optional() }).catchall(z.string()),
  repo: z.object({ github: z.string(), git: z.string().url(), branch: z.string(), local: z.string() }),
  stack: z.array(z.string()).default([]),
  sales_path: z.enum(['direct_checkout', 'assisted']),
  conv: z.object({
    path: z.string(),
    primary_action: z.string(),
    secondary_actions: z.array(z.string()).default([]),
    variants: z.array(z.string()),
    events: z.array(z.string()),
    purchase_event: z.string().optional(),
    pixel_env: z.string().optional(),
    capi_env: z.string().optional(),
    lead_store: z.string().optional(),
    purchase_store: z.string().optional(),
  }),
  audiences: z.array(z.object({ id: z.string(), label: z.string(), detail: z.string().optional(), evidence: Evidence })),
  not_for: z.array(z.object({ text: z.string(), evidence: Evidence })).default([]),
  angles: z.array(
    z.object({
      id: z.string(),
      conv_variant: z.string(),
      audience: z.string(),
      eyebrow: z.string(),
      headline: z.string(),
      body: z.string(),
      evidence: Evidence,
      assets: z.array(z.string()),
    })
  ),
  claims: z.array(z.object({ id: z.string(), text: z.string(), kind: z.enum(['feature', 'pricing', 'offer', 'proof']), evidence: Evidence })),
  pricing: z.object({ currency: z.string(), tax: z.string(), as_of_evidence: Evidence, extract: Extract }),
  features_extract: Extract.optional(),
  assets: z.array(
    z.object({
      id: z.string(),
      kind: z.enum(['screenshot', 'recording', 'logo']),
      file: z.string(),
      what: z.string(),
      data: z.string(),
      device: z.enum(['desktop', 'phone', 'desktop-strip']),
    })
  ),
  brand: z.object({
    logo: z.string().optional(),
    colors: z.object({ bg: z.string(), bgDeep: z.string(), surface: z.string(), text: z.string(), textSoft: z.string(), accent: z.string(), accentStrong: z.string(), onAccent: z.string() }),
    fonts: z.object({ display: z.string(), body: z.string() }),
    evidence: Evidence.optional(),
  }),
  cta: z.object({ default: z.string(), meta_cta_type: z.string(), options: z.array(z.string()) }),
  rules: z.array(z.string()).default([]),
  blockers: z.array(z.object({ id: z.string(), severity: z.enum(['low', 'medium', 'high']), detail: z.string() })).default([]),
});
export type Product = z.infer<typeof Product>;
export type Angle = Product['angles'][number];
export type Claim = Product['claims'][number];
export type Asset = Product['assets'][number];

/** Lo que el análisis sacó del repo, con su verificación. */
export interface ProductFacts {
  productId: string;
  commit: string | null;
  analyzedAt: string;
  evidence: { ref: string; ok: boolean; file: string; reason?: string }[];
  pricing: { plans: Record<string, unknown>[]; ok: boolean; reason?: string };
  features: { name: string; description: string }[];
  assets: { id: string; ok: boolean; bytes?: number; reason?: string }[];
  /** Claims y ángulos usables: los que tienen la evidencia verificada. */
  verifiedClaims: string[];
  verifiedAngles: string[];
}
