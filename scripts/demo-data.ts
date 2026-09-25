/**
 * Dataset de demostración de GastroOS.
 *
 * Es un negocio ficticio ("Dulce Estudio") con números internamente coherentes:
 * los costos salen de las recetas, las recetas consumen los insumos cargados y
 * los pedidos se distribuyen entre el último mes, hoy y la próxima semana para
 * que el dashboard y las estadísticas tengan algo real que mostrar.
 *
 * Todo dato de contacto es inventado.
 */

export const DEMO_BUSINESS = {
  name: 'Dulce Estudio',
  slug: 'dulce-estudio',
  industry: 'Pastelería artesanal',
  phone: '+54 11 5555 0134',
  email: 'hola@dulceestudio.demo',
  instagram: 'dulce.estudio',
  address: 'Av. Siempre Viva 1234, CABA',
  currency: 'ARS',
  locale: 'es-AR',
  timezone: 'America/Argentina/Buenos_Aires',
};

export const DEMO_CATEGORIES = [
  { name: 'Tortas', slug: 'tortas', sort_order: 1 },
  { name: 'Boxes', slug: 'boxes', sort_order: 2 },
  { name: 'Cookies', slug: 'cookies', sort_order: 3 },
  { name: 'Desayunos', slug: 'desayunos', sort_order: 4 },
  { name: 'Catering', slug: 'catering', sort_order: 5 },
  { name: 'Panadería', slug: 'panaderia', sort_order: 6 },
  { name: 'Otros', slug: 'otros', sort_order: 7 },
];

export interface DemoIngredient {
  name: string;
  unit: string;
  category: string;
  stock_quantity: number;
  min_stock_quantity: number;
  cost_per_unit: number;
  supplier?: string;
}

/**
 * Tres insumos quedan por debajo del mínimo a propósito (chocolate, crema y
 * dulce de leche): el dashboard tiene que abrir con alertas visibles.
 */
export const DEMO_INGREDIENTS: DemoIngredient[] = [
  { name: 'Harina 000', unit: 'kg', category: 'Secos', stock_quantity: 42, min_stock_quantity: 15, cost_per_unit: 1250, supplier: 'Distribuidora Norte' },
  { name: 'Azúcar', unit: 'kg', category: 'Secos', stock_quantity: 28, min_stock_quantity: 12, cost_per_unit: 1480, supplier: 'Distribuidora Norte' },
  { name: 'Chocolate semiamargo', unit: 'kg', category: 'Chocolatería', stock_quantity: 2.4, min_stock_quantity: 8, cost_per_unit: 12800, supplier: 'Insumos Pasteleros SA' },
  { name: 'Crema de leche', unit: 'l', category: 'Lácteos', stock_quantity: 3, min_stock_quantity: 10, cost_per_unit: 3600, supplier: 'Lácteos del Valle' },
  { name: 'Huevos', unit: 'unidad', category: 'Frescos', stock_quantity: 180, min_stock_quantity: 90, cost_per_unit: 210, supplier: 'Granja San Pedro' },
  { name: 'Manteca', unit: 'kg', category: 'Lácteos', stock_quantity: 14, min_stock_quantity: 6, cost_per_unit: 8900, supplier: 'Lácteos del Valle' },
  { name: 'Dulce de leche', unit: 'kg', category: 'Repostería', stock_quantity: 1.5, min_stock_quantity: 5, cost_per_unit: 5400, supplier: 'Insumos Pasteleros SA' },
  { name: 'Queso crema', unit: 'kg', category: 'Lácteos', stock_quantity: 9, min_stock_quantity: 4, cost_per_unit: 7200, supplier: 'Lácteos del Valle' },
  { name: 'Limones', unit: 'kg', category: 'Frescos', stock_quantity: 7, min_stock_quantity: 3, cost_per_unit: 2200, supplier: 'Verdulería Central' },
  { name: 'Cacao amargo', unit: 'kg', category: 'Chocolatería', stock_quantity: 5.5, min_stock_quantity: 2, cost_per_unit: 9600, supplier: 'Insumos Pasteleros SA' },
  { name: 'Colorante rojo', unit: 'ml', category: 'Repostería', stock_quantity: 420, min_stock_quantity: 150, cost_per_unit: 22, supplier: 'Insumos Pasteleros SA' },
  { name: 'Café en grano', unit: 'kg', category: 'Cafetería', stock_quantity: 6, min_stock_quantity: 3, cost_per_unit: 16500, supplier: 'Tostadero Alameda' },
  { name: 'Caja para torta', unit: 'unidad', category: 'Packaging', stock_quantity: 85, min_stock_quantity: 40, cost_per_unit: 780, supplier: 'Packaging Express' },
  { name: 'Box kraft', unit: 'unidad', category: 'Packaging', stock_quantity: 120, min_stock_quantity: 50, cost_per_unit: 620, supplier: 'Packaging Express' },
  { name: 'Etiquetas personalizadas', unit: 'unidad', category: 'Packaging', stock_quantity: 340, min_stock_quantity: 100, cost_per_unit: 95, supplier: 'Packaging Express' },
];

export interface DemoProduct {
  name: string;
  slug: string;
  category: string;
  price: number;
  sale_unit: string;
  short_description: string;
  batch_size: number;
  stock_quantity: number;
  min_stock_quantity: number;
  min_advance_hours?: number;
  /** Costo por lote, en insumos. Define el costo unitario y el consumo de stock. */
  recipe: { ingredient: string; quantity_per_batch: number }[];
  /** Alternativa a la receta para productos que se compran ya hechos. */
  cost_override?: number;
}

export const DEMO_PRODUCTS: DemoProduct[] = [
  {
    name: 'Torta Red Velvet',
    slug: 'torta-red-velvet',
    category: 'Tortas',
    price: 34000,
    sale_unit: 'unidad',
    short_description: 'Bizcochuelo rojo aterciopelado con frosting de queso crema.',
    batch_size: 1,
    stock_quantity: 2,
    min_stock_quantity: 1,
    min_advance_hours: 48,
    recipe: [
      { ingredient: 'Harina 000', quantity_per_batch: 0.5 },
      { ingredient: 'Azúcar', quantity_per_batch: 0.45 },
      { ingredient: 'Manteca', quantity_per_batch: 0.25 },
      { ingredient: 'Huevos', quantity_per_batch: 5 },
      { ingredient: 'Queso crema', quantity_per_batch: 0.4 },
      { ingredient: 'Cacao amargo', quantity_per_batch: 0.03 },
      { ingredient: 'Colorante rojo', quantity_per_batch: 12 },
      { ingredient: 'Caja para torta', quantity_per_batch: 1 },
    ],
  },
  {
    name: 'Torta Matilda',
    slug: 'torta-matilda',
    category: 'Tortas',
    price: 31000,
    sale_unit: 'unidad',
    short_description: 'Chocolate intenso con ganache y relleno de dulce de leche.',
    batch_size: 1,
    stock_quantity: 1,
    min_stock_quantity: 1,
    min_advance_hours: 48,
    recipe: [
      { ingredient: 'Harina 000', quantity_per_batch: 0.45 },
      { ingredient: 'Azúcar', quantity_per_batch: 0.4 },
      { ingredient: 'Chocolate semiamargo', quantity_per_batch: 0.35 },
      { ingredient: 'Crema de leche', quantity_per_batch: 0.3 },
      { ingredient: 'Dulce de leche', quantity_per_batch: 0.35 },
      { ingredient: 'Huevos', quantity_per_batch: 6 },
      { ingredient: 'Manteca', quantity_per_batch: 0.2 },
      { ingredient: 'Caja para torta', quantity_per_batch: 1 },
    ],
  },
  {
    name: 'Cheesecake',
    slug: 'cheesecake',
    category: 'Tortas',
    price: 28000,
    sale_unit: 'unidad',
    short_description: 'Clásico horneado con base de galleta y coulis de frutos rojos.',
    batch_size: 1,
    stock_quantity: 3,
    min_stock_quantity: 1,
    min_advance_hours: 24,
    recipe: [
      { ingredient: 'Queso crema', quantity_per_batch: 0.8 },
      { ingredient: 'Azúcar', quantity_per_batch: 0.25 },
      { ingredient: 'Huevos', quantity_per_batch: 4 },
      { ingredient: 'Crema de leche', quantity_per_batch: 0.25 },
      { ingredient: 'Harina 000', quantity_per_batch: 0.15 },
      { ingredient: 'Caja para torta', quantity_per_batch: 1 },
    ],
  },
  {
    name: 'Lemon Pie',
    slug: 'lemon-pie',
    category: 'Tortas',
    price: 23500,
    sale_unit: 'unidad',
    short_description: 'Masa sablée, curd de limón y merengue italiano.',
    batch_size: 1,
    stock_quantity: 2,
    min_stock_quantity: 1,
    min_advance_hours: 24,
    recipe: [
      { ingredient: 'Harina 000', quantity_per_batch: 0.35 },
      { ingredient: 'Manteca', quantity_per_batch: 0.2 },
      { ingredient: 'Azúcar', quantity_per_batch: 0.3 },
      { ingredient: 'Huevos', quantity_per_batch: 5 },
      { ingredient: 'Limones', quantity_per_batch: 0.6 },
      { ingredient: 'Caja para torta', quantity_per_batch: 1 },
    ],
  },
  {
    name: 'Box Desayuno',
    slug: 'box-desayuno',
    category: 'Boxes',
    price: 19500,
    sale_unit: 'unidad',
    short_description: 'Medialunas, jugo, café de especialidad y dulces del día.',
    batch_size: 1,
    stock_quantity: 6,
    min_stock_quantity: 3,
    recipe: [
      { ingredient: 'Harina 000', quantity_per_batch: 0.3 },
      { ingredient: 'Manteca', quantity_per_batch: 0.15 },
      { ingredient: 'Azúcar', quantity_per_batch: 0.1 },
      { ingredient: 'Café en grano', quantity_per_batch: 0.05 },
      { ingredient: 'Box kraft', quantity_per_batch: 1 },
      { ingredient: 'Etiquetas personalizadas', quantity_per_batch: 1 },
    ],
  },
  {
    name: 'Box Cumpleaños',
    slug: 'box-cumpleanos',
    category: 'Boxes',
    price: 26000,
    sale_unit: 'unidad',
    short_description: 'Mini torta, cookies, alfajores y tarjeta personalizada.',
    batch_size: 1,
    stock_quantity: 4,
    min_stock_quantity: 2,
    recipe: [
      { ingredient: 'Harina 000', quantity_per_batch: 0.35 },
      { ingredient: 'Azúcar', quantity_per_batch: 0.25 },
      { ingredient: 'Chocolate semiamargo', quantity_per_batch: 0.15 },
      { ingredient: 'Dulce de leche', quantity_per_batch: 0.2 },
      { ingredient: 'Manteca', quantity_per_batch: 0.2 },
      { ingredient: 'Box kraft', quantity_per_batch: 1 },
      { ingredient: 'Etiquetas personalizadas', quantity_per_batch: 2 },
    ],
  },
  {
    name: 'Cookies x6',
    slug: 'cookies-x6',
    category: 'Cookies',
    price: 9800,
    sale_unit: 'paquete',
    short_description: 'Seis cookies de chips de chocolate, centro cremoso.',
    batch_size: 4,
    stock_quantity: 14,
    min_stock_quantity: 6,
    recipe: [
      { ingredient: 'Harina 000', quantity_per_batch: 0.9 },
      { ingredient: 'Azúcar', quantity_per_batch: 0.6 },
      { ingredient: 'Manteca', quantity_per_batch: 0.5 },
      { ingredient: 'Chocolate semiamargo', quantity_per_batch: 0.5 },
      { ingredient: 'Huevos', quantity_per_batch: 4 },
      { ingredient: 'Box kraft', quantity_per_batch: 4 },
    ],
  },
  {
    name: 'Brownies x12',
    slug: 'brownies-x12',
    category: 'Cookies',
    price: 15000,
    sale_unit: 'bandeja',
    short_description: 'Brownie húmedo con nueces, cortado en doce porciones.',
    batch_size: 2,
    stock_quantity: 5,
    min_stock_quantity: 3,
    recipe: [
      { ingredient: 'Chocolate semiamargo', quantity_per_batch: 0.6 },
      { ingredient: 'Manteca', quantity_per_batch: 0.4 },
      { ingredient: 'Azúcar', quantity_per_batch: 0.5 },
      { ingredient: 'Harina 000', quantity_per_batch: 0.35 },
      { ingredient: 'Huevos', quantity_per_batch: 6 },
      { ingredient: 'Box kraft', quantity_per_batch: 2 },
    ],
  },
  {
    name: 'Mesa dulce 20 personas',
    slug: 'mesa-dulce-20',
    category: 'Catering',
    price: 98000,
    sale_unit: 'servicio',
    short_description: 'Surtido de mini pastelería, bocados salados y bebida.',
    batch_size: 1,
    stock_quantity: 0,
    min_stock_quantity: 0,
    min_advance_hours: 96,
    cost_override: 41000,
    recipe: [],
  },
  {
    name: 'Pan de masa madre',
    slug: 'pan-masa-madre',
    category: 'Panadería',
    price: 5200,
    sale_unit: 'unidad',
    short_description: 'Fermentación de 24 horas, corteza crocante.',
    batch_size: 6,
    stock_quantity: 9,
    min_stock_quantity: 4,
    recipe: [
      { ingredient: 'Harina 000', quantity_per_batch: 3 },
      { ingredient: 'Etiquetas personalizadas', quantity_per_batch: 6 },
    ],
  },
  {
    name: 'Alfajores de maicena x12',
    slug: 'alfajores-maicena-x12',
    category: 'Otros',
    price: 12500,
    sale_unit: 'caja',
    short_description: 'Rellenos de dulce de leche y coco rallado.',
    batch_size: 3,
    stock_quantity: 7,
    min_stock_quantity: 4,
    recipe: [
      { ingredient: 'Harina 000', quantity_per_batch: 0.6 },
      { ingredient: 'Manteca', quantity_per_batch: 0.45 },
      { ingredient: 'Dulce de leche', quantity_per_batch: 0.9 },
      { ingredient: 'Azúcar', quantity_per_batch: 0.3 },
      { ingredient: 'Huevos', quantity_per_batch: 6 },
      { ingredient: 'Box kraft', quantity_per_batch: 3 },
    ],
  },
];

export const DEMO_PACKAGES = [
  {
    name: 'Combo Merienda',
    slug: 'combo-merienda',
    description: 'Cookies x6 + Brownies x12 + Pan de masa madre. Ideal para compartir.',
    price: 27500,
    items: [
      { product: 'Cookies x6', quantity: 1 },
      { product: 'Brownies x12', quantity: 1 },
      { product: 'Pan de masa madre', quantity: 1 },
    ],
  },
  {
    name: 'Combo Cumpleaños',
    slug: 'combo-cumpleanos',
    description: 'Torta a elección + Cookies x6 + Alfajores x12.',
    price: 52000,
    items: [
      { product: 'Torta Matilda', quantity: 1 },
      { product: 'Cookies x6', quantity: 1 },
      { product: 'Alfajores de maicena x12', quantity: 1 },
    ],
  },
];

export const DEMO_CUSTOMERS = [
  { first_name: 'Lucía', last_name: 'Fernández', phone: '+54 11 5555 0101', email: 'lucia.fernandez@example.com', instagram: 'lu.fernandez', address: 'Nicaragua 4820, Palermo' },
  { first_name: 'Martín', last_name: 'Pérez', phone: '+54 11 5555 0102', email: 'martin.perez@example.com', address: 'Av. Rivadavia 7200, Flores' },
  { first_name: 'Sofía', last_name: 'Gómez', phone: '+54 11 5555 0103', email: 'sofia.gomez@example.com', instagram: 'sofigomez', address: 'Jaramillo 2150, Núñez' },
  { first_name: 'Camila', last_name: 'Rodríguez', phone: '+54 11 5555 0104', email: 'camila.rodriguez@example.com', address: 'Bulnes 1420, Almagro' },
  { first_name: 'Juan', last_name: 'Martínez', phone: '+54 11 5555 0105', email: 'juan.martinez@example.com', address: 'Gorriti 5100, Palermo' },
  { first_name: 'Paula', last_name: 'Álvarez', phone: '+54 11 5555 0106', email: 'paula.alvarez@example.com', instagram: 'pau.alvarez', address: 'Av. Cabildo 2900, Belgrano' },
  { first_name: 'Agustina', last_name: 'López', phone: '+54 11 5555 0107', email: 'agustina.lopez@example.com', address: 'Charcas 3450, Palermo' },
  { first_name: 'Nicolás', last_name: 'García', phone: '+54 11 5555 0108', email: 'nicolas.garcia@example.com', address: 'Olleros 1800, Colegiales' },
];

export const DEMO_EXPENSE_CATEGORIES = [
  { name: 'Ingredientes', color: '#eb6834', sort_order: 1 },
  { name: 'Packaging', color: '#2a78d6', sort_order: 2 },
  { name: 'Servicios', color: '#4a3aa7', sort_order: 3 },
  { name: 'Delivery', color: '#1baf7a', sort_order: 4 },
  { name: 'Publicidad', color: '#e87ba4', sort_order: 5 },
  { name: 'Equipamiento', color: '#eda100', sort_order: 6 },
  { name: 'Impuestos', color: '#e34948', sort_order: 7 },
  { name: 'Otros', color: '#64748b', sort_order: 8 },
];

export interface DemoExpenseTemplate {
  description: string;
  category: string;
  amount: number;
  supplier?: string;
  payment_method: 'cash' | 'transfer' | 'card' | 'mercadopago' | 'other';
  /** Días hacia atrás desde hoy. */
  daysAgo: number;
}

export const DEMO_EXPENSES: DemoExpenseTemplate[] = [
  // ---- Período anterior (días 31 a 60) ----
  // Existe para que los filtros "mes anterior" y las comparaciones contra el
  // período previo tengan contra qué comparar. Es deliberadamente algo peor que
  // el mes actual, para que la demo muestre una tendencia de mejora.
  { description: 'Compra mensual de harina y azúcar', category: 'Ingredientes', amount: 22400, supplier: 'Distribuidora Norte', payment_method: 'transfer', daysAgo: 58 },
  { description: 'Chocolate y cacao', category: 'Ingredientes', amount: 37800, supplier: 'Insumos Pasteleros SA', payment_method: 'transfer', daysAgo: 55 },
  { description: 'Cajas y boxes', category: 'Packaging', amount: 18300, supplier: 'Packaging Express', payment_method: 'card', daysAgo: 52 },
  { description: 'Luz y gas del local', category: 'Servicios', amount: 19700, payment_method: 'transfer', daysAgo: 49 },
  { description: 'Lácteos del mes', category: 'Ingredientes', amount: 28300, supplier: 'Lácteos del Valle', payment_method: 'transfer', daysAgo: 46 },
  { description: 'Publicidad en redes', category: 'Publicidad', amount: 16700, payment_method: 'card', daysAgo: 43 },
  { description: 'Envíos', category: 'Delivery', amount: 10800, payment_method: 'mercadopago', daysAgo: 40 },
  { description: 'Monotributo', category: 'Impuestos', amount: 19400, payment_method: 'transfer', daysAgo: 38 },
  { description: 'Huevos y frutas', category: 'Ingredientes', amount: 13800, supplier: 'Granja San Pedro', payment_method: 'cash', daysAgo: 35 },
  { description: 'Reparación de heladera', category: 'Equipamiento', amount: 27300, payment_method: 'cash', daysAgo: 32 },

  // ---- Últimos 30 días ----
  { description: 'Compra mensual de harina y azúcar', category: 'Ingredientes', amount: 53000, supplier: 'Distribuidora Norte', payment_method: 'transfer', daysAgo: 29 },
  { description: 'Chocolate semiamargo y cacao', category: 'Ingredientes', amount: 81000, supplier: 'Insumos Pasteleros SA', payment_method: 'transfer', daysAgo: 27 },
  { description: 'Cajas para torta y boxes kraft', category: 'Packaging', amount: 39800, supplier: 'Packaging Express', payment_method: 'card', daysAgo: 26 },
  { description: 'Luz y gas del local', category: 'Servicios', amount: 46400, payment_method: 'transfer', daysAgo: 24 },
  { description: 'Lácteos: crema, manteca y queso crema', category: 'Ingredientes', amount: 61600, supplier: 'Lácteos del Valle', payment_method: 'transfer', daysAgo: 22 },
  { description: 'Publicidad en redes', category: 'Publicidad', amount: 24800, payment_method: 'card', daysAgo: 21 },
  { description: 'Envíos de la semana', category: 'Delivery', amount: 21200, payment_method: 'mercadopago', daysAgo: 19 },
  { description: 'Etiquetas personalizadas', category: 'Packaging', amount: 15900, supplier: 'Packaging Express', payment_method: 'transfer', daysAgo: 17 },
  { description: 'Huevos y frutas', category: 'Ingredientes', amount: 29800, supplier: 'Granja San Pedro', payment_method: 'cash', daysAgo: 15 },
  { description: 'Internet y telefonía', category: 'Servicios', amount: 17300, payment_method: 'transfer', daysAgo: 14 },
  { description: 'Batidora planetaria (cuota 3/6)', category: 'Equipamiento', amount: 42900, payment_method: 'card', daysAgo: 12 },
  { description: 'Envíos de la semana', category: 'Delivery', amount: 22700, payment_method: 'mercadopago', daysAgo: 12 },
  { description: 'Monotributo', category: 'Impuestos', amount: 25700, payment_method: 'transfer', daysAgo: 10 },
  { description: 'Café en grano', category: 'Ingredientes', amount: 36300, supplier: 'Tostadero Alameda', payment_method: 'transfer', daysAgo: 9 },
  { description: 'Sesión de fotos para el catálogo', category: 'Publicidad', amount: 50600, payment_method: 'transfer', daysAgo: 7 },
  { description: 'Reposición de dulce de leche', category: 'Ingredientes', amount: 23800, supplier: 'Insumos Pasteleros SA', payment_method: 'cash', daysAgo: 6 },
  { description: 'Envíos de la semana', category: 'Delivery', amount: 20000, payment_method: 'mercadopago', daysAgo: 5 },
  { description: 'Mantenimiento del horno', category: 'Equipamiento', amount: 31900, payment_method: 'cash', daysAgo: 4 },
  { description: 'Boxes kraft y bolsas', category: 'Packaging', amount: 19100, supplier: 'Packaging Express', payment_method: 'card', daysAgo: 2 },
  { description: 'Frutas y limones', category: 'Ingredientes', amount: 12500, supplier: 'Verdulería Central', payment_method: 'cash', daysAgo: 1 },
  { description: 'Café y leche para el local', category: 'Ingredientes', amount: 10100, payment_method: 'cash', daysAgo: 0 },
];

export type DemoOrderStatus =
  | 'pending'
  | 'confirmed'
  | 'in_preparation'
  | 'ready'
  | 'delivered'
  | 'cancelled';

export interface DemoOrderTemplate {
  customer: string;
  /** Días respecto a hoy: negativo = pasado, 0 = hoy, positivo = futuro. */
  dayOffset: number;
  time?: string;
  status: DemoOrderStatus;
  delivery_method: 'pickup' | 'delivery';
  payment_method?: 'cash' | 'transfer' | 'card' | 'mercadopago';
  /** Porcentaje del total cobrado como seña. */
  depositPct?: number;
  channel?: 'manual' | 'storefront';
  observations?: string;
  items: { product?: string; package?: string; quantity: number }[];
}

/**
* 42 pedidos. Los del pasado están entregados (o uno cancelado), los de hoy en
 * marcha y los de la semana que viene en distintas etapas: así el tablero
 * muestra actividad en todos los estados sin que haya que tocar nada.
 */
export const DEMO_ORDERS: DemoOrderTemplate[] = [
  // ---- Período anterior (días 31 a 60), entregados ----
  // Da base de comparación a "mes anterior" y a las variaciones porcentuales.
  { customer: 'Martín Pérez', dayOffset: -57, time: '09:30', status: 'delivered', delivery_method: 'pickup', payment_method: 'cash', items: [{ product: 'Box Desayuno', quantity: 2 }] },
  { customer: 'Lucía Fernández', dayOffset: -54, time: '15:00', status: 'delivered', delivery_method: 'delivery', payment_method: 'transfer', depositPct: 50, items: [{ product: 'Torta Matilda', quantity: 1 }] },
  { customer: 'Camila Rodríguez', dayOffset: -51, time: '12:00', status: 'delivered', delivery_method: 'pickup', payment_method: 'cash', items: [{ product: 'Cookies x6', quantity: 2 }] },
  { customer: 'Sofía Gómez', dayOffset: -48, time: '17:00', status: 'delivered', delivery_method: 'delivery', payment_method: 'mercadopago', items: [{ product: 'Cheesecake', quantity: 1 }] },
  { customer: 'Nicolás García', dayOffset: -45, time: '11:00', status: 'delivered', delivery_method: 'pickup', payment_method: 'transfer', items: [{ product: 'Alfajores de maicena x12', quantity: 1 }, { product: 'Pan de masa madre', quantity: 2 }] },
  { customer: 'Paula Álvarez', dayOffset: -42, time: '16:30', status: 'delivered', delivery_method: 'delivery', payment_method: 'card', items: [{ product: 'Lemon Pie', quantity: 1 }] },
  { customer: 'Juan Martínez', dayOffset: -39, time: '13:00', status: 'delivered', delivery_method: 'pickup', payment_method: 'cash', items: [{ package: 'Combo Merienda', quantity: 1 }] },
  { customer: 'Agustina López', dayOffset: -36, time: '18:00', status: 'delivered', delivery_method: 'delivery', payment_method: 'transfer', depositPct: 50, items: [{ product: 'Box Cumpleaños', quantity: 1 }] },
  { customer: 'Lucía Fernández', dayOffset: -34, time: '10:30', status: 'delivered', delivery_method: 'delivery', payment_method: 'transfer', items: [{ product: 'Torta Red Velvet', quantity: 1 }] },
  { customer: 'Martín Pérez', dayOffset: -31, time: '09:00', status: 'delivered', delivery_method: 'pickup', payment_method: 'mercadopago', items: [{ product: 'Box Desayuno', quantity: 3 }, { product: 'Brownies x12', quantity: 1 }] },

  // ---- Últimos 30 días (entregados) ----
  { customer: 'Lucía Fernández', dayOffset: -28, time: '11:00', status: 'delivered', delivery_method: 'delivery', payment_method: 'transfer', depositPct: 50, items: [{ product: 'Torta Red Velvet', quantity: 1 }, { product: 'Cookies x6', quantity: 2 }] },
  { customer: 'Martín Pérez', dayOffset: -27, time: '09:30', status: 'delivered', delivery_method: 'pickup', payment_method: 'cash', items: [{ product: 'Box Desayuno', quantity: 3 }] },
  { customer: 'Sofía Gómez', dayOffset: -25, time: '16:00', status: 'delivered', delivery_method: 'delivery', payment_method: 'mercadopago', depositPct: 100, items: [{ product: 'Cheesecake', quantity: 1 }, { product: 'Brownies x12', quantity: 1 }] },
  { customer: 'Camila Rodríguez', dayOffset: -24, time: '13:00', status: 'delivered', delivery_method: 'pickup', payment_method: 'cash', items: [{ product: 'Alfajores de maicena x12', quantity: 2 }] },
  { customer: 'Lucía Fernández', dayOffset: -22, time: '10:30', status: 'delivered', delivery_method: 'delivery', payment_method: 'transfer', depositPct: 50, items: [{ product: 'Torta Matilda', quantity: 1 }] },
  { customer: 'Juan Martínez', dayOffset: -21, time: '18:00', status: 'delivered', delivery_method: 'delivery', payment_method: 'card', items: [{ package: 'Combo Merienda', quantity: 1 }] },
  { customer: 'Paula Álvarez', dayOffset: -19, time: '12:00', status: 'delivered', delivery_method: 'pickup', payment_method: 'cash', items: [{ product: 'Lemon Pie', quantity: 1 }, { product: 'Pan de masa madre', quantity: 2 }] },
  { customer: 'Agustina López', dayOffset: -18, time: '15:30', status: 'delivered', delivery_method: 'delivery', payment_method: 'mercadopago', depositPct: 100, items: [{ product: 'Box Cumpleaños', quantity: 2 }] },
  { customer: 'Sofía Gómez', dayOffset: -16, time: '11:30', status: 'delivered', delivery_method: 'pickup', payment_method: 'transfer', items: [{ product: 'Cookies x6', quantity: 3 }] },
  { customer: 'Nicolás García', dayOffset: -15, time: '19:00', status: 'delivered', delivery_method: 'delivery', payment_method: 'transfer', depositPct: 50, observations: 'Sin nueces, por favor.', items: [{ product: 'Mesa dulce 20 personas', quantity: 1 }] },
  { customer: 'Martín Pérez', dayOffset: -14, time: '09:00', status: 'delivered', delivery_method: 'pickup', payment_method: 'cash', items: [{ product: 'Box Desayuno', quantity: 2 }, { product: 'Pan de masa madre', quantity: 1 }] },
  { customer: 'Camila Rodríguez', dayOffset: -12, time: '17:00', status: 'delivered', delivery_method: 'delivery', payment_method: 'mercadopago', items: [{ product: 'Cheesecake', quantity: 1 }] },
  { customer: 'Lucía Fernández', dayOffset: -11, time: '14:00', status: 'delivered', delivery_method: 'delivery', payment_method: 'transfer', depositPct: 50, items: [{ product: 'Torta Red Velvet', quantity: 1 }, { product: 'Box Cumpleaños', quantity: 1 }] },
  { customer: 'Juan Martínez', dayOffset: -10, time: '13:30', status: 'cancelled', delivery_method: 'pickup', observations: 'El cliente reprogramó para el mes que viene.', items: [{ product: 'Torta Matilda', quantity: 1 }] },
  { customer: 'Paula Álvarez', dayOffset: -9, time: '10:00', status: 'delivered', delivery_method: 'pickup', payment_method: 'cash', items: [{ product: 'Brownies x12', quantity: 2 }] },
  { customer: 'Agustina López', dayOffset: -8, time: '16:30', status: 'delivered', delivery_method: 'delivery', payment_method: 'card', depositPct: 50, items: [{ package: 'Combo Cumpleaños', quantity: 1 }] },
  { customer: 'Sofía Gómez', dayOffset: -7, time: '11:00', status: 'delivered', delivery_method: 'delivery', payment_method: 'transfer', channel: 'storefront', items: [{ product: 'Lemon Pie', quantity: 1 }, { product: 'Cookies x6', quantity: 1 }] },
  { customer: 'Nicolás García', dayOffset: -6, time: '12:30', status: 'delivered', delivery_method: 'pickup', payment_method: 'cash', items: [{ product: 'Alfajores de maicena x12', quantity: 1 }, { product: 'Pan de masa madre', quantity: 3 }] },
  { customer: 'Martín Pérez', dayOffset: -5, time: '09:30', status: 'delivered', delivery_method: 'pickup', payment_method: 'mercadopago', items: [{ product: 'Box Desayuno', quantity: 4 }] },
  { customer: 'Camila Rodríguez', dayOffset: -4, time: '18:30', status: 'delivered', delivery_method: 'delivery', payment_method: 'transfer', depositPct: 100, items: [{ product: 'Torta Red Velvet', quantity: 1 }] },
  { customer: 'Lucía Fernández', dayOffset: -3, time: '15:00', status: 'delivered', delivery_method: 'delivery', payment_method: 'card', items: [{ product: 'Cheesecake', quantity: 1 }, { product: 'Brownies x12', quantity: 1 }] },
  { customer: 'Juan Martínez', dayOffset: -2, time: '11:30', status: 'delivered', delivery_method: 'pickup', payment_method: 'cash', items: [{ product: 'Cookies x6', quantity: 2 }] },
  { customer: 'Paula Álvarez', dayOffset: -1, time: '17:30', status: 'delivered', delivery_method: 'delivery', payment_method: 'transfer', depositPct: 50, channel: 'storefront', items: [{ product: 'Box Cumpleaños', quantity: 1 }, { product: 'Alfajores de maicena x12', quantity: 1 }] },

  // ---- Hoy ----
  { customer: 'Lucía Fernández', dayOffset: 0, time: '10:30', status: 'ready', delivery_method: 'delivery', payment_method: 'transfer', depositPct: 50, observations: 'Tocar timbre 4B.', items: [{ product: 'Torta Red Velvet', quantity: 1 }] },
  { customer: 'Martín Pérez', dayOffset: 0, time: '13:00', status: 'in_preparation', delivery_method: 'pickup', payment_method: 'cash', items: [{ product: 'Box Desayuno', quantity: 2 }] },
  { customer: 'Sofía Gómez', dayOffset: 0, time: '17:30', status: 'confirmed', delivery_method: 'delivery', payment_method: 'mercadopago', depositPct: 50, observations: 'Mensaje en la torta: "Feliz cumple, Sofi".', items: [{ product: 'Torta Matilda', quantity: 1 }, { product: 'Cookies x6', quantity: 1 }] },

  // ---- Próximos 7 días ----
  { customer: 'Camila Rodríguez', dayOffset: 1, time: '11:00', status: 'confirmed', delivery_method: 'delivery', payment_method: 'transfer', depositPct: 50, items: [{ product: 'Cheesecake', quantity: 2 }] },
  { customer: 'Agustina López', dayOffset: 1, time: '16:00', status: 'pending', delivery_method: 'pickup', channel: 'storefront', items: [{ product: 'Box Cumpleaños', quantity: 1 }] },
  { customer: 'Nicolás García', dayOffset: 2, time: '19:30', status: 'confirmed', delivery_method: 'delivery', payment_method: 'transfer', depositPct: 50, observations: 'Evento corporativo, entregar en recepción.', items: [{ product: 'Mesa dulce 20 personas', quantity: 1 }] },
  { customer: 'Juan Martínez', dayOffset: 3, time: '12:00', status: 'pending', delivery_method: 'pickup', channel: 'storefront', items: [{ package: 'Combo Merienda', quantity: 2 }] },
  { customer: 'Paula Álvarez', dayOffset: 4, time: '15:30', status: 'pending', delivery_method: 'delivery', items: [{ product: 'Lemon Pie', quantity: 1 }, { product: 'Brownies x12', quantity: 1 }] },
  { customer: 'Lucía Fernández', dayOffset: 6, time: '10:00', status: 'confirmed', delivery_method: 'delivery', payment_method: 'card', depositPct: 30, items: [{ package: 'Combo Cumpleaños', quantity: 1 }] },
];
