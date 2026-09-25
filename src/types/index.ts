// ============================================
// Estados de pedido
// ============================================

export const ORDER_STATUSES = [
  'pending',
  'confirmed',
  'in_preparation',
  'ready',
  'delivered',
  'cancelled',
] as const;

export type OrderStatus = (typeof ORDER_STATUSES)[number];

export const ORDER_STATUS_LABELS: Record<OrderStatus, string> = {
  pending: 'Pendiente',
  confirmed: 'Confirmado',
  in_preparation: 'En preparación',
  ready: 'Listo',
  delivered: 'Entregado',
  cancelled: 'Cancelado',
};

/** Clases de Tailwind para el badge de cada estado. */
export const ORDER_STATUS_COLORS: Record<OrderStatus, string> = {
  pending: 'bg-amber-100 text-amber-800 ring-amber-200',
  confirmed: 'bg-sky-100 text-sky-800 ring-sky-200',
  in_preparation: 'bg-violet-100 text-violet-800 ring-violet-200',
  ready: 'bg-emerald-100 text-emerald-800 ring-emerald-200',
  delivered: 'bg-slate-100 text-slate-700 ring-slate-200',
  cancelled: 'bg-rose-100 text-rose-800 ring-rose-200',
};

/** Color sólido, para puntos en el calendario y gráficos. */
export const ORDER_STATUS_DOTS: Record<OrderStatus, string> = {
  pending: 'bg-amber-500',
  confirmed: 'bg-sky-500',
  in_preparation: 'bg-violet-500',
  ready: 'bg-emerald-500',
  delivered: 'bg-slate-400',
  cancelled: 'bg-rose-500',
};

/**
 * Transiciones permitidas. Se puede avanzar paso a paso o saltar hacia
 * adelante (un pedido que se entrega en el momento va de pendiente a
 * entregado sin pasar por los intermedios). Cancelar siempre está permitido
 * salvo que el pedido ya esté cerrado.
 */
export const VALID_TRANSITIONS: Record<OrderStatus, OrderStatus[]> = {
  pending: ['confirmed', 'in_preparation', 'ready', 'delivered', 'cancelled'],
  confirmed: ['in_preparation', 'ready', 'delivered', 'cancelled'],
  in_preparation: ['ready', 'delivered', 'cancelled'],
  ready: ['delivered', 'cancelled'],
  delivered: [],
  cancelled: [],
};

/** Estados que cuentan como pedido vivo (ni entregado ni cancelado). */
export const OPEN_ORDER_STATUSES: OrderStatus[] = [
  'pending',
  'confirmed',
  'in_preparation',
  'ready',
];

/** Estados que suman a facturación. */
export const REVENUE_ORDER_STATUSES: OrderStatus[] = [
  'pending',
  'confirmed',
  'in_preparation',
  'ready',
  'delivered',
];

// ============================================
// Entrega y pagos
// ============================================

export const DELIVERY_METHODS = ['pickup', 'delivery'] as const;
export type DeliveryMethod = (typeof DELIVERY_METHODS)[number];

export const DELIVERY_METHOD_LABELS: Record<DeliveryMethod, string> = {
  pickup: 'Retiro en el local',
  delivery: 'Envío a domicilio',
};

export const PAYMENT_METHODS = ['cash', 'transfer', 'card', 'mercadopago', 'other'] as const;
export type PaymentMethod = (typeof PAYMENT_METHODS)[number];

export const PAYMENT_METHOD_LABELS: Record<PaymentMethod, string> = {
  cash: 'Efectivo',
  transfer: 'Transferencia',
  card: 'Tarjeta',
  mercadopago: 'Mercado Pago',
  other: 'Otro',
};

export const ORDER_CHANNELS = ['manual', 'storefront'] as const;
export type OrderChannel = (typeof ORDER_CHANNELS)[number];

export const ORDER_CHANNEL_LABELS: Record<OrderChannel, string> = {
  manual: 'Carga manual',
  storefront: 'Tienda online',
};

// ============================================
// Negocio
// ============================================

export const BUSINESS_ROLES = ['owner', 'manager', 'staff'] as const;
export type BusinessRole = (typeof BUSINESS_ROLES)[number];

export interface Business {
  id: string;
  name: string;
  slug: string;
  industry: string | null;
  logo_url: string | null;
  phone: string | null;
  email: string | null;
  instagram: string | null;
  address: string | null;
  currency: string;
  locale: string;
  timezone: string;
  storefront_enabled: boolean;
  created_at: string;
  updated_at: string;
}

/**
 * El negocio tal como lo ve la tienda pública: sin las columnas que el rol
 * anónimo no tiene permiso de leer (ver el GRANT de la migración 001).
 */
export type StorefrontBusiness = Omit<Business, 'created_at' | 'updated_at'>;

export interface UpdateBusinessInput {
  name?: string;
  industry?: string | null;
  logo_url?: string | null;
  phone?: string | null;
  email?: string | null;
  instagram?: string | null;
  address?: string | null;
  currency?: string;
  timezone?: string;
  storefront_enabled?: boolean;
}

// ============================================
// Catálogo
// ============================================

export interface Category {
  id: string;
  business_id: string;
  name: string;
  slug: string;
  description: string | null;
  sort_order: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface Product {
  id: string;
  business_id: string;
  category_id: string | null;
  name: string;
  slug: string;
  short_description: string | null;
  long_description: string | null;
  ingredients: string | null;
  price: number;
  cost_override: number | null;
  image_url: string | null;
  gallery_urls: string[];
  is_active: boolean;
  sale_unit: string;
  min_quantity: number;
  min_advance_hours: number | null;
  stock_quantity: number;
  min_stock_quantity: number;
  batch_size: number;
  sort_order: number;
  created_at: string;
  updated_at: string;
  category?: Category;
}

/** Producto con margen ya calculado (costo real resuelto desde receta u override). */
export interface ProductWithMargin extends Product {
  unit_cost: number;
  margin: number;
  margin_pct: number;
}

export interface Package {
  id: string;
  business_id: string;
  name: string;
  slug: string;
  description: string | null;
  image_url: string | null;
  price: number;
  is_editable: boolean;
  is_active: boolean;
  sort_order: number;
  created_at: string;
  updated_at: string;
}

export interface PackageItem {
  id: string;
  package_id: string;
  product_id: string;
  quantity: number;
  product?: Product;
}

export interface PackageDetail extends Package {
  items: PackageItem[];
}

// ============================================
// Clientes
// ============================================

export interface Customer {
  id: string;
  business_id: string;
  first_name: string;
  last_name: string | null;
  full_name: string;
  phone: string | null;
  email: string | null;
  instagram: string | null;
  address: string | null;
  notes: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

/** Cliente + métricas derivadas de sus pedidos. */
export interface CustomerWithStats extends Customer {
  orders_count: number;
  total_spent: number;
  average_ticket: number;
  last_order_date: string | null;
}

export interface CreateCustomerInput {
  first_name: string;
  last_name?: string;
  phone?: string;
  email?: string;
  instagram?: string;
  address?: string;
  notes?: string;
}

export type UpdateCustomerInput = Partial<CreateCustomerInput> & { is_active?: boolean };

// ============================================
// Pedidos
// ============================================

export interface Order {
  id: string;
  business_id: string;
  order_number: number;
  status: OrderStatus;
  customer_id: string | null;
  contact_name: string;
  phone: string | null;
  email: string | null;
  delivery_method: DeliveryMethod;
  address: string | null;
  city: string | null;
  delivery_date: string;
  delivery_time: string | null;
  subtotal: number;
  production_cost: number | null;
  deposit_amount: number;
  balance_due: number;
  payment_method: PaymentMethod | null;
  channel: OrderChannel;
  observations: string | null;
  admin_notes: string | null;
  requires_invoice: boolean;
  invoice_data: Record<string, unknown> | null;
  created_at: string;
  updated_at: string;
}

export interface OrderItem {
  id: string;
  order_id: string;
  product_id: string | null;
  package_id: string | null;
  item_name: string;
  unit_price: number;
  quantity: number;
  subtotal: number;
  unit_cost: number | null;
  cost_subtotal: number | null;
  notes: string | null;
}

export interface OrderStatusHistory {
  id: string;
  order_id: string;
  from_status: OrderStatus | null;
  to_status: OrderStatus;
  changed_by: string | null;
  notes: string | null;
  created_at: string;
}

export interface OrderDetail extends Order {
  items: OrderItem[];
  status_history: OrderStatusHistory[];
  customer: Customer | null;
}

/** Pedido enriquecido para listados (nombre de cliente ya resuelto). */
export interface OrderListItem extends Order {
  items_summary: string;
}

export interface OrderLineInput {
  product_id?: string;
  package_id?: string;
  quantity: number;
  notes?: string;
}

export interface CreateOrderInput {
  customer_id?: string;
  /** Si no viene customer_id, se crea/reutiliza un cliente con estos datos. */
  contact_name: string;
  phone?: string;
  email?: string;
  delivery_method: DeliveryMethod;
  address?: string;
  city?: string;
  delivery_date: string;
  delivery_time?: string;
  deposit_amount?: number;
  payment_method?: PaymentMethod;
  observations?: string;
  admin_notes?: string;
  status?: OrderStatus;
  requires_invoice?: boolean;
  items: OrderLineInput[];
}

export type UpdateOrderInput = Partial<Omit<CreateOrderInput, 'items'>> & {
  items?: OrderLineInput[];
};

export interface OrderFilters {
  status?: OrderStatus;
  customer_id?: string;
  from_date?: string;
  to_date?: string;
  search?: string;
  scope?: 'all' | 'upcoming' | 'history';
  page?: number;
  per_page?: number;
}

// ============================================
// Productos: inputs
// ============================================

export interface CreateProductInput {
  name: string;
  category_id?: string | null;
  short_description?: string;
  long_description?: string;
  ingredients?: string;
  price: number;
  cost_override?: number | null;
  image_url?: string;
  gallery_urls?: string[];
  sale_unit?: string;
  min_quantity?: number;
  min_advance_hours?: number | null;
  batch_size?: number;
  is_active?: boolean;
}

export type UpdateProductInput = Partial<CreateProductInput>;

export interface CreatePackageInput {
  name: string;
  description?: string;
  image_url?: string;
  price: number;
  is_editable?: boolean;
  is_active?: boolean;
  items: { product_id: string; quantity: number }[];
}

export type UpdatePackageInput = Partial<Omit<CreatePackageInput, 'items'>> & {
  items?: { product_id: string; quantity: number }[];
};

export interface CreateCategoryInput {
  name: string;
  description?: string;
  sort_order?: number;
}

export type UpdateCategoryInput = Partial<CreateCategoryInput> & { is_active?: boolean };

export interface ProductFilters {
  category_id?: string;
  is_active?: boolean;
  search?: string;
}

// ============================================
// Stock
// ============================================

/** Unidades sugeridas. El campo es texto libre: el negocio puede usar otras. */
export const STOCK_UNITS = ['kg', 'g', 'l', 'ml', 'unidad', 'docena', 'paquete', 'caja'] as const;

export const MOVEMENT_TYPES = [
  'purchase',
  'production',
  'order_deduction',
  'production_consumption',
  'adjustment',
  'waste',
] as const;
export type MovementType = (typeof MOVEMENT_TYPES)[number];

export const MOVEMENT_TYPE_LABELS: Record<MovementType, string> = {
  purchase: 'Compra',
  production: 'Producción',
  order_deduction: 'Salida por pedido',
  production_consumption: 'Consumo de producción',
  adjustment: 'Ajuste manual',
  waste: 'Merma',
};

export interface Ingredient {
  id: string;
  business_id: string;
  name: string;
  unit: string;
  category: string | null;
  stock_quantity: number;
  min_stock_quantity: number;
  cost_per_unit: number;
  supplier: string | null;
  notes: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface RecipeItem {
  id: string;
  product_id: string;
  ingredient_id: string;
  quantity_per_batch: number;
  ingredient?: Ingredient;
}

export interface StockMovement {
  id: string;
  business_id: string;
  reference_type: 'ingredient' | 'product';
  reference_id: string;
  movement_type: MovementType;
  quantity: number;
  unit_cost: number | null;
  order_id: string | null;
  notes: string | null;
  created_by: string | null;
  created_at: string;
}

export interface CreateIngredientInput {
  name: string;
  unit: string;
  category?: string;
  stock_quantity?: number;
  min_stock_quantity?: number;
  cost_per_unit?: number;
  supplier?: string;
  notes?: string;
}

export type UpdateIngredientInput = Partial<CreateIngredientInput> & { is_active?: boolean };

export interface StockAdjustment {
  new_quantity: number;
  notes: string;
}

export interface StockAlert {
  type: 'low_ingredient' | 'low_product' | 'missing_recipe';
  severity: 'warning' | 'critical';
  message: string;
  reference_id: string;
  reference_name: string;
}

export interface InventoryValuation {
  ingredients_value: number;
  products_value: number;
  total_value: number;
}

export interface PurchaseSuggestion {
  ingredient_id: string;
  ingredient_name: string;
  unit: string;
  current_stock: number;
  needed: number;
  to_buy: number;
  estimated_cost: number;
}

// ============================================
// Gastos
// ============================================

export interface ExpenseCategory {
  id: string;
  business_id: string;
  name: string;
  color: string;
  sort_order: number;
  is_active: boolean;
  created_at: string;
}

export interface Expense {
  id: string;
  business_id: string;
  category_id: string | null;
  description: string;
  amount: number;
  expense_date: string;
  supplier: string | null;
  payment_method: PaymentMethod | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
  category?: ExpenseCategory;
}

export interface CreateExpenseInput {
  description: string;
  category_id?: string | null;
  amount: number;
  expense_date: string;
  supplier?: string;
  payment_method?: PaymentMethod;
  notes?: string;
}

export type UpdateExpenseInput = Partial<CreateExpenseInput>;

export interface ExpenseFilters {
  category_id?: string;
  from_date?: string;
  to_date?: string;
  search?: string;
}

// ============================================
// Dashboard
// ============================================

export interface PeriodSummary {
  revenue: number;
  expenses: number;
  production_cost: number;
  profit: number;
  margin_pct: number;
  orders_count: number;
  average_ticket: number;
}

export interface UpcomingDelivery {
  id: string;
  order_number: number;
  delivery_date: string;
  delivery_time: string | null;
  customer_name: string;
  summary: string;
  status: OrderStatus;
  total: number;
}

export interface DashboardAlert {
  kind: 'stock' | 'deposit' | 'delivery';
  severity: 'info' | 'warning' | 'critical';
  message: string;
  href: string;
}

export interface DashboardData {
  today: PeriodSummary & {
    pending_orders: number;
    deliveries_today: number;
  };
  month: PeriodSummary;
  upcoming: UpcomingDelivery[];
  alerts: DashboardAlert[];
  revenue_series: TimeSeriesPoint[];
  top_products: RankedItem[];
}

export interface TimeSeriesPoint {
  date: string;
  /** Etiqueta completa, para el tooltip: "27 sept". */
  label: string;
  /** Etiqueta corta, para el eje: "27". */
  short: string;
  revenue: number;
  expenses?: number;
  orders: number;
}

export interface RankedItem {
  id: string;
  label: string;
  value: number;
  secondary?: number;
}

// ============================================
// Estadísticas
// ============================================

export const STATS_RANGES = [
  'today',
  'last_7',
  'last_30',
  'this_month',
  'last_month',
  'custom',
] as const;
export type StatsRange = (typeof STATS_RANGES)[number];

export const STATS_RANGE_LABELS: Record<StatsRange, string> = {
  today: 'Hoy',
  last_7: 'Últimos 7 días',
  last_30: 'Últimos 30 días',
  this_month: 'Este mes',
  last_month: 'Mes anterior',
  custom: 'Personalizado',
};

export interface StatsData {
  range: { from: string; to: string };
  summary: PeriodSummary;
  previous: PeriodSummary;
  revenue_series: TimeSeriesPoint[];
  orders_by_status: RankedItem[];
  top_products: RankedItem[];
  top_customers: RankedItem[];
  sales_by_category: RankedItem[];
  expenses_by_category: RankedItem[];
}

// ============================================
// Calendario
// ============================================

export interface CalendarOrder {
  id: string;
  order_number: number;
  delivery_date: string;
  delivery_time: string | null;
  customer_name: string;
  status: OrderStatus;
  total: number;
}

// ============================================
// Carrito (tienda pública, client-side)
// ============================================

export interface CartItem {
  id: string;
  type: 'product' | 'package';
  name: string;
  price: number;
  quantity: number;
  image_url: string | null;
  min_advance_hours: number | null;
  sale_unit: string;
}

// ============================================
// Seguimiento público de pedido
// ============================================

export interface OrderTracking {
  order_number: number;
  status: OrderStatus;
  contact_name: string;
  delivery_date: string;
  delivery_method: DeliveryMethod;
  items: { name: string; quantity: number; unit_price: number; subtotal: number }[];
  subtotal: number;
  timeline: { status: string; date: string; notes: string | null }[];
  created_at: string;
}
