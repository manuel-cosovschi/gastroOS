/**
 * Semilla y reseteo de la demo de GastroOS.
 *
 *   npx tsx scripts/demo.ts seed    → crea el negocio demo y todos sus datos
 *   npx tsx scripts/demo.ts reset   → borra los datos del negocio demo y los vuelve a crear
 *
 * El reset NO toca el esquema: sólo borra filas del negocio demo. El resto de
 * los negocios de la base quedan intactos, así que es seguro correrlo en una
 * instancia compartida.
 *
 * Necesita `SUPABASE_SERVICE_ROLE_KEY` porque crea el usuario de Auth y escribe
 * saltando RLS. Nunca se importa desde la aplicación.
 */

import { config } from 'dotenv';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
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

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const DEMO_EMAIL = process.env.DEMO_EMAIL || 'demo@gastroos.app';
const DEMO_PASSWORD = process.env.DEMO_PASSWORD;

if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
  console.error(
    '\n✗ Faltan variables de entorno.\n' +
      '  Necesitás NEXT_PUBLIC_SUPABASE_URL y SUPABASE_SERVICE_ROLE_KEY en .env.local\n'
  );
  process.exit(1);
}

if (!DEMO_PASSWORD) {
  console.error(
    '\n✗ Falta DEMO_PASSWORD en .env.local.\n' +
      '  Elegí la contraseña del usuario demo: no hay ninguna por defecto en el código.\n'
  );
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

// ============================================
// Helpers
// ============================================

const round2 = (value: number) => Math.round(value * 100) / 100;

function isoDate(dayOffset: number): string {
  const date = new Date();
  date.setHours(12, 0, 0, 0);
  date.setDate(date.getDate() + dayOffset);
  return date.toISOString().slice(0, 10);
}

/** Timestamp de creación del pedido: unos días antes de la entrega. */
function createdAt(deliveryOffset: number, leadDays: number): string {
  const date = new Date();
  date.setHours(10, 30, 0, 0);
  date.setDate(date.getDate() + deliveryOffset - leadDays);
  return date.toISOString();
}

function fail(step: string, error: unknown): never {
  console.error(`\n✗ Falló en "${step}":`, error);
  process.exit(1);
}

async function findDemoBusiness(client: SupabaseClient): Promise<string | null> {
  const { data } = await client
    .from('businesses')
    .select('id')
    .eq('slug', DEMO_BUSINESS.slug)
    .maybeSingle();
  return data?.id ?? null;
}

// ============================================
// Usuario demo
// ============================================

async function ensureDemoUser(): Promise<string> {
  // listUsers pagina; el usuario demo siempre está en las primeras páginas de
  // una instancia de demo, pero recorremos igual por las dudas.
  let page = 1;
  while (page <= 10) {
    const { data, error } = await supabase.auth.admin.listUsers({ page, perPage: 200 });
    if (error) fail('listar usuarios', error);

    const existing = data.users.find((user) => user.email === DEMO_EMAIL);
    if (existing) {
      // Alineamos la contraseña con la del entorno en cada corrida
      await supabase.auth.admin.updateUserById(existing.id, { password: DEMO_PASSWORD });
      return existing.id;
    }

    if (data.users.length < 200) break;
    page += 1;
  }

  const { data, error } = await supabase.auth.admin.createUser({
    email: DEMO_EMAIL,
    password: DEMO_PASSWORD,
    email_confirm: true,
  });
  if (error || !data.user) fail('crear usuario demo', error);

  return data.user.id;
}

// ============================================
// Borrado
// ============================================

/**
 * Borra los datos del negocio demo.
 *
 * Casi todo cae en cascada desde `businesses`, pero borramos el negocio entero
 * y lo recreamos: así el contador de pedidos vuelve a empezar en 1 y la demo
 * se ve igual cada vez que se resetea.
 */
async function wipeDemoBusiness(): Promise<void> {
  const businessId = await findDemoBusiness(supabase);
  if (!businessId) return;

  const { error } = await supabase.from('businesses').delete().eq('id', businessId);
  if (error) fail('borrar negocio demo', error);
}

// ============================================
// Seed
// ============================================

async function seed(): Promise<void> {
  console.log('→ Creando usuario demo…');
  const userId = await ensureDemoUser();

  console.log('→ Creando el negocio…');
  const { data: business, error: businessError } = await supabase
    .from('businesses')
    .insert({ ...DEMO_BUSINESS, storefront_enabled: true })
    .select()
    .single();
  if (businessError || !business) fail('crear negocio', businessError);

  const businessId = business.id as string;

  const { error: memberError } = await supabase
    .from('business_members')
    .insert({ business_id: businessId, user_id: userId, role: 'owner' });
  if (memberError) fail('asociar usuario al negocio', memberError);

  // ---------- Categorías ----------
  console.log('→ Categorías…');
  const { data: categories, error: categoriesError } = await supabase
    .from('categories')
    .insert(DEMO_CATEGORIES.map((category) => ({ ...category, business_id: businessId })))
    .select('id, name');
  if (categoriesError) fail('crear categorías', categoriesError);

  const categoryByName = new Map((categories || []).map((c) => [c.name, c.id]));

  // ---------- Insumos ----------
  console.log('→ Insumos…');
  const { data: ingredients, error: ingredientsError } = await supabase
    .from('ingredients')
    .insert(DEMO_INGREDIENTS.map((ingredient) => ({ ...ingredient, business_id: businessId })))
    .select('id, name, cost_per_unit');
  if (ingredientsError) fail('crear insumos', ingredientsError);

  const ingredientByName = new Map(
    (ingredients || []).map((i) => [i.name, { id: i.id, cost: Number(i.cost_per_unit) }])
  );

  // ---------- Productos ----------
  console.log('→ Productos y recetas…');
  const { data: products, error: productsError } = await supabase
    .from('products')
    .insert(
      DEMO_PRODUCTS.map((product, index) => ({
        business_id: businessId,
        category_id: categoryByName.get(product.category) ?? null,
        name: product.name,
        slug: product.slug,
        short_description: product.short_description,
        price: product.price,
        cost_override: product.cost_override ?? null,
        sale_unit: product.sale_unit,
        min_quantity: 1,
        min_advance_hours: product.min_advance_hours ?? null,
        stock_quantity: product.stock_quantity,
        min_stock_quantity: product.min_stock_quantity,
        batch_size: product.batch_size,
        sort_order: index,
        is_active: true,
      }))
    )
    .select('id, name');
  if (productsError) fail('crear productos', productsError);

  const productByName = new Map((products || []).map((p) => [p.name, p.id]));

  const recipeRows = DEMO_PRODUCTS.flatMap((product) =>
    product.recipe.map((item) => ({
      product_id: productByName.get(product.name)!,
      ingredient_id: ingredientByName.get(item.ingredient)!.id,
      quantity_per_batch: item.quantity_per_batch,
    }))
  );

  if (recipeRows.length > 0) {
    const { error } = await supabase.from('recipe_items').insert(recipeRows);
    if (error) fail('crear recetas', error);
  }

  // Costo unitario de cada producto, con la misma fórmula que usa la app:
  // override si existe, si no la receta dividida por el tamaño del lote.
  const unitCostByProduct = new Map<string, number>();
  for (const product of DEMO_PRODUCTS) {
    if (product.cost_override) {
      unitCostByProduct.set(product.name, product.cost_override);
      continue;
    }
    const batchCost = product.recipe.reduce(
      (sum, item) => sum + item.quantity_per_batch * (ingredientByName.get(item.ingredient)?.cost ?? 0),
      0
    );
    unitCostByProduct.set(product.name, round2(batchCost / product.batch_size));
  }

  // ---------- Combos ----------
  console.log('→ Combos…');
  const { data: packages, error: packagesError } = await supabase
    .from('packages')
    .insert(
      DEMO_PACKAGES.map((pkg, index) => ({
        business_id: businessId,
        name: pkg.name,
        slug: pkg.slug,
        description: pkg.description,
        price: pkg.price,
        sort_order: index,
        is_active: true,
      }))
    )
    .select('id, name');
  if (packagesError) fail('crear combos', packagesError);

  const packageByName = new Map((packages || []).map((p) => [p.name, p.id]));

  const packageItemRows = DEMO_PACKAGES.flatMap((pkg) =>
    pkg.items.map((item) => ({
      package_id: packageByName.get(pkg.name)!,
      product_id: productByName.get(item.product)!,
      quantity: item.quantity,
    }))
  );
  const { error: packageItemsError } = await supabase.from('package_items').insert(packageItemRows);
  if (packageItemsError) fail('crear items de combos', packageItemsError);

  const unitCostByPackage = new Map<string, number>();
  for (const pkg of DEMO_PACKAGES) {
    const cost = pkg.items.reduce(
      (sum, item) => sum + (unitCostByProduct.get(item.product) ?? 0) * item.quantity,
      0
    );
    unitCostByPackage.set(pkg.name, round2(cost));
  }

  const priceByProduct = new Map(DEMO_PRODUCTS.map((p) => [p.name, p.price]));
  const priceByPackage = new Map(DEMO_PACKAGES.map((p) => [p.name, p.price]));

  // ---------- Clientes ----------
  console.log('→ Clientes…');
  const { data: customers, error: customersError } = await supabase
    .from('customers')
    .insert(DEMO_CUSTOMERS.map((customer) => ({ ...customer, business_id: businessId })))
    .select('id, full_name');
  if (customersError) fail('crear clientes', customersError);

  const customerByName = new Map((customers || []).map((c) => [c.full_name, c.id]));
  const customerByNameData = new Map(
    DEMO_CUSTOMERS.map((c) => [`${c.first_name} ${c.last_name}`, c])
  );

  // ---------- Categorías de gasto y gastos ----------
  console.log('→ Gastos…');
  const { data: expenseCategories, error: expenseCategoriesError } = await supabase
    .from('expense_categories')
    .insert(DEMO_EXPENSE_CATEGORIES.map((c) => ({ ...c, business_id: businessId })))
    .select('id, name');
  if (expenseCategoriesError) fail('crear categorías de gasto', expenseCategoriesError);

  const expenseCategoryByName = new Map((expenseCategories || []).map((c) => [c.name, c.id]));

  const { error: expensesError } = await supabase.from('expenses').insert(
    DEMO_EXPENSES.map((expense) => ({
      business_id: businessId,
      category_id: expenseCategoryByName.get(expense.category) ?? null,
      description: expense.description,
      amount: expense.amount,
      expense_date: isoDate(-expense.daysAgo),
      supplier: expense.supplier ?? null,
      payment_method: expense.payment_method,
    }))
  );
  if (expensesError) fail('crear gastos', expensesError);

  // ---------- Pedidos ----------
  console.log('→ Pedidos…');
  for (const template of DEMO_ORDERS) {
    const customerData = customerByNameData.get(template.customer);
    const customerId = customerByName.get(template.customer) ?? null;

    const items = template.items.map((item) => {
      const name = item.product ?? item.package!;
      const isPackage = !!item.package;
      const unitPrice = isPackage ? priceByPackage.get(name)! : priceByProduct.get(name)!;
      const unitCost = isPackage
        ? unitCostByPackage.get(name) ?? 0
        : unitCostByProduct.get(name) ?? 0;

      return {
        product_id: isPackage ? null : productByName.get(name)!,
        package_id: isPackage ? packageByName.get(name)! : null,
        item_name: name,
        unit_price: unitPrice,
        quantity: item.quantity,
        subtotal: round2(unitPrice * item.quantity),
        unit_cost: unitCost > 0 ? unitCost : null,
        cost_subtotal: unitCost > 0 ? round2(unitCost * item.quantity) : null,
        notes: null,
      };
    });

    const subtotal = round2(items.reduce((sum, item) => sum + item.subtotal, 0));
    const productionCost = round2(items.reduce((sum, item) => sum + (item.cost_subtotal ?? 0), 0));
    const deposit = template.depositPct ? round2((subtotal * template.depositPct) / 100) : 0;

    const { data: order, error: orderError } = await supabase
      .from('orders')
      .insert({
        business_id: businessId,
        status: template.status,
        customer_id: customerId,
        contact_name: template.customer,
        phone: customerData?.phone ?? null,
        email: customerData?.email ?? null,
        delivery_method: template.delivery_method,
        address: template.delivery_method === 'delivery' ? customerData?.address ?? null : null,
        delivery_date: isoDate(template.dayOffset),
        delivery_time: template.time ?? null,
        subtotal,
        production_cost: productionCost > 0 ? productionCost : null,
        deposit_amount: deposit,
        payment_method: template.payment_method ?? null,
        channel: template.channel ?? 'manual',
        observations: template.observations ?? null,
        created_at: createdAt(template.dayOffset, template.dayOffset >= 0 ? 4 : 2),
      })
      .select('id')
      .single();
    if (orderError || !order) fail(`crear pedido de ${template.customer}`, orderError);

    const { error: itemsError } = await supabase
      .from('order_items')
      .insert(items.map((item) => ({ ...item, order_id: order.id })));
    if (itemsError) fail('crear items del pedido', itemsError);

    // Historial coherente con el estado: cada pedido pasó por los anteriores.
    const flow = ['pending', 'confirmed', 'in_preparation', 'ready', 'delivered'];
    const target = flow.indexOf(template.status);
    const timeline =
      template.status === 'cancelled'
        ? ['pending', 'cancelled']
        : flow.slice(0, target + 1);

    const history = timeline.map((status, index) => ({
      order_id: order.id,
      from_status: index === 0 ? null : timeline[index - 1],
      to_status: status,
      notes: index === 0 ? 'Pedido creado' : null,
      created_at: createdAt(template.dayOffset, Math.max(0, 4 - index)),
    }));

    const { error: historyError } = await supabase.from('order_status_history').insert(history);
    if (historyError) fail('crear historial del pedido', historyError);
  }

  console.log(`\n✓ Demo lista: ${DEMO_ORDERS.length} pedidos, ${DEMO_CUSTOMERS.length} clientes, ${DEMO_PRODUCTS.length} productos.`);
  console.log(`  Entrá en /login con ${DEMO_EMAIL} y la contraseña de DEMO_PASSWORD.\n`);
}

// ============================================
// Entrada
// ============================================

async function main() {
  const command = process.argv[2] || 'seed';

  if (command !== 'seed' && command !== 'reset') {
    console.error('Uso: tsx scripts/demo.ts [seed|reset]');
    process.exit(1);
  }

  if (command === 'reset') {
    console.log('→ Borrando los datos del negocio demo…');
    await wipeDemoBusiness();
  } else {
    const existing = await findDemoBusiness(supabase);
    if (existing) {
      console.error(
        `\n✗ Ya existe el negocio "${DEMO_BUSINESS.name}".\n` +
          '  Usá `npm run demo:reset` para regenerar los datos desde cero.\n'
      );
      process.exit(1);
    }
  }

  await seed();
}

main().catch((error) => {
  console.error('\n✗ Error inesperado:', error);
  process.exit(1);
});
