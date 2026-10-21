/**
 * Prueba de punta a punta del Creative Engine: concepto → render → validación.
 * Renderiza de verdad (Chromium + FFmpeg), así que tarda. `npm run test:render`.
 */

import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { closeDb, openTestDb } from '../src/db/index.ts';
import { syncCatalog } from '../src/catalog/index.ts';
import { generateConcepts } from '../src/creative/concepts.ts';
import { renderCreative } from '../src/creative/index.ts';

before(async () => {
  await openTestDb();
  await syncCatalog();
});
after(closeDb);

const formatos = (process.env.SMF_TEST_FORMATS ?? 'reels_9x16').split(',') as ('reels_9x16' | 'feed_4x5' | 'square_1x1' | 'landscape_16x9')[];

for (const producto of (process.env.SMF_TEST_PRODUCTS ?? 'gastroos').split(',')) {
  test(`${producto}: render y validación (${formatos.join(', ')})`, { timeout: 900_000 }, async () => {
    const [c] = await generateConcepts(producto, { count: 1, templates: [(process.env.SMF_TEST_TEMPLATE as 'demo') ?? 'demo'] });
    assert.ok(c, 'no se generó el concepto');
    for (const f of formatos) {
      const cr = await renderCreative(c.id, f, { duration: Number(process.env.SMF_TEST_DURATION ?? 15) });
      assert.equal(cr.status, 'ready', JSON.stringify(cr.validation));
      assert.ok(cr.path && existsSync(cr.path));
      assert.ok(cr.poster_path && existsSync(cr.poster_path));
      console.log(`  ${producto} ${f}: ${cr.path} (${Math.round(Number(cr.bytes) / 1024)} KB)`);
    }
  });
}
