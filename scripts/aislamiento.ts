/**
 * ¿Qué puede leer y escribir un visitante cualquiera?
 *
 *   npx tsx scripts/aislamiento.ts            # contra lo que diga .env.local
 *   SUPABASE_URL=… SUPABASE_ANON_KEY=… npx tsx scripts/aislamiento.ts
 *
 * Esto no prueba el código: le pega a la base de verdad con la clave anónima,
 * que es la que viaja en el navegador de cualquiera que entre a una tienda. Es
 * la única forma de comprobar que las policies, los GRANT por columna y los
 * revokes de la migración 017 siguen haciendo lo que creemos, porque cualquiera
 * de los tres puede caerse solo: una policy nueva de más, un GRANT que vuelve
 * con una migración, una tabla agregada sin RLS.
 *
 * En un producto con varios negocios en la misma base, que esto falle es lo peor
 * que puede pasar: el catálogo, los costos o los clientes de un negocio quedando
 * a la vista de otro. Conviene correrlo después de cada migración.
 *
 * Que una tabla privada conteste "permission denied" en vez de cero filas es
 * mejor, no peor: significa que el rol anónimo no tiene ni el permiso de tabla,
 * así que ni siquiera llega a evaluarse la policy. Las dos respuestas pasan.
 */

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

function fromEnvFile(key: string): string | undefined {
  try {
    const file = readFileSync(resolve(process.cwd(), '.env.local'), 'utf8');
    return file.match(new RegExp(`^${key}=(.*)$`, 'm'))?.[1]?.trim().replace(/^["']|["']$/g, '');
  } catch {
    return undefined;
  }
}

const URL_BASE = (
  process.env.SUPABASE_URL ||
  process.env.NEXT_PUBLIC_SUPABASE_URL ||
  fromEnvFile('NEXT_PUBLIC_SUPABASE_URL') ||
  ''
).replace(/\/$/, '');

const ANON =
  process.env.SUPABASE_ANON_KEY ||
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
  fromEnvFile('NEXT_PUBLIC_SUPABASE_ANON_KEY') ||
  '';

if (!URL_BASE || !ANON) {
  console.error(
    'Faltan NEXT_PUBLIC_SUPABASE_URL y NEXT_PUBLIC_SUPABASE_ANON_KEY (en el ambiente o en .env.local).'
  );
  process.exit(1);
}

const rest = `${URL_BASE}/rest/v1`;
const headers = { apikey: ANON, Authorization: `Bearer ${ANON}` };

let fallas = 0;
const paso = (nombre: string, detalle = '') =>
  console.log(`OK      ${nombre}${detalle ? `  (${detalle})` : ''}`);
const falla = (nombre: string, detalle: string) => {
  fallas += 1;
  console.log(`REVISAR ${nombre}  → ${detalle}`);
};

/** Una lectura anónima: las filas que devolvió, o el código de error. */
async function leer(
  path: string,
  extra: Record<string, string> = {}
): Promise<{ filas: unknown[] } | { error: string }> {
  const response = await fetch(`${rest}/${path}`, { headers: { ...headers, ...extra } });
  const text = await response.text();
  if (!response.ok) {
    let code = String(response.status);
    try {
      code = (JSON.parse(text) as { code?: string }).code || code;
    } catch {
      /* el cuerpo no era JSON */
    }
    return { error: code };
  }
  try {
    const body = JSON.parse(text);
    return { filas: Array.isArray(body) ? body : [body] };
  } catch {
    return { error: 'respuesta ilegible' };
  }
}

/** Las tablas con datos de un negocio: o no se puede, o no hay nada. */
const PRIVADAS = [
  'ingredients',
  'recipe_items',
  'stock_movements',
  'expenses',
  'customers',
  'orders',
  'order_items',
  'business_members',
  'demo_sandboxes',
  'push_subscriptions',
];

/** El esquema comercial de SOVARE no tiene nada que hacer en la API pública. */
const COMERCIALES = ['clients', 'payments', 'signups', 'vendors', 'vendor_sales', 'admins'];

async function main() {
  console.log(`Sondeando ${URL_BASE} como visitante anónimo\n`);

  // ---------- Lo que la tienda pública necesita ----------
  const negocios = await leer('businesses?select=id,slug,storefront_enabled&limit=50');
  if ('error' in negocios) {
    falla('la tienda puede leer los negocios abiertos', negocios.error);
  } else if (negocios.filas.length === 0) {
    falla('la tienda puede leer los negocios abiertos', 'no ve ninguno; la tienda no andaría');
  } else {
    paso('la tienda lee los negocios abiertos', `${negocios.filas.length} visible(s)`);
  }

  const abiertos = new Set(
    'error' in negocios ? [] : negocios.filas.map((row) => (row as { id: string }).id)
  );

  // Lo importante no es cuántos productos se ven, sino de quién: sólo pueden ser
  // de los negocios que la consulta de arriba ya mostró. Un producto de otro
  // negocio acá significa que su catálogo y sus precios quedaron a la vista.
  const productos = await leer('products?select=id,business_id&is_active=eq.true&limit=500');
  if ('error' in productos) {
    falla('la tienda puede leer el catálogo', productos.error);
  } else {
    const ajenos = new Set(
      productos.filas
        .map((row) => (row as { business_id: string }).business_id)
        .filter((id) => !abiertos.has(id))
    );
    if (ajenos.size > 0) {
      falla(
        'el catálogo sólo muestra tiendas abiertas',
        `${ajenos.size} negocio(s) que no están entre los visibles: ${[...ajenos].join(', ')}`
      );
    } else {
      paso(
        'el catálogo sólo muestra tiendas abiertas',
        `${productos.filas.length} producto(s) de ${abiertos.size} negocio(s)`
      );
    }
  }

  // ---------- Columnas que no se piden ni del negocio ----------
  const seq = await leer('businesses?select=order_seq&limit=1');
  if ('error' in seq) paso('businesses.order_seq rechazada', seq.error);
  else falla('businesses.order_seq rechazada', 'la devolvió');

  // ---------- Lo privado ----------
  for (const tabla of PRIVADAS) {
    const r = await leer(`${tabla}?select=*&limit=5`);
    if ('error' in r) paso(`${tabla} no se lee`, r.error);
    else if (r.filas.length === 0) paso(`${tabla} no devuelve nada`, 'RLS');
    else falla(`${tabla} no se lee`, `devolvió ${r.filas.length} fila(s)`);
  }

  // ---------- El esquema de SOVARE ----------
  for (const tabla of COMERCIALES) {
    const r = await leer(`${tabla}?select=*&limit=1`, { 'Accept-Profile': 'sovare' });
    if ('error' in r) paso(`sovare.${tabla} inaccesible`, r.error);
    else falla(`sovare.${tabla} inaccesible`, `devolvió ${r.filas.length} fila(s)`);
  }

  // ---------- Escritura ----------
  // La migración 017 le saca a `anon` el DML sobre todo `public`. Un pedido de la
  // tienda no entra por acá: va por `create_storefront_order`, que valida.
  for (const tabla of ['products', 'orders', 'customers', 'businesses']) {
    const response = await fetch(`${rest}/${tabla}`, {
      method: 'POST',
      headers: { ...headers, 'Content-Type': 'application/json' },
      body: '{}',
    });
    if (response.ok) falla(`no se puede insertar en ${tabla}`, `respondió ${response.status}`);
    else paso(`no se puede insertar en ${tabla}`, String(response.status));
  }

  console.log(fallas === 0 ? '\nTODO OK' : `\n${fallas} COSAS PARA REVISAR`);
  process.exit(fallas === 0 ? 0 : 1);
}

main().catch((error) => {
  console.error('La sonda falló:', error);
  process.exit(1);
});
