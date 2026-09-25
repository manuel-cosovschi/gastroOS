/**
 * Emite la demo de GastroOS como un script SQL.
 *
 *   npx tsx scripts/demo-sql.ts > demo.sql
 *
 * Sirve para cargar la demo sin la `service_role` key: el SQL se pega en el
 * SQL Editor del dashboard de Supabase y listo. Usa exactamente el mismo
 * dataset que `scripts/demo.ts`, así que no hay dos fuentes de verdad.
 *
 * El script es idempotente: borra el negocio demo (todo cae en cascada) y el
 * usuario demo, y los vuelve a crear. Las fechas son relativas a CURRENT_DATE,
 * así que la demo siempre se ve "de hoy" sin importar cuándo se corra.
 *
 * La contraseña sale de DEMO_PASSWORD; se hashea con bcrypt dentro de Postgres,
 * nunca viaja ni queda guardada en texto plano.
 */

import { config } from 'dotenv';
import {
  DEMO_BUSINESS,
  DEMO_CATEGORIES,
  DEMO_CUSTOMERS,
  DEMO_EXPENSES,
  DEMO_EXPENSE_CATEGORIES,
  DEMO_INGREDIENTS,
  DEMO_ORDERS,
  DEMO_PACKAGES,
  DEMO_PRODUCTS,
} from './demo-data';

config({ path: '.env.local' });
config();

const DEMO_EMAIL = process.env.DEMO_EMAIL || 'demo@gastroos.app';
const DEMO_PASSWORD = process.env.DEMO_PASSWORD;

if (!DEMO_PASSWORD) {
  console.error('\n✗ Falta DEMO_PASSWORD en .env.local. Elegí la contraseña del usuario demo.\n');
  process.exit(1);
}

// ============================================
// Helpers de SQL
// ============================================

/** Literal de texto seguro. */
function q(value: string | null | undefined): string {
  if (value === null || value === undefined) return 'NULL';
  return `'${value.replace(/'/g, "''")}'`;
}

function n(value: number | null | undefined): string {
  return value === null || value === undefined ? 'NULL' : String(value);
}

/** Fecha relativa a hoy, resuelta por Postgres al momento de correr el script. */
function date(offset: number): string {
  return `(CURRENT_DATE + ${offset})`;
}

/** Timestamp relativo: `offset` días desde hoy, a las 10:30. */
function timestamp(offset: number): string {
  return `((CURRENT_DATE + ${offset})::timestamp + interval '10 hours 30 minutes')`;
}

const BUSINESS = `(SELECT id FROM businesses WHERE slug = ${q(DEMO_BUSINESS.slug)})`;

const out: string[] = [];
const write = (sql: string) => out.push(sql);
const section = (title: string) => write(`\n-- ${'='.repeat(60)}\n-- ${title}\n-- ${'='.repeat(60)}`);

// ============================================
// Limpieza
// ============================================

write(`-- GastroOS — datos de demostración (generado por scripts/demo-sql.ts)
-- Idempotente: borra el negocio demo y lo vuelve a crear.

BEGIN;`);

section('Limpieza');
write(`DELETE FROM businesses WHERE slug = ${q(DEMO_BUSINESS.slug)};`);
write(`DELETE FROM auth.identities WHERE user_id IN (SELECT id FROM auth.users WHERE email = ${q(DEMO_EMAIL)});`);
write(`DELETE FROM auth.users WHERE email = ${q(DEMO_EMAIL)};`);

// ============================================
// Usuario demo
// ============================================

section('Usuario demo');
write(`INSERT INTO auth.users (
  instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at
) VALUES (
  '00000000-0000-0000-0000-000000000000',
  gen_random_uuid(),
  'authenticated',
  'authenticated',
  ${q(DEMO_EMAIL)},
  extensions.crypt(${q(DEMO_PASSWORD)}, extensions.gen_salt('bf')),
  now(),
  '{"provider":"email","providers":["email"]}'::jsonb,
  '{}'::jsonb,
  now(),
  now()
);`);

// Sin la fila en auth.identities, Supabase no reconoce el login por email.
write(`INSERT INTO auth.identities (provider_id, user_id, identity_data, provider, last_sign_in_at, created_at, updated_at)
SELECT u.id::text, u.id,
       jsonb_build_object('sub', u.id::text, 'email', u.email, 'email_verified', true, 'phone_verified', false),
       'email', now(), now(), now()
FROM auth.users u WHERE u.email = ${q(DEMO_EMAIL)};`);

// ============================================
// Negocio
// ============================================

section('Negocio');
write(`INSERT INTO businesses (name, slug, industry, phone, email, instagram, address, currency, locale, timezone, storefront_enabled)
VALUES (${q(DEMO_BUSINESS.name)}, ${q(DEMO_BUSINESS.slug)}, ${q(DEMO_BUSINESS.industry)},
        ${q(DEMO_BUSINESS.phone)}, ${q(DEMO_BUSINESS.email)}, ${q(DEMO_BUSINESS.instagram)},
        ${q(DEMO_BUSINESS.address)}, ${q(DEMO_BUSINESS.currency)}, ${q(DEMO_BUSINESS.locale)},
        ${q(DEMO_BUSINESS.timezone)}, true);`);

write(`INSERT INTO business_members (business_id, user_id, role)
SELECT ${BUSINESS}, u.id, 'owner' FROM auth.users u WHERE u.email = ${q(DEMO_EMAIL)};`);

// ============================================
// Catálogo
// ============================================

section('Categorías');
write(`INSERT INTO categories (business_id, name, slug, sort_order)
VALUES
${DEMO_CATEGORIES.map((c) => `  (${BUSINESS}, ${q(c.name)}, ${q(c.slug)}, ${c.sort_order})`).join(',\n')};`);

section('Insumos');
write(`INSERT INTO ingredients (business_id, name, unit, category, stock_quantity, min_stock_quantity, cost_per_unit, supplier)
VALUES
${DEMO_INGREDIENTS.map(
  (i) =>
    `  (${BUSINESS}, ${q(i.name)}, ${q(i.unit)}, ${q(i.category)}, ${i.stock_quantity}, ${i.min_stock_quantity}, ${i.cost_per_unit}, ${q(i.supplier)})`
).join(',\n')};`);

section('Productos');
write(`INSERT INTO products (
  business_id, category_id, name, slug, short_description, price, cost_override,
  sale_unit, min_quantity, min_advance_hours, stock_quantity, min_stock_quantity,
  batch_size, sort_order, is_active
) VALUES
${DEMO_PRODUCTS.map(
  (p, index) =>
    `  (${BUSINESS}, (SELECT id FROM categories WHERE business_id = ${BUSINESS} AND name = ${q(p.category)}), ` +
    `${q(p.name)}, ${q(p.slug)}, ${q(p.short_description)}, ${p.price}, ${n(p.cost_override)}, ` +
    `${q(p.sale_unit)}, 1, ${n(p.min_advance_hours)}, ${p.stock_quantity}, ${p.min_stock_quantity}, ` +
    `${p.batch_size}, ${index}, true)`
).join(',\n')};`);

section('Recetas');
const recipeRows = DEMO_PRODUCTS.flatMap((p) =>
  p.recipe.map(
    (item) =>
      `  ((SELECT id FROM products WHERE business_id = ${BUSINESS} AND slug = ${q(p.slug)}), ` +
      `(SELECT id FROM ingredients WHERE business_id = ${BUSINESS} AND name = ${q(item.ingredient)}), ` +
      `${item.quantity_per_batch})`
  )
);
write(`INSERT INTO recipe_items (product_id, ingredient_id, quantity_per_batch)
VALUES
${recipeRows.join(',\n')};`);

section('Combos');
write(`INSERT INTO packages (business_id, name, slug, description, price, sort_order, is_active)
VALUES
${DEMO_PACKAGES.map(
  (p, index) =>
    `  (${BUSINESS}, ${q(p.name)}, ${q(p.slug)}, ${q(p.description)}, ${p.price}, ${index}, true)`
).join(',\n')};`);

write(`INSERT INTO package_items (package_id, product_id, quantity)
VALUES
${DEMO_PACKAGES.flatMap((pkg) =>
  pkg.items.map(
    (item) =>
      `  ((SELECT id FROM packages WHERE business_id = ${BUSINESS} AND slug = ${q(pkg.slug)}), ` +
      `(SELECT id FROM products WHERE business_id = ${BUSINESS} AND name = ${q(item.product)}), ${item.quantity})`
  )
).join(',\n')};`);

// ============================================
// Clientes
// ============================================

section('Clientes');
write(`INSERT INTO customers (business_id, first_name, last_name, phone, email, instagram, address)
VALUES
${DEMO_CUSTOMERS.map(
  (c) =>
    `  (${BUSINESS}, ${q(c.first_name)}, ${q(c.last_name)}, ${q(c.phone)}, ${q(c.email)}, ${q(
      'instagram' in c ? (c as { instagram?: string }).instagram : null
    )}, ${q(c.address)})`
).join(',\n')};`);

// ============================================
// Gastos
// ============================================

section('Gastos');
write(`INSERT INTO expense_categories (business_id, name, color, sort_order)
VALUES
${DEMO_EXPENSE_CATEGORIES.map(
  (c) => `  (${BUSINESS}, ${q(c.name)}, ${q(c.color)}, ${c.sort_order})`
).join(',\n')};`);

write(`INSERT INTO expenses (business_id, category_id, description, amount, expense_date, supplier, payment_method)
VALUES
${DEMO_EXPENSES.map(
  (e) =>
    `  (${BUSINESS}, (SELECT id FROM expense_categories WHERE business_id = ${BUSINESS} AND name = ${q(e.category)}), ` +
    `${q(e.description)}, ${e.amount}, ${date(-e.daysAgo)}, ${q(e.supplier)}, ${q(e.payment_method)})`
).join(',\n')};`);

// ============================================
// Pedidos
// ============================================

section('Pedidos');

const round2 = (value: number) => Math.round(value * 100) / 100;

// Mismos costos que calcula la aplicación: override si existe, receta si no.
const ingredientCost = new Map(DEMO_INGREDIENTS.map((i) => [i.name, i.cost_per_unit]));
const unitCostByProduct = new Map<string, number>();
for (const product of DEMO_PRODUCTS) {
  if (product.cost_override) {
    unitCostByProduct.set(product.name, product.cost_override);
    continue;
  }
  const batchCost = product.recipe.reduce(
    (sum, item) => sum + item.quantity_per_batch * (ingredientCost.get(item.ingredient) ?? 0),
    0
  );
  unitCostByProduct.set(product.name, round2(batchCost / product.batch_size));
}

const unitCostByPackage = new Map(
  DEMO_PACKAGES.map((pkg) => [
    pkg.name,
    round2(
      pkg.items.reduce((sum, item) => sum + (unitCostByProduct.get(item.product) ?? 0) * item.quantity, 0)
    ),
  ])
);

const priceByProduct = new Map(DEMO_PRODUCTS.map((p) => [p.name, p.price]));
const priceByPackage = new Map(DEMO_PACKAGES.map((p) => [p.name, p.price]));
const customerByName = new Map(
  DEMO_CUSTOMERS.map((c) => [`${c.first_name} ${c.last_name}`, c])
);

const FLOW = ['pending', 'confirmed', 'in_preparation', 'ready', 'delivered'];

for (const template of DEMO_ORDERS) {
  const customer = customerByName.get(template.customer);

  const items = template.items.map((item) => {
    const name = item.product ?? item.package!;
    const isPackage = !!item.package;
    const unitPrice = isPackage ? priceByPackage.get(name)! : priceByProduct.get(name)!;
    const unitCost = isPackage ? unitCostByPackage.get(name) ?? 0 : unitCostByProduct.get(name) ?? 0;
    return {
      name,
      isPackage,
      unitPrice,
      quantity: item.quantity,
      subtotal: round2(unitPrice * item.quantity),
      unitCost,
      costSubtotal: round2(unitCost * item.quantity),
    };
  });

  const subtotal = round2(items.reduce((sum, i) => sum + i.subtotal, 0));
  const productionCost = round2(items.reduce((sum, i) => sum + i.costSubtotal, 0));
  const deposit = template.depositPct ? round2((subtotal * template.depositPct) / 100) : 0;
  const lead = template.dayOffset >= 0 ? 4 : 2;

  const timeline =
    template.status === 'cancelled'
      ? ['pending', 'cancelled']
      : FLOW.slice(0, FLOW.indexOf(template.status) + 1);

  const itemValues = items
    .map(
      (item) =>
        `    (${
          item.isPackage
            ? 'NULL'
            : `(SELECT id FROM products WHERE business_id = ${BUSINESS} AND name = ${q(item.name)})`
        }, ${
          item.isPackage
            ? `(SELECT id FROM packages WHERE business_id = ${BUSINESS} AND name = ${q(item.name)})`
            : 'NULL'
        }, ${q(item.name)}, ${item.unitPrice}, ${item.quantity}, ${item.subtotal}, ${
          item.unitCost > 0 ? item.unitCost : 'NULL'
        }, ${item.costSubtotal > 0 ? item.costSubtotal : 'NULL'})`
    )
    .join(',\n');

  const historyValues = timeline
    .map(
      (status, index) =>
        `    (${index === 0 ? 'NULL' : q(timeline[index - 1])}, ${q(status)}, ${
          index === 0 ? q('Pedido creado') : 'NULL'
        }, ${timestamp(template.dayOffset - Math.max(0, lead - index))})`
    )
    .join(',\n');

  write(`WITH new_order AS (
  INSERT INTO orders (
    business_id, status, customer_id, contact_name, phone, email,
    delivery_method, address, delivery_date, delivery_time,
    subtotal, production_cost, deposit_amount, payment_method, channel,
    observations, created_at
  ) VALUES (
    ${BUSINESS}, ${q(template.status)},
    (SELECT id FROM customers WHERE business_id = ${BUSINESS} AND full_name = ${q(template.customer)}),
    ${q(template.customer)}, ${q(customer?.phone)}, ${q(customer?.email)},
    ${q(template.delivery_method)},
    ${template.delivery_method === 'delivery' ? q(customer?.address) : 'NULL'},
    ${date(template.dayOffset)}, ${q(template.time)},
    ${subtotal}, ${productionCost > 0 ? productionCost : 'NULL'}, ${deposit},
    ${q(template.payment_method)}, ${q(template.channel ?? 'manual')},
    ${q(template.observations)}, ${timestamp(template.dayOffset - lead)}
  ) RETURNING id
), inserted_items AS (
  INSERT INTO order_items (order_id, product_id, package_id, item_name, unit_price, quantity, subtotal, unit_cost, cost_subtotal)
  SELECT new_order.id, v.product_id, v.package_id, v.item_name, v.unit_price, v.quantity, v.subtotal, v.unit_cost, v.cost_subtotal
  FROM new_order, (VALUES
${itemValues}
  ) AS v(product_id, package_id, item_name, unit_price, quantity, subtotal, unit_cost, cost_subtotal)
)
INSERT INTO order_status_history (order_id, from_status, to_status, notes, created_at)
SELECT new_order.id, v.from_status, v.to_status, v.notes, v.created_at
FROM new_order, (VALUES
${historyValues}
) AS v(from_status, to_status, notes, created_at);`);
}

write('\nCOMMIT;');

console.log(out.join('\n'));
