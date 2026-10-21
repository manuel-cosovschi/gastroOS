import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { closeDb, openTestDb } from '../src/db/index.ts';
import { productWithFacts, syncCatalog } from '../src/catalog/index.ts';
import { checkCopy, numbersIn } from '../src/creative/copy.ts';
import { createCustomConcept, generateConcepts, getConcept } from '../src/creative/concepts.ts';
import { buildProject, srt } from '../src/creative/project.ts';

before(async () => {
  await openTestDb();
  await syncCatalog();
});
after(closeDb);

test('numbersIn normaliza miles y decimales', () => {
  assert.deepEqual(numbersIn('Desde $15.000 por mes, 2,40 kg y 29_000'), ['15000', '2.4', '29000']);
  assert.deepEqual(numbersIn('de 3 a 15 unidades'), ['3', '15']);
});

test('el validador frena números, superlativos, prueba social y testimonios inventados', async () => {
  const { product, facts } = await productWithFacts('gastroos');
  const malo = checkCopy({ hook: 'Para pastelerías', headline: 'El mejor sistema', primary_text: 'Ahorrá 10 horas por semana. Miles de clientes ya lo usan. ⭐⭐⭐⭐⭐ «Me cambió la vida por completo» — Laura', cta: 'Probá la demo' }, product, facts);
  assert.equal(malo.ok, false);
  const txt = malo.errors.join(' | ');
  assert.match(txt, /número 10/);
  assert.match(txt, /superlativo/);
  assert.match(txt, /prueba social/);
  assert.match(txt, /calificación/);
  assert.match(txt, /testimonio/);
});

test('el validador acepta los precios reales y pide la fecha', async () => {
  const { product, facts } = await productWithFacts('gastroos');
  const ok = checkCopy({ hook: 'Para pastelerías', headline: 'Tus pedidos, en una pantalla', primary_text: 'Desde $15.000 por mes.', cta: 'Ver planes' }, product, facts);
  assert.equal(ok.ok, true, ok.errors.join(';'));
  assert.ok(ok.warnings.some((w) => /fecha/.test(w)));
  const inventado = checkCopy({ hook: 'x', headline: 'y', primary_text: 'Desde $9.900 por mes.', cta: 'Ver planes' }, product, facts);
  assert.equal(inventado.ok, false);
});

test('los conceptos generados sólo usan hechos verificados y pasan el validador', async () => {
  for (const p of ['gastroos', 'alojaos']) {
    const cs = await generateConcepts(p, { count: 6 });
    assert.equal(cs.length, 6);
    const { product, facts } = await productWithFacts(p);
    for (const c of cs) {
      assert.equal(checkCopy(c, product, facts).ok, true, c.primary_text);
      for (const id of c.claims.filter((x) => !x.startsWith('angle:') && !x.startsWith('plan:'))) assert.ok(facts.verifiedClaims.includes(id), id);
      assert.ok(facts.verifiedAngles.includes(c.angle));
    }
    assert.ok(new Set(cs.map((c) => c.variant)).size === 6, 'no repite combinaciones');
  }
});

test('copy propio: se rechaza con errores claros y se acepta corregido', async () => {
  const mal = await createCustomConcept({ product: 'alojaos', angle: 'comision', hook: 'Para complejos', headline: 'Ahorrá 30% en comisiones', primary_text: 'Ahorrá un 30% garantizado.', cta: 'Consultá', createdBy: 'agent' });
  assert.equal(mal.check.ok, false);
  assert.equal(mal.concept, undefined);
  const bien = await createCustomConcept({ product: 'alojaos', angle: 'comision', hook: 'Para complejos que hoy le pagan a un portal', headline: 'Tus reservas, sin comisión', primary_text: 'Una página propia donde el huésped reserva y la seña va directo a tu cuenta.', cta: 'Consultá', bullets: ['sin-comision', 'La seña va a tu cuenta'], createdBy: 'agent' });
  assert.equal(bien.check.ok, true, bien.check.errors.join(';'));
  assert.ok(bien.concept?.id);
});

test('el proyecto de la plantilla demo abre con la grabación real y tiene subtítulos', async () => {
  const [c] = await generateConcepts('gastroos', { count: 1, angles: ['base'], templates: ['demo'] });
  const { product, facts } = await productWithFacts('gastroos');
  const p = buildProject({ creativeId: 'crv_x', product, facts, concept: await getConcept(c.id), format: 'reels_9x16' });
  assert.equal(p.media[0].kind, 'recording');
  assert.equal(p.width, 1080);
  assert.equal(p.height, 1920);
  assert.equal(p.timeline.at(-1)!.end, 15);
  assert.match(srt(p), /gastroos\.shop\/conv/);
});
