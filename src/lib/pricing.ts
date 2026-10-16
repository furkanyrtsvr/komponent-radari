import type { Offer } from "./domain";

export const LIVE_TTL_MS = 20 * 60 * 1000;
/** A historical observation keeps its original date and never implies a new stock check. */
export function hasObservedPrice(offer: Offer, at = Date.now()) {
  const observed=Date.parse(offer.last_checked_at);
  return !offer.last_error && !offer.excluded && !offer.variant_conflict && offer.currency==='TRY' && offer.vat_included===1 && Number.isSafeInteger(offer.price_gross) && offer.price_gross>0 && Number.isFinite(observed) && observed<=at;
}
export type PriceTier = {
  minimum: number;
  maximum: number | null;
  price: number;
  netUnitPriceMicros?:number;
  vatBasisPoints?:number;
  rounding?:"net-subtotal";
};
export function quoteOffer(offer: Offer, requested: number) {
  const pack = Math.max(1, offer.package_quantity);
  const step = Math.max(1, offer.order_step || pack);
  function gcd(a: number, b: number): number {
    return b ? gcd(b, a % b) : a;
  }
  const multiple = (pack * step) / gcd(pack, step);
  const purchasedQuantity =
    Math.ceil(
      Math.max(requested, offer.minimum_order_quantity || pack) / multiple,
    ) * multiple;
  const packages = purchasedQuantity / pack;
  let price = offer.price_gross;
  let precise:PriceTier|undefined;
  try {
    const tiers: PriceTier[] = JSON.parse(offer.price_tiers || "[]");
    for (const tier of tiers)
      if (
        Number.isSafeInteger(tier.price) &&
        tier.price > 0 &&
        purchasedQuantity >= tier.minimum &&
        (tier.maximum === null || purchasedQuantity <= tier.maximum)
      )
        {price = tier.price; precise=tier;}
  } catch {
    /* Retain the validated base price when optional tiers are invalid. */
  }
  let cost=packages*price;
  if(precise?.rounding==="net-subtotal" && Number.isSafeInteger(precise.netUnitPriceMicros) && precise.netUnitPriceMicros!>0 && Number.isSafeInteger(precise.vatBasisPoints) && precise.vatBasisPoints!>=0 && precise.vatBasisPoints!<=10000) {
    const raw=precise.netUnitPriceMicros!*packages;
    if(!Number.isSafeInteger(raw)) cost=Infinity;
    else {
      const netCents=Math.floor((raw+5000)/10000);
      const taxed=netCents*(10000+precise.vatBasisPoints!);
      cost=Number.isSafeInteger(taxed)?Math.floor((taxed+5000)/10000):Infinity;
    }
  }
  return { packages, purchasedQuantity, cost };
}
export function isFresh(offer: Offer, at = Date.now()) {
  const age=at-Date.parse(offer.last_checked_at);
  return (
    offer.source === "demo" ||
    (!offer.last_error && age>=0 && age < (offer.snapshot_max_age_ms===12*60*60*1000?offer.snapshot_max_age_ms:LIVE_TTL_MS))
  );
}
