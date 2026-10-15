import { load } from "cheerio";
import { JsonLdAdapter, parsePrice, parseProduct } from "../base";
import { catalogIdentity, jumperDetails } from "../../lib/catalog-identity";
import type { ExtractedProduct } from "../types";

function decodeString(raw: string) {
  return raw.replace(/\\(u[0-9a-f]{4}|x[0-9a-f]{2}|[\s\S])/gi, (_, escape: string) => {
    if (escape[0] === "u" || escape[0] === "x") return String.fromCharCode(parseInt(escape.slice(1),16));
    return ({ n:"\n", r:"\r", t:"\t", b:"\b", f:"\f" } as Record<string,string>)[escape] ?? escape;
  });
}
export function parseMotorobitProduct(html: string, url: string): ExtractedProduct {
  const product = parseProduct(html,url), $ = load(html);
  const payloads: Record<string, unknown>[] = [];
  const controls: Record<string, unknown>[] = [];
  $("script").each((_, script) => {
    const content = $(script).text();
    for (const match of content.matchAll(/PRODUCT_DATA\.push\(JSON\.parse\('((?:\\.|[^'\\])*)'\)\)/g)) {
      try { payloads.push(JSON.parse(decodeString(match[1]))); } catch { /* Data only; never execute merchant scripts. */ }
    }
    const logged = content.trim().match(/^console\.log\((\{[\s\S]*\})\);?$/);
    if (logged) { try { controls.push(JSON.parse(logged[1]).P); } catch { /* Ignore unrelated scripts. */ } }
  });
  const samePath = (raw: unknown) => { try { return new URL(String(raw),url).pathname === new URL(url).pathname; } catch { return false; } };
  const data = payloads.find(p => p.url && samePath(p.url) && typeof p.name === "string" && catalogIdentity({name:p.name}) === catalogIdentity(product));
  const control = controls.find(p => p && p.URL && samePath(p.URL) && String(p.ID) === String(data?.id));
  const gross = parsePrice(data?.total_sale_price), net = parsePrice(data?.sale_price);
  const vat = Number(data?.vat), minimum = Number(control?.MIN_SALE_COUNT), step = Number(control?.STOCK_INCREMENT);
  if (!data || !control || data.currency_target !== "TL" || product.currency !== "TRY" || gross === null || gross <= 0 || net === null || !Number.isFinite(vat) || vat < 0 || vat > 100 || Math.abs(Math.round(net*(1+vat/100))-gross)>1 || (product.price !== net && product.price !== gross))
    throw new Error("Motorobit KDV dahil fiyatı ürün verisiyle doğrulanamadı.");
  if (!Number.isSafeInteger(minimum) || minimum < 1 || !Number.isSafeInteger(step) || step < 1 || typeof data.available !== "boolean" || !Number.isFinite(Number(data.quantity)))
    throw new Error("Motorobit stok ve satış adımı doğrulanamadı.");
  return {...product, price:gross, priceNet:net, vatIncluded:true, vatRate:vat/100,
    packageQuantity:jumperDetails(product.name) ? 1 : product.packageQuantity || 1,
    stockStatus:data.available ? "in_stock" : "out_of_stock",stockQuantity:Number(data.quantity),
    minimumOrderQuantity:minimum,orderStep:step,quantityVerified:true,
    warnings:["KDV dahil fiyat, stok ve satış adımı aynı ürünün mağaza verisinden doğrulandı.","Kargo ücreti ödeme ekranında doğrulanmalıdır."]};
}
export class MotorobitAdapter extends JsonLdAdapter {
  async getProduct(raw: string) { const page=await this.readPage(raw); return parseMotorobitProduct(page.html,page.url); }
}
