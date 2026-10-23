import type { Store } from "../lib/domain";
import type { PriceTier } from "../lib/pricing";
export type ExtractedProduct = {
  unitType?:import('../lib/sales-unit').SalesUnit;
  checkedAt?:string;
  readMethod?:'snapshot';
  readWarning?:string;
  url: string;
  name: string;
  mpn: string;
  manufacturer: string;
  model: string;
  image: string | null;
  price: number | null;
  currency: string;
  vatIncluded: boolean | null;
  vatRate: number | null;
  packageQuantity: number | null;
  stockStatus: string;
  stockQuantity: number | null;
  specifications: string;
  warnings: string[];
  priceNet?: number | null;
  minimumOrderQuantity?: number;
  orderStep?: number;
  priceTiers?: PriceTier[];
  quantityVerified?: boolean;
};
export interface StoreAdapter {
  storeId: string;
  searchProducts(query: string): Promise<ExtractedProduct[]>;
  getProduct(url: string): Promise<ExtractedProduct>;
  getCatalogProduct?(url: string): Promise<ExtractedProduct>;
  getPrice(product: ExtractedProduct): number | null;
  getStock(product: ExtractedProduct): string;
  getShippingRules(): Promise<{
    estimated: boolean;
    available: boolean;
    freeShippingThreshold?: number | null;
    sourceUrl?: string;
  }>;
  normalizeProduct(product: ExtractedProduct): ExtractedProduct;
  normalizePrice(value: unknown): number | null;
}
export type StoreConfig = Pick<Store, "id" | "domain"> & {requestSignal?:AbortSignal};
