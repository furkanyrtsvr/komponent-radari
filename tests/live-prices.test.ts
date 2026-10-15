import test from "node:test";
import { parseRobizProduct } from "../stores/robiz";
import assert from "node:assert/strict";
import { parseTsoftProduct } from "../stores/tsoft";
import { parseMotorobitProduct } from "../stores/motorobit";
import { quoteOffer, isFresh, LIVE_TTL_MS } from "../lib/pricing";
import { optimize } from "../lib/optimizer";
import { demoOffers, storeCatalog } from "../lib/catalog";
import type { CartItem } from "../lib/domain";
import { parseBomRows } from "../lib/bom";
import { products } from "../lib/catalog";
import { robotsAllowed } from "../stores/base";
const resistor = {
  ...demoOffers[0],
  canonical_product_id: "res",
  price_gross: 24,
  package_quantity: 1,
  minimum_order_quantity: 50,
  order_step: 50,
  stock_quantity: null,
};

test("Robiz XR2206 has a verified payable price and one-kit minimum", () => {
  const html = `<html><script type="application/ld+json">${JSON.stringify({
    "@type": "Product", name: "XR2206 Sinyal Jeneratör DIY Kit",
    brand: { name: "OEM" }, model: "XR2206 Modül",
    offers: { price: "411.60", priceCurrency: "TRY", availability: "https://schema.org/InStock" },
  })}</script><body>KDV dahil <h1>XR2206 Sinyal Jeneratör DIY Kit</h1><div class="product-price">411,60TL</div><input id="product-quantity" data-minimum="1"></body></html>`;
  const p = parseRobizProduct(html, "https://robiz.net/xr2206");
  assert.equal(p.price, 41160);
  assert.equal(p.packageQuantity, 1);
  assert.equal(p.quantityVerified, true);
  assert.equal(parseRobizProduct(html.replace("411,60TL", "499,00TL"), "https://robiz.net/xr2206").quantityVerified, undefined);
});
test("BOM does not silently pick a manufacturer when the MPN is ambiguous", () => {
  const p = products[0],
    parts = [p, { ...p, id: "other", manufacturer: "Other" }];
  assert.equal(
    parseBomRows([{ MPN: p.mpn, Quantity: 1 }], parts).unmatched.length,
    1,
  );
  assert.equal(
    parseBomRows([{ MPN: p.mpn, Manufacturer: "Other", Quantity: 1 }], parts)
      .items[0].productId,
    "other",
  );
});
test("robots groups with multiple agents preserve wildcard restrictions", () => {
  assert.equal(
    robotsAllowed(
      "User-agent: *\nUser-agent: Googlebot\nDisallow: /private",
      "/private/a",
    ),
    false,
  );
  assert.equal(
    robotsAllowed(
      "User-agent: *\nDisallow: /\nUser-agent: EUB-PriceComparison\nAllow: /products\nDisallow: /",
      "/products/x",
    ),
    true,
  );
});
const item = (quantity: number): CartItem => ({
  id: "i",
  cart_id: "c",
  canonical_product_id: "res",
  quantity,
  added_by: "u",
  notes: "",
  allow_alternative: 0,
  preferred_manufacturer: "",
  maximum_unit_price: null,
  created_at: "",
});
function fixture(
  jsonPrice: number,
  gross: string,
  net: string,
  min = 1,
  step = 1,
) {
  return `<div id="product-right"><script type="application/ld+json">${JSON.stringify({ "@type": "Product", name: "1/4 W 1K Direnç Paketi", offers: { price: jsonPrice, priceCurrency: "TRY", availability: "https://schema.org/InStock" } })}</script><h1>1/4 W 1K Direnç Paketi</h1><span data-toggle="price-sell-vat">${gross}</span><span data-toggle="price-sell">${net}</span><p>KDV Dahil</p><input id="product-count-1" min="${min}" step="${step}"></div>`;
}
test("live pricing purchases the minimum quantity, not just one resistor", () => {
  assert.deepEqual(quoteOffer(resistor, 1), {
    packages: 50,
    purchasedQuantity: 50,
    cost: 1200,
  });
  assert.equal(quoteOffer(resistor, 51).purchasedQuantity, 100);
});
test("minimum is distinct from increment: Direnc allows 51 after a minimum of 50", () =>
  assert.equal(
    quoteOffer({ ...resistor, order_step: 1 }, 51).purchasedQuantity,
    51,
  ));
test("verified quantity tier prices apply only in their explicit range", () => {
  const o = {
    ...resistor,
    price_tiers: JSON.stringify([{ minimum: 100, maximum: 999, price: 22 }]),
  };
  assert.equal(quoteOffer(o, 50).cost, 1200);
  assert.equal(quoteOffer(o, 100).cost, 2200);
  assert.equal(quoteOffer(o, 1000).cost, 24000);
});
test("minimum quantity can change which merchant is cheapest", () => {
  const a = { ...resistor, store_id: "a" },
    b = {
      ...resistor,
      id: "b",
      store_id: "b",
      price_gross: 60,
      minimum_order_quantity: 1,
      order_step: 1,
    };
  const stores = ["a", "b"].map((id) => ({
    ...storeCatalog[0],
    id,
    shipping_base_price: 0,
  }));
  const r = optimize([item(5)], [a, b], stores);
  assert.equal(r.scenarios.at(-1)?.total, 300);
  assert.equal(r.scenarios.at(-1)?.groups[0].storeId, "b");
});
test("live offers expire after 20 minutes and failed checks are excluded", () => {
  const at = Date.now(),
    o = {
      ...resistor,
      source: "live",
      last_checked_at: new Date(at).toISOString(),
    };
  assert.equal(isFresh(o, at + LIVE_TTL_MS - 1), true);
  assert.equal(isFresh(o, at + LIVE_TTL_MS), false);
  assert.equal(isFresh({ ...o, last_error: "blocked" }, at), false);
  const r = optimize(
    [item(1)],
    [{ ...o, last_error: "blocked" }],
    storeCatalog,
  );
  assert.deepEqual(r.missing, ["res"]);
});
test("an explicit empty store selection does not silently enable all stores", () =>
  assert.deepEqual(
    optimize([item(1)], [resistor], storeCatalog, { selectedStores: [] })
      .missing,
    ["res"],
  ));
test("Motorobit verifies the payable gross price for one 40-wire set", () => {
  const p = parseMotorobitProduct(`
    <script type="application/ld+json">{"@type":"Product","name":"40pin 20cm Erkek-Erkek Jumper Kablo","description":"Toplam 40 adetlik paket halindedir.","offers":{"price":"42.50","priceCurrency":"TRY","availability":"https://schema.org/InStock"}}</script>
    <script>PRODUCT_DATA.push(JSON.parse('{\\"id\\":\\"31847\\",\\"name\\":\\"40pin 20cm Erkek-Erkek Jumper Kablo\\",\\"url\\":\\"/40pin-20cm-erkek-erkek-jumper-kablo\\",\\"currency_target\\":\\"TL\\",\\"sale_price\\":42.5,\\"total_sale_price\\":51,\\"vat\\":20,\\"available\\":true,\\"quantity\\":660}'));</script>
    <script>console.log({"P":{"ID":"31847","URL":"/40pin-20cm-erkek-erkek-jumper-kablo","STOCK_INCREMENT":1,"MIN_SALE_COUNT":"1"}})</script>
    <p>Toplam 40 adetlik paket halindedir.</p>
  `, "https://www.motorobit.com/40pin-20cm-erkek-erkek-jumper-kablo");
  assert.equal(p.price, 5100);
  assert.equal(p.packageQuantity, 1);
  assert.equal(p.vatRate, 0.2);
  assert.equal(p.minimumOrderQuantity, 1);
  assert.equal(p.quantityVerified, true);
});

test("T-Soft gross JSON-LD is reconciled with the visibly gross amount", () => {
  const p = parseTsoftProduct(
    fixture(0.17, "0,17", "0,15", 50, 1),
    "https://www.direnc.net/1k-14w-direnc",
  );
  assert.equal(p.price, 17);
  assert.equal(p.minimumOrderQuantity, 50);
  assert.equal(p.orderStep, 1);
  assert.equal(p.vatIncluded, true);
  assert.equal(p.vatRate, null);
});
test("T-Soft net JSON-LD still uses visible VAT-inclusive payable amount", () => {
  const p = parseTsoftProduct(
    fixture(314.8, "377,76", "314,80"),
    "https://www.direnc.net/esp32",
  );
  assert.equal(p.price, 37776);
  assert.equal(p.priceNet, 31480);
});
test("T-Soft sells a 40-wire ribbon as one set, and two sets cost twice as much", () => {
  const html = fixture(47.75, "57,30", "47,75")
    .replaceAll("1/4 W 1K Direnç Paketi", "40 Pin 20cm Erkek-Erkek Jumper Kablo")
    .replace('data-toggle="price-sell-vat"', 'class="product-price"')
    .replace('data-toggle="price-sell"', 'class="product-price-not-vat"')
    .replace("product-count-1", "ProductCount1")
    .concat("<p>Toplam 40 adetlik paket halindedir.</p>");
  const p = parseTsoftProduct(html, "https://www.robotistan.com/40-pin-jumper-kablo");
  assert.equal(p.packageQuantity, 1);
  const offer = {...resistor,price_gross:p.price!,minimum_order_quantity:1,order_step:1,package_quantity:p.packageQuantity!};
  assert.equal(quoteOffer(offer,1).cost,5730);
  assert.equal(quoteOffer(offer,2).cost,11460);
});
test("a discrepant merchant price fails closed", () =>
  assert.throws(
    () =>
      parseTsoftProduct(
        fixture(500, "377,76", "314,80"),
        "https://www.direnc.net/esp32",
      ),
    /eşleşmedi/,
  ));
test("minimum and order step must be explicitly present", () =>
  assert.throws(
    () =>
      parseTsoftProduct(
        fixture(0.17, "0,17", "0,15", 0, 0),
        "https://www.direnc.net/res",
      ),
    /doğrulanamadı/,
  ));
test("legacy URL pack count never overrides the current quantity controls", () => {
  const html = fixture(0.24, "0,24", "0,20", 50, 50)
    .replace('data-toggle="price-sell-vat"', 'class="product-price"')
    .replace('data-toggle="price-sell"', 'class="product-price-not-vat"')
    .replace("product-count-1", "ProductCount1");
  const p = parseTsoftProduct(
    html,
    "https://www.robotistan.com/14w-1k-direnc-paketi-10-adet",
  );
  assert.equal(p.packageQuantity, null);
  assert.equal(p.minimumOrderQuantity, 50);
  assert.equal(p.orderStep, 50);
});
