import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { closeDb, openTestDb } from '../src/db/index.ts';
import { analyzeProduct, extractPlans, loadCatalog, mdTable, syncCatalog, tsConst } from '../src/catalog/index.ts';
import { discover } from '../src/catalog/discover.ts';

before(async () => {
  await openTestDb();
});
after(closeDb);

test('tsConst lee literales sin ejecutar el archivo', () => {
  const src = `const X = 1; export const PLANES = [{ nombre: 'A', mensual: 29_000, desde: true, env: process.env.FOO }] as const;`;
  assert.deepEqual(tsConst(src, 'PLANES'), [{ nombre: 'A', mensual: 29000, desde: true, env: null }]);
});

test('mdTable lee la tabla de una sección', () => {
  const md = '# T\n\n## Qué incluye\n\n| Módulo | Qué resuelve |\n|---|---|\n| **Dashboard** | Resumen. |\n| **Pedidos** | Alta. |\n\n## Otra\n| a | b |';
  assert.deepEqual(mdTable(md, 'Qué incluye'), [['Dashboard', 'Resumen.'], ['Pedidos', 'Alta.']]);
});

test('el catálogo carga y valida', () => {
  const ps = loadCatalog();
  assert.deepEqual(ps.map((p) => p.id).sort(), ['alojaos', 'gastroos']);
  assert.ok(ps.every((p) => p.marketable));
});

test('GastroOS: precios reales desde marketing.ts', () => {
  const p = loadCatalog().find((x) => x.id === 'gastroos')!;
  const plans = extractPlans(p);
  assert.deepEqual(plans.map((x) => [x.id, x.monthly]), [['taller', 15000], ['negocio', 32000], ['cocina', 56000], ['medida', 89000]]);
});

test('AlojaOS: precios reales desde precios-alojaos.ts', () => {
  const p = loadCatalog().find((x) => x.id === 'alojaos')!;
  const plans = extractPlans(p);
  assert.deepEqual(plans.map((x) => [x.name, x.monthly, x.setup]), [['Familiar', 29000, 65000], ['Complejo', 45000, 90000], ['Complejo grande', 65000, 120000], ['A medida', 90000, 150000]]);
});

test('todas las evidencias del catálogo existen en los repos', () => {
  for (const p of loadCatalog()) {
    const f = analyzeProduct(p);
    const malas = f.evidence.filter((e) => !e.ok);
    assert.deepEqual(malas, [], `${p.id}: ${JSON.stringify(malas)}`);
    assert.ok(f.assets.every((a) => a.ok), `${p.id}: faltan recursos`);
    assert.ok(f.features.length >= 5, `${p.id}: funcionalidades ${f.features.length}`);
  }
});

test('sync guarda fotos y detecta cambios', async () => {
  const r1 = await syncCatalog();
  assert.ok(r1.every((r) => r.changed));
  const r2 = await syncCatalog();
  assert.ok(r2.every((r) => !r.changed));
});

test('discover clasifica los repos conocidos', async () => {
  const r = await discover({ github: undefined, alert: false });
  const gastro = r.repos.find((x) => /gastroos/i.test(x.repo));
  assert.ok(gastro?.classified);
  assert.ok(gastro?.signals.includes('tiene /conv'));
});
