#!/usr/bin/env node
/**
 * Cliente mínimo de la API de la Sovare Marketing Factory, sin dependencias.
 *
 *   SMF_URL=https://factory.tu-dominio SMF_TOKEN=… node smf.mjs status
 *   node smf.mjs concepts_generate '{"product":"alojaos","count":5}'
 *   node smf.mjs ops                     # lista las operaciones
 *   node smf.mjs wait <job_id>           # espera un trabajo y muestra el resultado
 *
 * Es el camino alternativo al conector MCP. El token es de máquina (actor
 * «agent»): opera dentro de la política, nunca aprueba.
 */

const base = (process.env.SMF_URL || '').replace(/\/$/, '');
const tok = process.env.SMF_TOKEN || '';
const [, , op, raw] = process.argv;

if (!base || !tok) {
  console.error('Faltan SMF_URL y SMF_TOKEN en el entorno. Usá el conector MCP o configurá estas variables.');
  process.exit(2);
}
if (!op) {
  console.error('Uso: node smf.mjs <operación> [json] | ops | wait <job>');
  process.exit(2);
}

async function call(method, path, body) {
  const r = await fetch(base + path, { method, headers: { Authorization: `Bearer ${tok}`, 'Content-Type': 'application/json' }, body: body ? JSON.stringify(body) : undefined });
  const text = await r.text();
  let json;
  try {
    json = JSON.parse(text);
  } catch {
    json = { raw: text };
  }
  if (!r.ok) {
    console.error(JSON.stringify(json, null, 2));
    process.exit(1);
  }
  return json;
}

if (op === 'ops') {
  for (const o of await call('GET', '/api/ops')) console.log(`${o.name.padEnd(24)} ${o.title}${o.readOnly ? '' : '  (con efectos)'}`);
} else if (op === 'wait') {
  for (let i = 0; i < 180; i++) {
    const { result } = await call('POST', '/api/ops/job_status', { job: raw });
    if (!result || ['done', 'dead', 'cancelled'].includes(result.status)) {
      console.log(JSON.stringify(result, null, 2));
      process.exit(result?.status === 'done' ? 0 : 1);
    }
    await new Promise((r) => setTimeout(r, 10_000));
  }
  console.error('Sigue corriendo después de 30 minutos.');
  process.exit(1);
} else {
  const { result } = await call('POST', `/api/ops/${op}`, raw ? JSON.parse(raw) : {});
  console.log(JSON.stringify(result, null, 2));
}
