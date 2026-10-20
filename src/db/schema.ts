import {
  sqliteTable,
  text,
  integer,
  real,
  index,
  uniqueIndex,
} from "drizzle-orm/sqlite-core";
const pk = () => text("id").primaryKey();
export const catalogCollectionRuns=sqliteTable('catalog_collection_runs',{
 id:pk(),updated_at:text().notNull(),payload:text().notNull(),
});
export const catalogSnapshots=sqliteTable('catalog_snapshots',{
 id:pk(),store_id:text().notNull(),url:text().notNull(),checked_at:text().notNull(),payload:text().notNull(),
},t=>[uniqueIndex('snapshot_store_url').on(t.store_id,t.url),index('snapshot_checked').on(t.checked_at)]);
export const users = sqliteTable("users", {
  id: pk(),
  display_name: text().notNull(),
  email: text().notNull().default(""),
  created_at: text().notNull(),
});
export const sessions = sqliteTable(
  "sessions",
  {
    id: pk(),
    user_id: text()
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    expires_at: text().notNull(),
  },
  (t) => [index("sessions_user").on(t.user_id)],
);
export const stores = sqliteTable("stores", {
  id: pk(),
  name: text().notNull(),
  domain: text().notNull(),
  color: text().notNull(),
  enabled: integer().notNull().default(1),
  adapter_type: text().notNull(),
  supports_search: integer().notNull(),
  supports_live_price: integer().notNull(),
  supports_stock: integer().notNull(),
  shipping_base_price: integer().notNull(),
  free_shipping_threshold: integer(),
  price_includes_vat: integer().notNull(),
  last_successful_sync: text(),
  status: text().notNull(),
});
export const storeShippingRules = sqliteTable("store_shipping_rules", {
  id: pk(),
  store_id: text()
    .notNull()
    .references(() => stores.id),
  rules: text().notNull(),
  estimated: integer().notNull().default(1),
  source_url: text(),
  last_updated: text().notNull(),
});
export const canonicalProducts = sqliteTable(
  "canonical_products",
  {
    id: pk(),
    name: text().notNull(),
    category: text().notNull(),
    manufacturer: text().notNull(),
    mpn: text().notNull(),
    model: text().notNull(),
    description: text().notNull(),
    image: text(),
    specifications: text().notNull(),
    unit_type: text().notNull(),
    package_quantity: integer().notNull(),
    created_at: text().notNull(),
  },
  (t) => [
    index("products_mpn").on(t.mpn),
    index("products_category").on(t.category),
  ],
);
export const productSpecs = sqliteTable("product_specs", {
  id: pk(),
  canonical_product_id: text()
    .notNull()
    .references(() => canonicalProducts.id),
  name: text().notNull(),
  value: text().notNull(),
  unit: text(),
});
export const storeProducts = sqliteTable(
  "store_products",
  {
    id: pk(),
    store_id: text()
      .notNull()
      .references(() => stores.id),
    url: text().notNull(),
    title: text().notNull(),
    mpn: text(),
    raw_data: text().notNull(),
  },
  (t) => [
    index("store_products_store").on(t.store_id),
    uniqueIndex("store_product_url").on(t.store_id, t.url),
  ],
);
export const storeOffers = sqliteTable(
  "store_offers",
  {
    id: pk(),
    canonical_product_id: text()
      .notNull()
      .references(() => canonicalProducts.id),
    store_id: text()
      .notNull()
      .references(() => stores.id),
    store_product_id: text()
      .notNull()
      .references(() => storeProducts.id),
    title: text().notNull(),
    product_url: text().notNull(),
    image_url: text(),
    manufacturer: text().notNull(),
    mpn: text().notNull(),
    price_net: integer().notNull(),
    vat_rate: real(),
    price_gross: integer().notNull(),
    package_quantity: integer().notNull(),
    unit_price: integer().notNull(),
    currency: text().notNull(),
    vat_included: integer().notNull(),
    stock_status: text().notNull(),
    stock_quantity: integer(),
    match_confidence: integer().notNull(),
    match_type: text().notNull(),
    last_checked_at: text().notNull(),
    source: text().notNull(),
    minimum_order_quantity: integer().notNull().default(1),
    order_step: integer().notNull().default(1),
    price_tiers: text().notNull().default("[]"),
    last_error: text(),
  },
  (t) => [
    index("offers_product").on(t.canonical_product_id),
    index("offers_store").on(t.store_id),
  ],
);
export const priceHistory = sqliteTable(
  "price_history",
  {
    id: pk(),
    offer_id: text()
      .notNull()
      .references(() => storeOffers.id),
    price_gross: integer().notNull(),
    stock_status: text().notNull(),
    checked_at: text().notNull(),
  },
  (t) => [index("history_offer_time").on(t.offer_id, t.checked_at)],
);
export const carts = sqliteTable(
  "carts",
  {
    id: pk(),
    owner_id: text()
      .notNull()
      .references(() => users.id),
    name: text().notNull(),
    created_at: text().notNull(),
    updated_at: text().notNull(),
    data_source: text().notNull().default("demo"),
  },
  (t) => [index("carts_owner").on(t.owner_id)],
);
export const cartItems = sqliteTable(
  "cart_items",
  {
    id: pk(),
    cart_id: text()
      .notNull()
      .references(() => carts.id, { onDelete: "cascade" }),
    canonical_product_id: text()
      .notNull()
      .references(() => canonicalProducts.id),
    quantity: integer().notNull(),
    added_by: text()
      .notNull()
      .references(() => users.id),
    notes: text().notNull().default(""),
    allow_alternative: integer().notNull().default(0),
    preferred_manufacturer: text().notNull().default(""),
    maximum_unit_price: integer(),
    created_at: text().notNull(),
  },
  (t) => [index("cart_items_cart").on(t.cart_id)],
);
export const cartMembers = sqliteTable(
  "cart_members",
  {
    id: pk(),
    cart_id: text()
      .notNull()
      .references(() => carts.id, { onDelete: "cascade" }),
    user_id: text()
      .notNull()
      .references(() => users.id),
    role: text().notNull(),
  },
  (t) => [
    uniqueIndex("cart_members_unique").on(t.cart_id, t.user_id),
    index("cart_members_user").on(t.user_id),
  ],
);
export const cartShares = sqliteTable(
  "cart_shares",
  {
    id: pk(),
    cart_id: text()
      .notNull()
      .references(() => carts.id, { onDelete: "cascade" }),
    role: text().notNull(),
    created_at: text().notNull(),
    expires_at: text().notNull(),
  },
  (t) => [index("shares_cart").on(t.cart_id)],
);
export const cartSnapshots = sqliteTable(
  "cart_snapshots",
  {
    id: pk(),
    cart_id: text()
      .notNull()
      .references(() => carts.id, { onDelete: "cascade" }),
    created_at: text().notNull(),
    total: integer().notNull(),
    payload: text().notNull(),
  },
  (t) => [index("snapshots_cart").on(t.cart_id)],
);
export const savedOptimizations = sqliteTable("saved_optimizations", {
  id: pk(),
  cart_id: text()
    .notNull()
    .references(() => carts.id, { onDelete: "cascade" }),
  created_at: text().notNull(),
  payload: text().notNull(),
});
export const favorites = sqliteTable(
  "favorites",
  {
    id: pk(),
    user_id: text()
      .notNull()
      .references(() => users.id),
    canonical_product_id: text()
      .notNull()
      .references(() => canonicalProducts.id),
  },
  (t) => [
    uniqueIndex("favorite_user_product").on(t.user_id, t.canonical_product_id),
  ],
);
export const priceAlerts = sqliteTable("price_alerts", {
  id: pk(),
  user_id: text()
    .notNull()
    .references(() => users.id),
  canonical_product_id: text()
    .notNull()
    .references(() => canonicalProducts.id),
  target_price: integer().notNull(),
  enabled: integer().notNull().default(1),
  created_at: text().notNull(),
});
export const stockAlerts = sqliteTable("stock_alerts", {
  id: pk(),
  user_id: text()
    .notNull()
    .references(() => users.id),
  canonical_product_id: text()
    .notNull()
    .references(() => canonicalProducts.id),
  enabled: integer().notNull().default(1),
  created_at: text().notNull(),
});
export const productMatchCandidates = sqliteTable("product_match_candidates", {
  id: pk(),
  store_product_id: text()
    .notNull()
    .references(() => storeProducts.id),
  canonical_product_id: text()
    .notNull()
    .references(() => canonicalProducts.id),
  confidence: integer().notNull(),
  reason: text().notNull(),
  status: text().notNull(),
});
export const scrapeJobs = sqliteTable("scrape_jobs", {
  id: pk(),
  store_id: text()
    .notNull()
    .references(() => stores.id),
  url: text().notNull(),
  status: text().notNull(),
  error: text(),
  created_at: text().notNull(),
  finished_at: text(),
});
export const storeHealth = sqliteTable(
  "store_health",
  {
    id: pk(),
    store_id: text()
      .notNull()
      .references(() => stores.id),
    success: integer().notNull(),
    message: text().notNull(),
    checked_at: text().notNull(),
  },
  (t) => [index("health_store").on(t.store_id)],
);
export const rateLimits = sqliteTable("rate_limits", {
  id: pk(),
  count: integer().notNull(),
  expires_at: integer().notNull(),
});
export const cartShippingSettings=sqliteTable("cart_shipping_settings",{
  id:pk(),
  cart_id:text().notNull().references(()=>carts.id,{onDelete:"cascade"}),
  store_id:text().notNull().references(()=>stores.id),
  shipping_price:integer().notNull(),
  free_shipping_threshold:integer(),
  updated_at:text().notNull(),
},t=>[uniqueIndex("cart_shipping_unique").on(t.cart_id,t.store_id)]);
export const cartOfferSelections=sqliteTable('cart_offer_selections',{
  id:pk(),
  cart_id:text().notNull().references(()=>carts.id,{onDelete:'cascade'}),
  canonical_product_id:text().notNull().references(()=>canonicalProducts.id),
  offer_id:text().notNull().references(()=>storeOffers.id,{onDelete:'cascade'}),
  excluded:integer().notNull().default(0),
  updated_at:text().notNull(),
},t=>[uniqueIndex('cart_offer_selection_unique').on(t.cart_id,t.canonical_product_id,t.offer_id)]);
