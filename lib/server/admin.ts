import { z } from "zod";
import {
  id,
  now,
  normalizePrice,
  normalizeMpn,
  type Product,
  type Offer,
  type Store,
  type CartItem,
} from "../domain";
import {
  one,
  list,
  insert,
  insertBatch,
  update,
  remove,
  HttpError,
} from "./db";
import { safeStoreUrl } from "../../stores/base";
import type { ExtractedProduct } from "../../stores/types";
import type {OfferSelection} from '../cart-offers';
export const approvalSchema = z.object({
  storeProductId: z.string().min(1),
  productId: z.string().min(1),
  packageQuantity: z.number().int().min(1).max(100000),
  price: z.number().int().min(0).max(100000000),
  vatRate: z.number().min(0).max(1),
  vatIncluded: z.boolean(),
  stockQuantity: z.number().int().min(0).nullable(),
  stockStatus: z.enum(["in_stock", "out_of_stock", "unknown"]),
  matchType: z.enum(["exact", "verified", "alternative"]),
  confidence: z.number().int().min(70).max(100),
});
export async function approveOffer(input: unknown) {
  const v = approvalSchema.parse(input);
  const sp = await one<{
    id: string;
    store_id: string;
    url: string;
    title: string;
    mpn: string;
    raw_data: string;
  }>("store_products", { id: v.storeProductId });
  const product = await one<Product>("canonical_products", { id: v.productId });
  if (!sp || !product) throw new HttpError(404, "Ürün kaydı bulunamadı.");
  const raw = JSON.parse(sp.raw_data) as ExtractedProduct;
  if (raw.currency !== "TRY")
    throw new HttpError(
      400,
      "Bu sürüm yalnızca TRY fiyatlarını karşılaştırır.",
    );
  const store = await one<Store>("stores", { id: sp.store_id });
  safeStoreUrl(sp.url, store!.domain);
  if (v.matchType === "exact" && v.confidence !== 100)
    throw new HttpError(400, "Birebir eşleşme güveni 100 olmalı.");
  const amount = normalizePrice(v.price, v.vatRate, v.vatIncluded);
  const existing = await one<Offer>("store_offers", {
    store_product_id: sp.id,
    source: "live",
  });
  const offer: Offer = {
    id: existing?.id || id(),
    canonical_product_id: product.id,
    store_id: sp.store_id,
    store_product_id: sp.id,
    title: sp.title,
    product_url: sp.url,
    image_url: raw.image,
    manufacturer: product.manufacturer,
    mpn: product.mpn,
    price_net: amount.net,
    vat_rate: v.vatRate,
    price_gross: amount.gross,
    package_quantity: v.packageQuantity,
    unit_price: Math.round(amount.gross / v.packageQuantity),
    currency: "TRY",
    vat_included: Number(v.vatIncluded),
    stock_status: v.stockStatus,
    stock_quantity: v.stockQuantity,
    match_confidence: v.confidence,
    match_type: v.matchType,
    last_checked_at: now(),
    source: "live",
  };
  if (existing) await update("store_offers", offer, { id: existing.id });
  else await insert("store_offers", offer);
  await insert("price_history", {
    id: id(),
    offer_id: offer.id,
    price_gross: offer.price_gross,
    stock_status: offer.stock_status,
    checked_at: now(),
  });
  await update(
    "product_match_candidates",
    { status: "approved" },
    { store_product_id: sp.id, canonical_product_id: product.id },
  );
  return offer;
}
export async function reviewQueue() {
  const [storeProducts, candidates] = await Promise.all([
    list<{
      id: string;
      store_id: string;
      title: string;
      url: string;
      raw_data: string;
    }>("store_products"),
    list("product_match_candidates", { status: "pending" }),
  ]);
  return {
    storeProducts: storeProducts
      .filter((p) => !p.id.startsWith("demo-"))
      .map((p) => ({ ...p, extracted: JSON.parse(p.raw_data) })),
    candidates,
  };
}
export async function mergeCanonical(sourceId: string, targetId: string) {
  if (sourceId === targetId) throw new HttpError(400, "İki farklı ürün seçin.");
  const [source, target] = await Promise.all([
    one<Product>("canonical_products", { id: sourceId }),
    one<Product>("canonical_products", { id: targetId }),
  ]);
  if (!source || !target) throw new HttpError(404, "Ürün bulunamadı.");
  if (source.mpn && target.mpn && normalizeMpn(source.mpn) !== normalizeMpn(target.mpn))
    throw new HttpError(
      400,
      "Farklı MPN’ler birleştirilemez. Yanlış teklifi ayrı eşleştirin.",
    );
  for (const table of [
    "store_offers",
    "price_alerts",
    "stock_alerts",
    "product_match_candidates",
    "product_specs",
  ])
    await update(
      table,
      { canonical_product_id: targetId },
      { canonical_product_id: sourceId },
    );
  const sourceItems = await list<CartItem>("cart_items", {canonical_product_id:sourceId});
  for(const selection of await list<OfferSelection>('cart_offer_selections',{canonical_product_id:sourceId})){
    const targetSelection=await one<OfferSelection>('cart_offer_selections',{cart_id:selection.cart_id,canonical_product_id:targetId,offer_id:selection.offer_id});
    if(targetSelection){
      if(selection.updated_at>targetSelection.updated_at)await update('cart_offer_selections',{excluded:selection.excluded,updated_at:selection.updated_at},{id:targetSelection.id});
      await remove('cart_offer_selections',{id:selection.id});
    }else await update('cart_offer_selections',{canonical_product_id:targetId},{id:selection.id});
  }
  for (const item of sourceItems) {
    const targets = await list<CartItem>("cart_items", {cart_id:item.cart_id,canonical_product_id:targetId});
    const same = targets.find(target => target.added_by === item.added_by && target.notes === item.notes && target.allow_alternative === item.allow_alternative && target.preferred_manufacturer === item.preferred_manufacturer && target.maximum_unit_price === item.maximum_unit_price);
    if (same) {
      await update("cart_items", {quantity:same.quantity+item.quantity}, {id:same.id});
      await remove("cart_items", {id:item.id});
    } else await update("cart_items", {canonical_product_id:targetId}, {id:item.id});
  }
  const favorites = await list<{ id: string; user_id: string }>("favorites", {
    canonical_product_id: sourceId,
  });
  for (const f of favorites) {
    if (
      await one("favorites", {
        user_id: f.user_id,
        canonical_product_id: targetId,
      })
    )
      await remove("favorites", { id: f.id });
    else
      await update(
        "favorites",
        { canonical_product_id: targetId },
        { id: f.id },
      );
  }
  await remove("canonical_products", { id: sourceId });
  return { ok: true };
}
