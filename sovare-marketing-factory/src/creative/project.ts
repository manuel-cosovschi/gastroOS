/**
 * El proyecto editable de un creativo.
 *
 * Es un JSON con todo lo que el render necesita: textos, recursos, marca y la
 * línea de tiempo. Se guarda al lado del video (`project.json`); editarlo y
 * volver a renderizar (`smf render --project …`) rehace el video sin pasar por
 * el generador de conceptos.
 */

import { existsSync } from 'node:fs';
import type { Product, ProductFacts } from '../catalog/types.ts';
import { resolveRepoFile } from '../catalog/repos.ts';
import type { Concept, Template } from './concepts.ts';
import { FORMATS, type FormatId } from './formats.ts';

export interface Scene {
  id: 'hook' | 'demo' | 'tour' | 'claims' | 'cta';
  start: number;
  end: number;
}

export interface MediaRef {
  assetId: string;
  kind: 'screenshot' | 'recording';
  file: string;
  device: 'desktop' | 'phone' | 'desktop-strip';
  what: string;
}

export interface Project {
  version: 1;
  creativeId: string;
  productId: string;
  conceptId: string;
  template: Template;
  format: FormatId;
  width: number;
  height: number;
  safe: [number, number, number, number];
  fps: number;
  duration: number;
  brand: {
    name: string;
    domain: string;
    logo?: string;
    colors: Product['brand']['colors'];
    fonts: Product['brand']['fonts'];
  };
  text: {
    eyebrow: string;
    headline: string;
    bullets: string[];
    callout?: string;
    price?: string;
    priceNote?: string;
    cta: string;
    url: string;
    footer: string;
  };
  media: MediaRef[];
  timeline: Scene[];
}

const TIMELINES: Record<Template, (d: number) => Scene[]> = {
  demo: (d) => [
    { id: 'hook', start: 0, end: 2.8 },
    { id: 'demo', start: 2.8, end: d - 5.2 },
    { id: 'claims', start: d - 5.2, end: d - 2.4 },
    { id: 'cta', start: d - 2.4, end: d },
  ],
  tour: (d) => [
    { id: 'hook', start: 0, end: 2.6 },
    { id: 'tour', start: 2.6, end: d - 5 },
    { id: 'claims', start: d - 5, end: d - 2.4 },
    { id: 'cta', start: d - 2.4, end: d },
  ],
  kinetic: (d) => [
    { id: 'hook', start: 0, end: 4 },
    { id: 'tour', start: 4, end: d - 5.4 },
    { id: 'claims', start: d - 5.4, end: d - 2.4 },
    { id: 'cta', start: d - 2.4, end: d },
  ],
};

export function buildProject(args: {
  creativeId: string;
  product: Product;
  facts: ProductFacts;
  concept: Concept;
  format: FormatId;
  duration?: number;
}): Project {
  const { product, facts, concept } = args;
  const meta = concept.meta;
  if (!meta) throw new Error(`El concepto ${concept.id} no tiene metadatos de composición.`);
  const f = FORMATS[args.format];
  const duration = Math.max(10, Math.min(30, args.duration ?? 15));
  const template = meta.template;

  const okAssets = new Set(facts.assets.filter((a) => a.ok).map((a) => a.id));
  const byId = new Map(product.assets.map((a) => [a.id, a]));
  const wanted = (meta.assets.length ? meta.assets : product.assets.map((a) => a.id)).filter((id) => okAssets.has(id));
  let media: MediaRef[] = wanted
    .map((id) => byId.get(id)!)
    .filter((a) => a.kind !== 'logo')
    .map((a) => ({ assetId: a.id, kind: a.kind as MediaRef['kind'], file: resolveRepoFile(product, a.file), device: a.device, what: a.what }))
    .filter((m) => existsSync(m.file));
  // La plantilla «demo» abre con la grabación real si el ángulo tiene una; las
  // otras recorren capturas. Dos recursos como máximo: con más, las
  // transiciones se comen la escena y nada se llega a leer.
  if (template === 'demo') {
    const rec = media.filter((m) => m.kind === 'recording').slice(0, 1);
    media = rec.length ? rec : media;
  }
  else media = [...media.filter((m) => m.kind !== 'recording'), ...media.filter((m) => m.kind === 'recording')];
  if (!media.length) throw new Error(`${product.name}: el ángulo ${concept.angle} no tiene capturas disponibles.`);

  const conv = new URL(product.urls.conv);
  const logo = product.brand.logo ? resolveRepoFile(product, product.brand.logo) : undefined;
  return {
    version: 1,
    creativeId: args.creativeId,
    productId: product.id,
    conceptId: concept.id,
    template,
    format: f.id,
    width: f.width,
    height: f.height,
    safe: f.safe,
    fps: 30,
    duration,
    brand: { name: product.name, domain: conv.host, logo: logo && existsSync(logo) ? logo : undefined, colors: product.brand.colors, fonts: product.brand.fonts },
    text: {
      eyebrow: concept.hook,
      headline: concept.headline,
      bullets: meta.bullets,
      callout: meta.bullets[0],
      price: meta.price?.line,
      priceNote: meta.price?.note,
      cta: concept.cta,
      url: `${conv.host}${conv.pathname}`,
      footer: `${product.name} · un producto de ${product.brand_owner}`,
    },
    media: media.slice(0, 2),
    timeline: TIMELINES[template](duration),
  };
}

/** Los subtítulos (texto en pantalla) en formato SRT, para accesibilidad y para subir a Meta. */
export function srt(p: Project): string {
  const ts = (s: number) => {
    const ms = Math.round(s * 1000);
    const h = Math.floor(ms / 3_600_000);
    const m = Math.floor((ms % 3_600_000) / 60_000);
    const sec = Math.floor((ms % 60_000) / 1000);
    return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')},${String(ms % 1000).padStart(3, '0')}`;
  };
  const sc = Object.fromEntries(p.timeline.map((s) => [s.id, s]));
  const items: [number, number, string][] = [];
  items.push([sc.hook.start, sc.hook.end, `${p.text.eyebrow}\n${p.text.headline}`]);
  const mid = sc.demo ?? sc.tour;
  if (mid && p.text.callout) items.push([mid.start, mid.end, p.text.callout]);
  items.push([sc.claims.start, sc.claims.end, [...p.text.bullets, p.text.price].filter(Boolean).join('\n')]);
  items.push([sc.cta.start, sc.cta.end, `${p.text.cta} · ${p.text.url}`]);
  return items.map(([a, b, t], i) => `${i + 1}\n${ts(a)} --> ${ts(b)}\n${t}\n`).join('\n');
}
