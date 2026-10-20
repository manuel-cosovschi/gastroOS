/**
 * Configuración, leída una sola vez del entorno.
 *
 * Ningún secreto tiene valor por defecto. Lo que falta no rompe el arranque:
 * apaga la integración que lo necesita y `integrations()` lo dice, para que el
 * panel y la Skill puedan mostrar exactamente qué falta en vez de fallar en
 * silencio a mitad de un job.
 */

import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

/** Carga un `.env` simple si existe. No pisa variables ya definidas. */
function loadDotEnv(file = resolve(process.cwd(), '.env')): void {
  if (!existsSync(file)) return;
  for (const line of readFileSync(file, 'utf8').split('\n')) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (!m || process.env[m[1]] !== undefined) continue;
    process.env[m[1]] = m[2].replace(/^["']|["']$/g, '');
  }
}
loadDotEnv();

const env = (k: string): string => (process.env[k] ?? '').trim();
const num = (k: string, d: number): number => {
  const v = Number(env(k));
  return Number.isFinite(v) && env(k) !== '' ? v : d;
};

export const ROOT = resolve(import.meta.dirname, '..');

export const config = {
  /** Postgres de producción. Sin esto se usa PGlite en `DATA_DIR/pg`. */
  databaseUrl: env('DATABASE_URL'),
  dataDir: resolve(env('SMF_DATA_DIR') || resolve(ROOT, 'data')),
  outDir: resolve(env('SMF_OUT_DIR') || resolve(ROOT, 'out')),
  catalogDir: resolve(env('SMF_CATALOG_DIR') || resolve(ROOT, 'catalog')),
  /** Carpeta donde están clonados los repos de los productos, para el análisis. */
  reposDir: resolve(env('SMF_REPOS_DIR') || resolve(ROOT, '..')),

  /** URL pública del servicio (para OAuth, links firmados y media pública). */
  publicUrl: env('SMF_PUBLIC_URL').replace(/\/$/, ''),
  port: num('PORT', 8787),

  /** Token para la API/CLI de máquinas (n8n, GitHub Actions). Actor: `agent`. */
  apiToken: env('SMF_API_TOKEN'),
  /** Llave del dueño: decide autorizaciones de nivel 3 y entra al panel. */
  ownerKey: env('SMF_OWNER_KEY'),
  /** Secreto para firmar links de aprobación y cookies. */
  signingSecret: env('SMF_SIGNING_SECRET'),
  /** Secreto HMAC con el que los productos firman los eventos que mandan. */
  ingestSecret: env('SMF_INGEST_SECRET'),

  meta: {
    apiVersion: env('META_API_VERSION') || 'v26.0',
    accessToken: env('META_ACCESS_TOKEN'),
    adAccountId: env('META_AD_ACCOUNT_ID').replace(/^act_/, ''),
    pageId: env('META_PAGE_ID'),
    instagramUserId: env('META_IG_USER_ID'),
    /** Token de página para publicar orgánico en Facebook (si difiere). */
    pageAccessToken: env('META_PAGE_ACCESS_TOKEN'),
    appSecret: env('META_APP_SECRET'),
  },

  /** Píxeles por producto: META_PIXEL_ID_GASTROOS, META_CAPI_TOKEN_GASTROOS… */
  pixelFor: (productId: string) => ({
    pixelId: env(`META_PIXEL_ID_${productId.toUpperCase()}`) || env('META_PIXEL_ID'),
    capiToken: env(`META_CAPI_TOKEN_${productId.toUpperCase()}`) || env('META_CAPI_TOKEN'),
  }),

  notify: {
    resendKey: env('RESEND_API_KEY'),
    from: env('SMF_MAIL_FROM'),
    to: env('SMF_NOTIFY_EMAIL'),
    telegramToken: env('TELEGRAM_BOT_TOKEN'),
    telegramChat: env('TELEGRAM_CHAT_ID'),
    webhookUrl: env('SMF_NOTIFY_WEBHOOK'),
  },

  storage: {
    /** Supabase Storage para publicar media con URL pública (Instagram la exige). */
    supabaseUrl: env('SUPABASE_URL').replace(/\/$/, ''),
    supabaseServiceKey: env('SUPABASE_SERVICE_ROLE_KEY'),
    bucket: env('SMF_MEDIA_BUCKET') || 'smf-media',
  },

  /** Lectura de leads/compras desde las bases de los productos (sólo lectura). */
  sources: {
    alojaosDb: env('ALOJAOS_DATABASE_URL'),
    gastroosDb: env('GASTROOS_DATABASE_URL'),
  },

  chromium: env('CHROMIUM_PATH') || findChromium(),
  ffmpeg: env('FFMPEG') || 'ffmpeg',
  ffprobe: env('FFPROBE') || 'ffprobe',

  workerId: env('SMF_WORKER_ID') || `w-${process.pid}`,
  /** Qué tipos de job puede tomar este ejecutor: `any` o `light`. */
  workerCaps: (env('SMF_WORKER_CAPS') || 'any,light,render').split(',').map((s) => s.trim()),
};

function findChromium(): string {
  const candidatos = [
    '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
    '/usr/bin/chromium',
    '/usr/bin/chromium-browser',
    '/usr/bin/google-chrome',
  ];
  return candidatos.find((c) => existsSync(c)) ?? '';
}

export type IntegrationState = { name: string; ok: boolean; detail: string };

/** Qué integraciones tienen credenciales cargadas. No dice si funcionan: eso lo prueba `doctor`. */
export function integrations(): IntegrationState[] {
  const m = config.meta;
  const n = config.notify;
  return [
    { name: 'database', ok: true, detail: config.databaseUrl ? 'Postgres (DATABASE_URL)' : `PGlite local en ${config.dataDir}/pg` },
    { name: 'meta_ads', ok: !!(m.accessToken && m.adAccountId), detail: m.accessToken ? (m.adAccountId ? `act_${m.adAccountId}` : 'falta META_AD_ACCOUNT_ID') : 'falta META_ACCESS_TOKEN' },
    { name: 'meta_page', ok: !!m.pageId, detail: m.pageId ? `página ${m.pageId}` : 'falta META_PAGE_ID' },
    { name: 'instagram', ok: !!m.instagramUserId, detail: m.instagramUserId ? `ig ${m.instagramUserId}` : 'falta META_IG_USER_ID' },
    { name: 'email', ok: !!(n.resendKey && n.from && n.to), detail: n.resendKey ? (n.to ? `a ${n.to}` : 'falta SMF_NOTIFY_EMAIL') : 'falta RESEND_API_KEY' },
    { name: 'telegram', ok: !!(n.telegramToken && n.telegramChat), detail: n.telegramToken ? 'configurado' : 'falta TELEGRAM_BOT_TOKEN' },
    { name: 'webhook', ok: !!n.webhookUrl, detail: n.webhookUrl ? 'configurado' : 'sin SMF_NOTIFY_WEBHOOK' },
    { name: 'media_storage', ok: !!(config.storage.supabaseUrl && config.storage.supabaseServiceKey), detail: config.storage.supabaseUrl ? `bucket ${config.storage.bucket}` : 'falta SUPABASE_URL/SUPABASE_SERVICE_ROLE_KEY' },
    { name: 'renderer', ok: !!config.chromium, detail: config.chromium || 'no se encontró Chromium (CHROMIUM_PATH)' },
    { name: 'owner_key', ok: config.ownerKey.length >= 24, detail: config.ownerKey ? (config.ownerKey.length >= 24 ? 'configurada' : 'muy corta (mínimo 24)') : 'falta SMF_OWNER_KEY' },
    { name: 'api_token', ok: config.apiToken.length >= 24, detail: config.apiToken ? 'configurado' : 'falta SMF_API_TOKEN' },
    { name: 'public_url', ok: !!config.publicUrl, detail: config.publicUrl || 'falta SMF_PUBLIC_URL (OAuth y links firmados)' },
  ];
}
