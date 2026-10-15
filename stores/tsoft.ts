import { load } from "cheerio";
import { JsonLdAdapter, parseProduct, parsePrice } from "./base";
import type { ExtractedProduct } from "./types";
import type { PriceTier } from "../lib/pricing";
import { jumperDetails } from "../lib/catalog-identity";

// Verified against the public product controls of the configured T-Soft stores.
// The legacy URL slug is never used to infer pack size or electrical ratings.
export function parseTsoftProduct(html: string, url: string): ExtractedProduct {
  const p = parseProduct(html, url),
    $ = load(html);
  const scope=$("h1").first().closest("#product-right, #productRight");
  if(!scope.length) throw new Error("Ana ürünün fiyat ve satış bölümü doğrulanamadı.");
  const direnc = new URL(url).hostname.endsWith("direnc.net");
  const grossValues=[...new Set(scope.find(direnc ? '[data-toggle="price-sell-vat"]' : scope.find(".mainPrices .product-price").length ? ".mainPrices .product-price" : ".product-price").map((_,node)=>parsePrice($(node).text())).get().filter((price):price is number=>price!==null && price>0))];
  const gross=grossValues.length===1 ? grossValues[0] : null;
  let net = parsePrice(
    scope.find(direnc ? '[data-toggle="price-sell"]' : ".product-price-not-vat")
      .first()
      .text(),
  );
  if (net === null) net = parsePrice(scope.find(".kdv-dahil2 span").first().text());
  if (net === null) {
    const labelled = scope.find("span").filter((_, element) => /^\s*[\d.,]+\s*TL\s*\+\s*KDV\s*$/.test($(element).text())).first().text();
    net = labelled ? parsePrice(labelled) : null;
  }
  // T-Soft publishes either net or gross in JSON-LD depending on the item.
  // Cross-check both explicitly labelled DOM amounts, then use the gross amount.
  if (gross === null || gross <= 0 || (p.price !== gross && p.price !== net))
    throw new Error(
      "JSON-LD fiyatı sayfadaki KDV dahil/hariç fiyatlarla eşleşmedi.",
    );
  const input = scope.find(direnc ? 'input[id^="product-count-"]' : 'input[id^="ProductCount"], input[type="number"][id^="Adet"]').first();
  const minimum = Number(input.attr("min")),
    step = Number(input.attr("step") ?? (input.attr("type") === "number" ? "1" : ""));
  if (
    !input.length ||
    !Number.isSafeInteger(minimum) ||
    minimum < 1 ||
    !Number.isSafeInteger(step) ||
    step < 1
  )
    throw new Error("Minimum sipariş ve satış adımı doğrulanamadı.");
  // A 40-pin ribbon is one saleable set, not forty independently priced packs.
  const packageQuantity = jumperDetails(p.name) ? 1 : p.packageQuantity;
  const tiers: PriceTier[] = [];
  scope.find("table").each((_, table) => {
    if (!/Miktar[\s\S]*Birim Fiyat/.test($(table).text())) return;
    $(table)
      .find("tr")
      .each((_, row) => {
        const cells = $(row).find("td");
        if (cells.length < 3) return;
        const range = $(cells[0])
          .text()
          .trim()
          .match(/^(\d+)\s*-\s*(\d+)$/);
        const price = parsePrice($(cells[2]).text());
        if (range && price && price <= gross)
          tiers.push({
            minimum: Math.max(minimum,Number(range[1])),
            maximum: Number(range[2]),
            price,
          });
      });
  });
  return {
    ...p,
    packageQuantity,
    price: gross,
    priceNet: net,
    vatIncluded: true,
    vatRate: null,
    minimumOrderQuantity: minimum,
    orderStep: step,
    quantityVerified: true,
    priceTiers: tiers,
    warnings: [
      "KDV dahil fiyat ile minimum sipariş ve satış adımı mağaza sayfasından okundu.",
      "Stok miktarı ve kargo ücreti ödeme ekranında doğrulanmalıdır.",
    ],
  };
}
export class TsoftAdapter extends JsonLdAdapter {
  async getProduct(raw: string) {
    const page = await this.readPage(raw);
    return parseTsoftProduct(page.html, page.url);
  }
  async searchProducts(query: string) {
    const url = new URL("/arama", `https://${this.store.domain}`);
    url.searchParams.set("q", query);
    const page = await this.readPage(url.href),
      $ = load(page.html);
    const words = query.toLocaleLowerCase("tr-TR").split(/\s+/).filter(Boolean);
    const urls = new Set<string>();
    $("a[href]").each((_, e) => {
      const name = $(e).text().trim(),
        href = $(e).attr("href");
      if (
        !href ||
        name.length > 160 ||
        name.length < 3 ||
        !words.every((w) => name.toLocaleLowerCase("tr-TR").includes(w))
      )
        return;
      const u = new URL(href, url);
      if (
        u.hostname === url.hostname &&
        !/arama|kategori/.test(u.pathname) &&
        u.pathname !== "/"
      )
        urls.add(u.href);
    });
    const products: ExtractedProduct[] = [];
    for (const u of [...urls].slice(0, 4)) {
      try {
        products.push(await this.getProduct(u));
      } catch {
        /* Other candidates can still be inspected. */
      }
    }
    return products;
  }
  async getShippingRules() {
    const path =
      this.storeId === "direnc" ? "/odeme-ve-teslimat" : "/teslimat-kosullari";
    const page = await this.readPage(
        new URL(path, `https://${this.store.domain}`).href,
      ),
      $ = load(page.html);
    $("script,style").remove();
    const text = $("body").text().replace(/\s+/g, " ");
    const threshold = text.match(
      /([\d.,]+)\s*TL\s*ve\s*[üu]zeri.{0,90}(?:[üu]cretsiz|kargo\s*[üu]cretsiz)/i,
    );
    return {
      estimated: true,
      available: false,
      freeShippingThreshold: threshold
        ? parsePrice(threshold[1].replace(/\./g, ""))
        : null,
      sourceUrl: page.url,
    };
  }
}
