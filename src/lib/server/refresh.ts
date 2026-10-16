import { syncLive } from "./live";
import { dataSource } from "./mode";
import type { Store, Offer, Product } from "../domain";
import { id, now, matchProduct } from "../domain";
import { list, one, insert, update, HttpError } from "./db";
import { adapterFor } from "../../stores/registry";
import {readProduct} from './snapshots';
export async function importUrl(url: string, productId?: string) {
  const parsed = new URL(url);
  const stores = await list<Store>("stores");
  const store = stores.find(
    (s) =>
      s.domain.replace(/^www\./, "") === parsed.hostname.replace(/^www\./, ""),
  );
  if (!store)
    throw new HttpError(
      400,
      "Bu mağaza desteklenmiyor. Manuel ihtiyaç ekleyin.",
    );
  const job = id();
  await insert("scrape_jobs", {
    id: job,
    store_id: store.id,
    url,
    status: "running",
    error: null,
    created_at: now(),
    finished_at: null,
  });
  try {
    const product = await readProduct(store,url);
    const sp = id();
    const existing = await one<{ id: string }>("store_products", {
      store_id: store.id,
      url: product.url,
    });
    const spId = existing?.id || sp;
    if (!existing)
      await insert("store_products", {
        id: spId,
        store_id: store.id,
        url: product.url,
        title: product.name,
        mpn: product.mpn,
        raw_data: JSON.stringify(product),
      });
    const candidates = productId
      ? [await one<Product>("canonical_products", { id: productId })]
      : await list<Product>("canonical_products");
    const matches = candidates
      .filter((p): p is Product => Boolean(p))
      .map((p) => ({ productId: p.id, ...matchProduct(p, product) }))
      .filter((m) => m.confidence >= 50)
      .sort((a, b) => b.confidence - a.confidence)
      .slice(0, 5);
    for (const match of matches)
      await insert("product_match_candidates", {
        id: id(),
        store_product_id: spId,
        canonical_product_id: match.productId,
        confidence: match.confidence,
        reason: match.reason,
        status: "pending",
      });
    await insert("store_health", {
      id: id(),
      store_id: store.id,
      success: 1,
      message: "JSON-LD okundu; fiyat/paket/KDV incelemesi gerekiyor.",
      checked_at: now(),
    });
    await update(
      "stores",
      { last_successful_sync: now(), status: "manual_review" },
      { id: store.id },
    );
    await update(
      "scrape_jobs",
      { status: "needs_review", finished_at: now() },
      { id: job },
    );
    return {
      store: store.name,
      product,
      matches,
      status: "needs_review",
      message:
        "Ürün bilgileri okundu. Fiyat, KDV, paket ve eşleşme yönetici tarafından doğrulanmadan optimizasyona alınmaz.",
    };
  } catch (e) {
    const message = e instanceof Error ? e.message : "Veri alınamadı";
    await update(
      "scrape_jobs",
      { status: "failed", error: message, finished_at: now() },
      { id: job },
    );
    await insert("store_health", {
      id: id(),
      store_id: store.id,
      success: 0,
      message,
      checked_at: now(),
    });
    return { store: store.name, status: "unavailable", message };
  }
}
export async function refreshOffers(productIds: string[], force = true) {
  if ((await dataSource()) === "demo")
    return {
      demo: true,
      checked: 0,
      total: 0,
      results: [],
      message:
        "Demo fiyatları örnektir. Canlı fiyatlar düğmesiyle gerçek mağaza verilerine geçebilirsiniz.",
    };
  return syncLive(productIds, force);
}
