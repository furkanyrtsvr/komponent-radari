export type Product = {
  id: string;
  name: string;
  category: string;
  manufacturer: string;
  mpn: string;
  model: string;
  description: string;
  image: string | null;
  specifications: string;
  unit_type: string;
  package_quantity: number;
  created_at: string;
};
export type Store = {
  id: string;
  name: string;
  domain: string;
  color: string;
  enabled: number;
  adapter_type: string;
  supports_search: number;
  supports_live_price: number;
  supports_stock: number;
  shipping_base_price: number;
  free_shipping_threshold: number | null;
  price_includes_vat: number;
  last_successful_sync: string | null;
  status: string;
  shipping_known?: boolean;
  shipping_source_url?: string | null;
  shipping_manual?: boolean;
  shipping_default?: boolean;
};
export type Offer = {
  /** Scoped merchant metadata, loaded for matching; not a store_offers column. */
  specifications?:string;
  snapshot_max_age_ms?:number;
  id: string;
  canonical_product_id: string;
  store_id: string;
  store_product_id: string;
  title: string;
  product_url: string;
  image_url: string | null;
  manufacturer: string;
  mpn: string;
  price_net: number;
  vat_rate: number | null;
  price_gross: number;
  package_quantity: number;
  unit_price: number;
  currency: string;
  vat_included: number;
  stock_status: string;
  stock_quantity: number | null;
  match_confidence: number;
  match_type: string;
  last_checked_at: string;
  source: string;
  minimum_order_quantity?: number;
  order_step?: number;
  price_tiers?: string;
  last_error?: string | null;
  original_offer_id?: string;
  name_match?: number;
  variant_conflict?: string;
  excluded?: number;
};
export type CartItem = {
  id: string;
  cart_id: string;
  canonical_product_id: string;
  quantity: number;
  added_by: string;
  notes: string;
  allow_alternative: number;
  preferred_manufacturer: string;
  maximum_unit_price: number | null;
  created_at: string;
};
export type Cart = {
  id: string;
  owner_id: string;
  name: string;
  created_at: string;
  updated_at: string;
  data_source?: string;
};
export type CartView = Cart & {
  items: CartItem[];
  role: string;
  members: { user_id: string; role: string; label: string }[];
  snapshots: {
    id: string;
    created_at: string;
    total: number;
    payload: string;
  }[];
  shippingSettings?: import("./cart-shipping").ShippingSetting[];
  offerSelections?: import("./cart-offers").OfferSelection[];
};
export type Allocation = {
  itemId: string;
  productId: string;
  offerId: string;
  storeId: string;
  quantity: number;
  packages: number;
  purchasedQuantity: number;
  total: number;
  addedBy: string;
};
export type Scenario = {
  maxStores: number;
  storeCount: number;
  productTotal: number;
  shippingTotal: number;
  total: number;
  groups: {
    storeId: string;
    subtotal: number;
    shipping: number;
    freeShipping: boolean;
    lines: Allocation[];
  }[];
  savings: number;
};
export type Optimization = {
  eligibleOffers?: Offer[];
  eligibleStoreIds?: string[];
  comparedStoreIds?: string[];
  comparison?: {
    productId: string;
    itemIds: string[];
    quantity: number;
    cells: { storeId: string; offer?: Offer; cost?: number; purchasedQuantity?: number; reason?: string }[];
  }[];
  shippingEstimated?: boolean;
  shippingAssumption?: number | null;
  scenarios: Scenario[];
  exactScenarios?: Scenario[];
  refreshSummary?: {checked:number;cached:number;failed:number;retained:number;message:string};
  missing: string[];
  optimal: boolean;
  nodes: number;
  recommendedMax: number;
  generatedAt: string;
  source: string;
  reason?: string;
};
export const money = (cents: number) =>
  new Intl.NumberFormat("tr-TR", {
    style: "currency",
    currency: "TRY",
    maximumFractionDigits: 2,
  }).format(cents / 100);
export const now = () => new Date().toISOString();
export const id = () => crypto.randomUUID();
export const normalize = (s: string) =>
  s
    .toLocaleLowerCase("tr-TR")
    .replace(/ı/g, "i")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]/g, "");
// Preserve decimal points and electrical suffixes: AMS1117-3.3 must not equal AMS1117-33.
export const normalizeMpn = (s: string) =>
  s.toUpperCase().replace(/[\s-]/g, "");
export function normalizePrice(
  price: number,
  vatRate: number,
  included: boolean,
) {
  if (!Number.isFinite(price) || price < 0 || vatRate < 0)
    throw new Error("Geçersiz fiyat");
  const gross = Math.round(price * (included ? 1 : 1 + vatRate));
  const net = included ? Math.round(gross / (1 + vatRate)) : Math.round(price);
  return { net, gross, vat: gross - net };
}
export function matchProduct(
  a: Pick<
    Product,
    "mpn" | "manufacturer" | "model" | "name" | "specifications"
  >,
  b: {
    mpn?: string;
    manufacturer?: string;
    model?: string;
    name: string;
    specifications?: string;
  },
) {
  if (a.mpn && b.mpn) {
    if (normalizeMpn(a.mpn) !== normalizeMpn(b.mpn))
      return { confidence: 0, type: "different", reason: "MPN farklı" };
    if (
      a.manufacturer &&
      b.manufacturer &&
      normalize(a.manufacturer) !== normalize(b.manufacturer)
    )
      return { confidence: 50, type: "alternative", reason: "Üretici farklı" };
    return { confidence: 100, type: "exact", reason: "Birebir MPN" };
  }
  if (a.model && b.model && normalize(a.model) !== normalize(b.model))
    return { confidence: 0, type: "different", reason: "Model farklı" };
  if (
    a.model &&
    b.model &&
    normalize(a.model) === normalize(b.model) &&
    a.manufacturer &&
    b.manufacturer &&
    normalize(a.manufacturer) === normalize(b.manufacturer)
  )
    return { confidence: 95, type: "verified", reason: "Üretici + model" };
  if (
    a.specifications &&
    b.specifications &&
    a.specifications !== "{}" &&
    a.specifications === b.specifications
  )
    return {
      confidence: 85,
      type: "candidate",
      reason: "Teknik özellikler; inceleme gerekli",
    };
  const x = normalize(a.name),
    y = normalize(b.name);
  return {
    confidence: x === y ? 70 : x.includes(y) || y.includes(x) ? 55 : 30,
    type: "candidate",
    reason: "Başlık benzerliği; onay gerekli",
  };
}
export function mergeItems(lists: CartItem[][], cartId: string): CartItem[] {
  const merged = new Map<string, CartItem>();
  for (const item of lists.flat()) {
    const key = [
      item.canonical_product_id,
      item.added_by,
      item.allow_alternative,
      item.preferred_manufacturer,
      item.maximum_unit_price,
      item.notes,
    ].join("|");
    const prev = merged.get(key);
    if (prev) prev.quantity += item.quantity;
    else merged.set(key, { ...item, id: id(), cart_id: cartId });
  }
  return [...merged.values()];
}
