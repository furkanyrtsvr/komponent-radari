import type { Store } from "../domain";
import { HttpError, list } from "./db";
import { adapterFor } from "../../stores/registry";
import {readProduct,pricePhase} from './snapshots';
import {snapshotUsable,SNAPSHOT_TTL_MS} from '../catalog-snapshot';
import {LIVE_TTL_MS} from '../pricing';
import { catalogIdentity } from "../catalog-identity";
import { isRetryableStoreError } from "../../stores/base";
import { catalogueSources } from "./live";

export type CatalogPreview = {
  url: string;
  name: string;
  image: string | null;
  key: string;
  price: number | null;
  stockStatus: string;
  checkedAt: string;
  message: string;
  retained?: boolean;
  packageQuantity?:number;
  maxAgeMs?:number;
  sources?:{storeId:string;url:string;name:string}[];
};

const cache = new Map<string, {at:number; value:Promise<CatalogPreview>}>();

export async function previewCatalogProducts(urls: string[], force = false) {
  const phase=await pricePhase();
  const stores = await list<Store>("stores");
  const unique = [...new Set(urls)].slice(0, 12);
  const results = await Promise.allSettled(
    unique.map(async (url): Promise<CatalogPreview> => {
      const parsed = new URL(url);
      const store = stores.find(
        (candidate) =>
          candidate.enabled &&
          candidate.domain.replace(/^www\./, "") ===
            parsed.hostname.replace(/^www\./, ""),
      );
      if (!store || parsed.protocol !== "https:")
        throw new HttpError(400, "Desteklenen mağaza bağlantısı gerekli.");
      const cacheKey=phase+':'+url;
      const cached = cache.get(cacheKey);
      if (!force && cached && Date.now()-cached.at<5*60*1000){const previous=await cached.value;if(!previous.price||snapshotUsable(previous.checkedAt,previous.maxAgeMs||5*60*1000))return previous;}
      const value = (async (): Promise<CatalogPreview> => {
        const adapter = adapterFor(store);
        let product, message = "";
        try { product = await readProduct(store,url,force); }
        catch (error) {
          message = error instanceof Error ? error.message : "Mağaza okunamadı.";
          if(isRetryableStoreError(error) && cached) {
            const previous=await cached.value;
            if(previous.price && Date.now()-Date.parse(previous.checkedAt)<5*60*1000)
              return {...previous,retained:true,message:"Geçici erişim hatası; son 5 dakika içinde doğrulanan fiyat gösteriliyor."};
          }
          if (adapter.getCatalogProduct) { try { product = await adapter.getCatalogProduct(url); } catch { /* Return an explicit unreadable source. */ } }
        }
        const verified = product?.price && product.currency === "TRY" && product.vatIncluded === true && product.quantityVerified === true;
        return {url, name:product?.name || "", key:product ? catalogIdentity(product) : "",
          image:product?.image?.startsWith("https://") ? product.image : null,
          price:verified ? product!.price : null, stockStatus:product?.stockStatus || "unknown",
          checkedAt:product?.checkedAt || new Date().toISOString(), packageQuantity:product?.packageQuantity || 1,
          maxAgeMs:product?.readMethod==='snapshot'?(phase==='B'?SNAPSHOT_TTL_MS:LIVE_TTL_MS):5*60*1000,
          sources:product ? catalogueSources(product) : [],
          message:verified ? product?.readMethod==='snapshot'?'Kayıtlı fiyat; son kontrol: '+product.checkedAt:'' : message || "Fiyat ve satış birimi doğrulanamadı."};
      })();
      if (cache.size>=400) cache.delete(cache.keys().next().value!);
      cache.set(cacheKey,{at:Date.now(),value});
      const preview = await value;
      const entry = cache.get(cacheKey);
      // Retrying a failed read must not extend the age of the verified price.
      if (preview.retained && entry?.value === value)
        entry.at = Date.parse(preview.checkedAt);
      return preview;
    }),
  );
  return results.flatMap((result) =>
    result.status === "fulfilled" ? [result.value] : [],
  );
}
