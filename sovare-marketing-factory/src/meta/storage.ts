/**
 * Media con URL pública.
 *
 * La API de publicación de Instagram no acepta archivos: pide una URL pública
 * desde donde Meta baja el video o la imagen. Se usa Supabase Storage (un
 * bucket público `smf-media`), que ya es parte del stack de los productos. Sólo
 * se suben creativos renderizados: nunca datos de nadie.
 *
 * En modo de prueba no se sube nada: devuelve una URL `file://` local.
 */

import { readFileSync } from 'node:fs';
import { basename, extname } from 'node:path';
import { pathToFileURL } from 'node:url';
import { config } from '../config.ts';
import { SmfError } from '../core/util.ts';

const TIPOS: Record<string, string> = { '.mp4': 'video/mp4', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.png': 'image/png', '.srt': 'application/x-subrip' };

export async function publicUrlFor(file: string, key: string, dryRun: boolean): Promise<string> {
  if (dryRun) return pathToFileURL(file).href;
  const { supabaseUrl, supabaseServiceKey, bucket } = config.storage;
  if (!supabaseUrl || !supabaseServiceKey) throw new SmfError('Falta SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY para publicar media (Instagram exige una URL pública).', 'storage_not_configured');
  const headers = { Authorization: `Bearer ${supabaseServiceKey}`, apikey: supabaseServiceKey };
  const path = `${key}/${basename(file)}`;
  const subir = () =>
    fetch(`${supabaseUrl}/storage/v1/object/${bucket}/${path}`, {
      method: 'POST',
      headers: { ...headers, 'Content-Type': TIPOS[extname(file).toLowerCase()] ?? 'application/octet-stream', 'x-upsert': 'true', 'Cache-Control': 'max-age=31536000' },
      body: readFileSync(file),
      signal: AbortSignal.timeout(300_000),
    });
  let r = await subir();
  if (r.status === 404 || r.status === 400) {
    // El bucket no existe todavía: se crea público una vez.
    const b = await fetch(`${supabaseUrl}/storage/v1/bucket`, { method: 'POST', headers: { ...headers, 'Content-Type': 'application/json' }, body: JSON.stringify({ id: bucket, name: bucket, public: true }) });
    if (!b.ok && b.status !== 409) throw new SmfError(`No se pudo crear el bucket ${bucket}: ${b.status}`, 'storage_error');
    r = await subir();
  }
  if (!r.ok) throw new SmfError(`Supabase Storage respondió ${r.status}: ${(await r.text()).slice(0, 200)}`, 'storage_error');
  return `${supabaseUrl}/storage/v1/object/public/${bucket}/${path}`;
}
