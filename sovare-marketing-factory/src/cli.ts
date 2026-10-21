/**
 * smf — la línea de comandos de la Factory.
 *
 *   smf serve                       servicio persistente (API, MCP, panel, scheduler)
 *   smf tick [--caps light,render]  una pasada del scheduler y termina
 *   smf doctor [--meta]             qué está configurado y qué falta (con --meta, lee la cuenta real)
 *   smf run [productos…] [--render] el ciclo completo de marketing, acá mismo
 *   smf render <concepto> <formato…>
 *   smf rerender <project.json>
 *   smf approve|reject <apr_id>     decide una autorización (dueño: pide SMF_OWNER_KEY)
 *   smf release                     levanta la pausa general (dueño)
 *   smf op <operación> ['{json}']   cualquier operación de la API
 *   smf ops                         lista las operaciones
 *
 * La CLI actúa como `agent`, salvo los comandos de dueño, que exigen que
 * SMF_OWNER_KEY esté en el entorno y que se escriba de nuevo al confirmar.
 */

import { createInterface } from 'node:readline/promises';
import { config, integrations } from './config.ts';
import { closeDb } from './db/index.ts';
import { safeEqual } from './core/util.ts';
import { decideApproval, releaseKillSwitch } from './core/policy.ts';
import { OPS, runOp } from './ops.ts';
import { health, startLoop, tick } from './runtime/worker.ts';
import { runMarketing } from './runtime/pipeline.ts';
import { renderCreative, rerenderProject } from './creative/index.ts';
import { verifyAccount } from './meta/ads.ts';
import type { FormatId } from './creative/formats.ts';

const args = process.argv.slice(2);
const cmd = args[0];
const flag = (n: string) => args.includes(`--${n}`);
const val = (n: string) => {
  const i = args.indexOf(`--${n}`);
  return i >= 0 ? args[i + 1] : undefined;
};
const print = (x: unknown) => console.log(typeof x === 'string' ? x : JSON.stringify(x, null, 2));

async function owner(): Promise<void> {
  if (!config.ownerKey) throw new Error('Este comando es del dueño: falta SMF_OWNER_KEY en el entorno.');
  const rl = createInterface({ input: process.stdin, output: process.stdout });
  const k = await rl.question('Llave del dueño: ');
  rl.close();
  if (!safeEqual(k.trim(), config.ownerKey)) throw new Error('Llave incorrecta.');
}

async function main() {
  switch (cmd) {
    case 'serve': {
      const { createApp } = await import('./server/http.ts');
      const app = createApp();
      app.listen(config.port, () => console.log(`Sovare Marketing Factory escuchando en :${config.port}${config.publicUrl ? ` (${config.publicUrl})` : ''}`));
      if (!flag('no-scheduler')) startLoop(Number(val('interval') ?? 30) * 1000);
      return new Promise(() => undefined);
    }
    case 'tick':
      print(await tick({ caps: (val('caps') ?? config.workerCaps.join(',')).split(','), maxJobs: Number(val('max') ?? 20), budgetMs: Number(val('budget') ?? 600) * 1000 }));
      break;
    case 'doctor': {
      print({ integraciones: integrations(), salud: await health() });
      if (flag('meta')) print({ meta: await verifyAccount() });
      break;
    }
    case 'run':
      {
      const pedidos = args.slice(1).filter((a) => !a.startsWith('--'));
      print(await runMarketing({ products: pedidos.length ? pedidos : undefined, actor: 'agent', renderInline: flag('render'), launch: !flag('no-launch') }));
      break;
    }
    case 'render': {
      const [concept, ...formats] = args.slice(1).filter((a) => !a.startsWith('--'));
      for (const f of formats.length ? formats : ['reels_9x16']) print(await renderCreative(concept, f as FormatId, { actor: 'agent', duration: Number(val('duration') ?? 15) }));
      break;
    }
    case 'rerender':
      print(await rerenderProject(args[1], 'owner'));
      break;
    case 'approve':
    case 'reject':
      await owner();
      print(await decideApproval(args[1], cmd === 'approve', { kind: 'owner' }, val('note')));
      break;
    case 'release':
      await owner();
      print(await releaseKillSwitch('owner'));
      break;
    case 'op':
      print(await runOp(args[1], args[2] ? JSON.parse(args[2]) : {}, 'agent'));
      break;
    case 'ops':
      for (const o of OPS) console.log(`${o.name.padEnd(24)} ${o.title}`);
      break;
    default:
      console.log(
        'Uso: smf <serve|tick|doctor|run|render|rerender|approve|reject|release|op|ops>\nVer src/cli.ts o docs/INSTALACION.md.'
      );
      process.exitCode = cmd ? 1 : 0;
  }
}

main()
  .catch((e) => {
    console.error(`✗ ${e instanceof Error ? e.message : e}`);
    process.exitCode = 1;
  })
  .finally(async () => {
    if (cmd !== 'serve') await closeDb();
  });
