import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { closeDb, openTestDb, db } from '../src/db/index.ts';
import { decideApproval, engageKillSwitch, guard, listApprovals, releaseKillSwitch, setMode, updatePolicy } from '../src/core/policy.ts';
import { getPolicy, putSetting } from '../src/core/settings.ts';
import { SmfError } from '../src/core/util.ts';

before(async () => {
  await openTestDb();
});
after(closeDb);

test('nivel 1 se permite siempre', async () => {
  const d = await guard({ action: 'creative.render', actor: 'agent' });
  assert.equal(d.allowed, true);
  assert.equal(d.tier, 1);
});

test('acción desconocida se niega', async () => {
  const d = await guard({ action: 'meta.borrar_todo', actor: 'agent' });
  assert.equal(d.allowed, false);
});

test('en modo de prueba el nivel 2 se simula y dice qué faltaría', async () => {
  const d = await guard({ action: 'meta.launch', actor: 'agent', product: 'gastroos' });
  assert.equal(d.allowed, true);
  assert.equal(d.dryRun, true);
  assert.match(d.reason, /activar el canal meta_ads/);
});

test('el agente no puede pasar a modo real: queda pedida la autorización', async () => {
  await assert.rejects(() => setMode('agent', 'live'), (e: SmfError) => e.code === 'needs_approval');
  const pend = await listApprovals('pending');
  assert.ok(pend.some((a) => a.action === 'mode.set_live'));
});

test('el agente no puede ampliar la política', async () => {
  await assert.rejects(() => updatePolicy('agent', { budget: { max_daily_total_ars: 50000 } }), (e: SmfError) => e.code === 'needs_approval');
  assert.equal((await getPolicy()).budget.max_daily_total_ars, 0);
});

test('el agente sí puede restringir la política', async () => {
  const p = await updatePolicy('agent', { autopilot: { pause_underperformers: false } });
  assert.equal(p.autopilot.pause_underperformers, false);
});

test('modo real: lanzar sin canal ni primer gasto autorizado se frena', async () => {
  await setMode('owner', 'live');
  const d = await guard({ action: 'meta.launch', actor: 'agent', product: 'gastroos', requestIfMissing: { summary: 'lanzar' } });
  assert.equal(d.allowed, false);
  assert.equal(d.tier, 3);
  assert.ok(d.approvalId);
});

test('aprobar activar el canal y el primer gasto habilita el lanzamiento dentro de topes', async () => {
  await updatePolicy('owner', {
    channels: { meta_ads: true },
    budget: { max_daily_total_ars: 20000, max_daily_per_campaign_ars: 10000 },
    autopilot: { launch_approved_campaigns: true },
  });
  // El primer gasto real se autoriza por la vía de la aprobación, como haría el dueño desde el link.
  const pedido = await guard({ action: 'meta.launch', actor: 'agent', product: 'gastroos', requestIfMissing: { summary: 'primer gasto' } });
  assert.equal(pedido.allowed, false);
  const pend = (await listApprovals('pending')).find((a) => a.action === 'launch.first_live');
  assert.ok(pend);
  await decideApproval(pend!.id, true, { kind: 'owner' });
  assert.deepEqual((await getPolicy()).products_live, ['gastroos']);

  const ok = await guard({ action: 'meta.launch', actor: 'agent', product: 'gastroos', newDailyBudget: 8000 });
  assert.equal(ok.allowed, true, ok.reason);
  assert.equal(ok.dryRun, false);

  const caro = await guard({ action: 'meta.launch', actor: 'agent', product: 'gastroos', newDailyBudget: 15000 });
  assert.equal(caro.allowed, false);
  assert.match(caro.reason, /tope por campaña/);
});

test('el tope total cuenta lo que ya está activo', async () => {
  const d = await db();
  await d.query(`INSERT INTO smf.campaigns (id, product_id, name, objective, status, daily_budget_ars, destination_url, dry_run) VALUES ('c1','gastroos','x','OUTCOME_LEADS','active',9000,'https://gastroos.shop/conv',false)`);
  const r = await guard({ action: 'meta.budget.change', actor: 'owner', product: 'gastroos', target: 'c2', newDailyBudget: 9000 });
  assert.equal(r.allowed, true);
  const r2 = await guard({ action: 'meta.budget.change', actor: 'owner', product: 'gastroos', target: 'c2', newDailyBudget: 10000 });
  assert.equal(r2.allowed, true);
  const r3 = await guard({ action: 'meta.budget.change', actor: 'owner', product: 'gastroos', target: 'c2', newDailyBudget: 12000 });
  assert.equal(r3.allowed, false);
});

test('ajuste automático mayor al % permitido necesita autorización', async () => {
  await updatePolicy('owner', { autopilot: { budget_rebalance: true } });
  const ok = await guard({ action: 'meta.budget.change', actor: 'system', product: 'gastroos', target: 'c1', newDailyBudget: 9500, oldDailyBudget: 9000 });
  assert.equal(ok.allowed, true, ok.reason);
  const no = await guard({ action: 'meta.budget.change', actor: 'system', product: 'gastroos', target: 'c1', newDailyBudget: 10000, oldDailyBudget: 7000 });
  assert.equal(no.allowed, false);
});

test('pausa general: frena lanzamientos pero deja pausar', async () => {
  await engageKillSwitch('agent', 'prueba');
  const l = await guard({ action: 'meta.launch', actor: 'owner', product: 'gastroos' });
  assert.equal(l.allowed, false);
  assert.match(l.reason, /Pausa general/);
  const p = await guard({ action: 'meta.pause', actor: 'agent' });
  assert.equal(p.allowed, true);
  await assert.rejects(() => releaseKillSwitch('agent'));
  await releaseKillSwitch('owner');
  const l2 = await guard({ action: 'meta.launch', actor: 'owner', product: 'gastroos', newDailyBudget: 1000 });
  assert.equal(l2.allowed, true, l2.reason);
});

test('un link de aprobación con token equivocado no sirve', async () => {
  await putSetting('mode', 'live', 'owner');
  const d = await guard({ action: 'campaign.delete', actor: 'agent', target: 'c1', requestIfMissing: { summary: 'borrar' } });
  assert.ok(d.approvalId);
  await assert.rejects(() => decideApproval(d.approvalId!, true, { kind: 'link', token: 'falso' }), /no es válido/);
});

test('cambiar precios u ofertas nunca se hace desde la Factory', async () => {
  const d = await guard({ action: 'offer.change', actor: 'owner' });
  assert.equal(d.allowed, false);
});
