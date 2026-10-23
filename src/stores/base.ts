import {merchantDisplayPreferences} from './request-preferences';
import { load } from "cheerio";
import type { ExtractedProduct, StoreAdapter, StoreConfig } from "./types";
import { ascii } from "../../public/catalog/product-identity.js";
import {nameMatchScore} from '../../public/catalog/product-identity.js';
import {variantConflict} from '../lib/catalog-identity';
import { validateProductFacts } from "./validate-product-facts";
import {waitForSignal} from "../lib/async-deadline";
const MAX_BYTES = 2_000_000;
const robotsCache=new Map<string,{at:number;failed:boolean;value:Promise<string>}>();
const nextMerchantRead=new Map<string,number>();
export function decodeHtml(bytes:Uint8Array,contentType="") {
  const header=contentType.match(/charset\s*=\s*["']?([\w-]+)/i)?.[1];
  const prefix=new TextDecoder("windows-1252").decode(bytes.subarray(0,4096));
  const declared=header || prefix.match(/<meta[^>]*charset\s*=\s*["']?([\w-]+)/i)?.[1] || "utf-8";
  const aliases:Record<string,string>={utf8:"utf-8","utf-8":"utf-8","iso-8859-9":"windows-1254","windows-1254":"windows-1254","iso-8859-1":"windows-1252","windows-1252":"windows-1252"};
  const charset=aliases[declared.toLowerCase()];
  if(!charset) throw new Error("Mağaza sayfasının karakter kodlaması desteklenmiyor.");
  return new TextDecoder(charset).decode(bytes);
}
export class StoreReadError extends Error {
  constructor(message:string, public retryable=true) {super(message);this.name='StoreReadError';}
}
export function isRetryableStoreError(error:unknown) {
  return error instanceof StoreReadError ? error.retryable : error instanceof Error && (/^(TimeoutError|AbortError)$/.test(error.name) || /fetch failed|network|timed? ?out|timeout|operation was aborted/i.test(error.message));
}
/** Access failure may retain a dated observation; contradictory product or
 * tax evidence must never resurrect an earlier price as a successful read. */
export function canRetainObservedProduct(error:unknown){return error instanceof StoreReadError||isRetryableStoreError(error);}
export function safeStoreUrl(raw: string, domain: string) {
  const url = new URL(raw);
  const hosts = new Set([
    domain,
    domain.replace(/^www\./, ""),
    `www.${domain.replace(/^www\./, "")}`,
  ]);
  if (
    url.protocol !== "https:" ||
    url.username ||
    url.password ||
    (url.port && url.port !== "443") ||
    !hosts.has(url.hostname)
  )
    throw new Error("Yalnızca mağazanın HTTPS ürün adresleri kabul edilir.");
  url.hash = "";
  return url;
}
async function boundedFetch(url: URL, domain: string,signal=AbortSignal.timeout(12000)) {
  for (let redirects = 0; redirects <= 3; redirects++) {
    signal.throwIfAborted();
    const r = await fetch(url, {
      redirect: "manual",
      headers: {
        "User-Agent":
          "EUB-PriceComparison/1.0 (+public product metadata; no authentication)",
        Accept: "text/html,application/ld+json,text/plain",
        ...merchantDisplayPreferences(domain),
      },
      signal: AbortSignal.any([signal,AbortSignal.timeout(8000)]),
    });
    if (r.status >= 300 && r.status < 400) {
      const loc = r.headers.get("location");
      if (!loc) throw new Error("Geçersiz yönlendirme");
      url = safeStoreUrl(new URL(loc, url).href, domain);
      continue;
    }
    if (!r.ok)
      throw new StoreReadError(
        `Mağaza ${r.status} yanıtı verdi. Güvenlik engelleri aşılmaz.`,
        r.status===408 || r.status===429 || r.status>=500,
      );
    if (Number(r.headers.get("content-length") || 0) > MAX_BYTES)
      throw new Error("Sayfa çok büyük.");
    const reader = r.body?.getReader();
    if (!reader) return {html:"",url:url.href};
    const chunks: Uint8Array[] = [];
    let size = 0;
    while (true) {
      const v = await reader.read();
      if (v.done) break;
      size += v.value.length;
      if (size > MAX_BYTES) {
        await reader.cancel();
        throw new Error("Sayfa boyut sınırını aşıyor.");
      }
      chunks.push(v.value);
    }
    const bytes=new Uint8Array(size);
    let offset=0;
    for(const chunk of chunks) {bytes.set(chunk,offset);offset+=chunk.length;}
    return {html:decodeHtml(bytes,r.headers.get("content-type") || ""),url:url.href};
  }
  throw new Error("Çok fazla yönlendirme");
}
export function robotsAllowed(text: string, path: string) {
  type Rule = { allow: boolean; pattern: string };
  const groups: { agents: string[]; rules: Rule[] }[] = [];
  let group = { agents: [] as string[], rules: [] as Rule[] };
  for (const line of text.split("\n")) {
    const [key, ...rest] = line.replace(/#.*/, "").trim().split(":");
    const value = rest.join(":").trim();
    if (key?.toLowerCase() === "user-agent") {
      if (group.rules.length) {
        groups.push(group);
        group = { agents: [], rules: [] };
      }
      group.agents.push(value.toLowerCase());
    } else if (["disallow", "allow"].includes(key?.toLowerCase()) && value)
      group.rules.push({
        allow: key.toLowerCase() === "allow",
        pattern: value,
      });
  }
  groups.push(group);
  const bot = "eub-pricecomparison";
  const specific = groups.filter((g) =>
    g.agents.some((a) => a !== "*" && bot.includes(a)),
  );
  const selected = specific.length
    ? specific
    : groups.filter((g) => g.agents.includes("*"));
  const matching = selected
    .flatMap((g) => g.rules)
    .filter((r) => {
      const regex = r.pattern
        .split("*")
        .map((s) => s.replace(/[.+?^{}()|[\]\\]/g, "\\$&"))
        .join(".*");
      return new RegExp("^" + regex).test(path);
    })
    .sort(
      (a, b) =>
        b.pattern.length - a.pattern.length ||
        Number(b.allow) - Number(a.allow),
    );
  return matching[0]?.allow ?? true;
}
export function parsePrice(value: unknown): number | null {
  if (value === undefined || value === null || value === "") return null;
  if(typeof value==="number") return Number.isFinite(value) && value>=0 ? Math.round(value*100) : null;
  const text=String(value).trim().replace(/(\d)[\s\u00a0](?=\d{3}(?:[.,]|\b))/g,"$1");
  const tokens=text.match(/[-+]?\d[\d.,]*/g);
  if(tokens?.length!==1 || /[{}]/.test(text)) return null;
  const raw=tokens[0].replace(/\s/g,"");
  let normalized=raw;
  const dot=raw.lastIndexOf("."),comma=raw.lastIndexOf(",");
  if(dot>=0 && comma>=0) {
    const decimal=dot>comma ? "." : ",";
    const group=decimal==="." ? "," : ".";
    normalized=raw.split(group).join("").replace(decimal,".");
  } else if(comma>=0) {
    normalized=/^\d{1,3}(,\d{3})+$/.test(raw) ? raw.replaceAll(",","") : raw.replace(",",".");
  } else if(dot>=0 && (/^\d{1,3}(\.\d{3}){2,}$/.test(raw) || /TL|TRY|₺/i.test(text) && /^\d{1,3}(\.\d{3})+$/.test(raw))) {
    normalized=raw.replaceAll(".","");
  }
  const n = Number(normalized);
  return Number.isFinite(n) && n >= 0 && Number.isSafeInteger(Math.round(n*100)) ? Math.round(n * 100) : null;
}
export function parseProduct(html: string, url: string): ExtractedProduct {
  const $ = load(html);
  const nodes: Record<string, unknown>[] = [];
  function visit(v: unknown) {
    if (Array.isArray(v)) {
      v.forEach(visit);
      return;
    }
    if (v && typeof v === "object") {
      const n = v as Record<string, unknown>;
      if (
        n["@type"] === "Product" ||
        (Array.isArray(n["@type"]) && n["@type"].includes("Product"))
      )
        nodes.push(n);
      if (n["@graph"]) visit(n["@graph"]);
    }
  }
  $('script[type="application/ld+json"]').each((_, e) => {
    try {
      visit(JSON.parse($(e).text()));
    } catch {
      /* Invalid merchant JSON-LD is ignored; the result explains missing fields. */
    }
  });
  const pathOf = (value: unknown) => {
    try { const parsed=new URL(String(value),url);return parsed.hostname.replace(/^www\./,"")+parsed.pathname.replace(/\/$/,""); }
    catch { return null; }
  };
  const title = ascii($("h1").first().text());
  const canonical=$('link[rel="canonical"]').attr('href');
  let canonicalPath:string|null=null;
  try{const actual=new URL(url),declared=canonical?new URL(canonical,url):null;if(declared?.protocol==='https:'&&declared.hostname.replace(/^www\./,'')===actual.hostname.replace(/^www\./,'')&&!declared.username&&!declared.password)canonicalPath=pathOf(declared.href);}catch{}
  const samePage=(value:unknown)=>pathOf(value)===pathOf(url)||Boolean(canonicalPath&&pathOf(value)===canonicalPath);
  const matchingUrl = nodes.filter(node => node.url && samePage(node.url));
  const matchingTitle = nodes.filter(node => title && ascii(node.name) === title);
  const p = matchingUrl.length === 1 ? matchingUrl[0]
    : matchingTitle.length === 1 ? matchingTitle[0]
    : nodes.length === 1 && (!title || ascii(nodes[0].name) === title) ? nodes[0] : undefined;
  if (!p)
    throw new Error(
      "Sayfada okunabilir Product JSON-LD bulunamadı. Manuel ihtiyaç ekleyebilirsiniz.",
    );
  const visibleTitle=$("h1").first().text().replace(/\s+/g,' ').trim();
  const specifications=JSON.stringify({description:p.description || "",properties:p.additionalProperty || []});
  const pageFacts={name:visibleTitle,specifications},metadataFacts={name:String(p.name||''),specifications};
  // Metadata belongs to this URL, but the visible item name is the anchor.
  // Contradictory Product metadata must not attach another item's price.
  if(visibleTitle && ((ascii(pageFacts.name)!==ascii(metadataFacts.name)&&nameMatchScore(pageFacts,metadataFacts)<.65) || variantConflict(pageFacts,metadataFacts)))
    throw new Error('Görünen ürün başlığı ile fiyat verisinin ürün türü veya modeli uyuşmuyor.');
  validateProductFacts(String(p.name || ""),String(p.description || ""),Array.isArray(p.additionalProperty) ? p.additionalProperty : []);
  const rawOffers = p.offers;
  const choices=(Array.isArray(rawOffers)?rawOffers:[rawOffers]).filter((offer):offer is Record<string,unknown>=>Boolean(offer && typeof offer==="object"));
  const scoped=choices.filter(offer=>offer.url && samePage(offer.url));
  const offers=scoped.length===1 ? scoped[0] : choices.length===1 && (!choices[0].url || samePage(choices[0].url)) ? choices[0] : {};
  const spec = (offers.priceSpecification || {}) as Record<string, unknown>;
  const brand =
    typeof p.brand === "object"
      ? String((p.brand as Record<string, unknown>)?.name || "")
      : String(p.brand || "");
  const explicitVat = spec.valueAddedTaxIncluded;
  const main=$("#product-right, #productRight, #PM_urun_detayi, [itemtype$='/Product']").first();
  const body = (main.length ? main : $("body")).clone().find("script,style").remove().end().text();
  const vat =
    typeof explicitVat === "boolean"
      ? explicitVat
      : /KDV\s*dahil/i.test(body)
        ? true
        : /\+\s*KDV|KDV\s*hariç/i.test(body)
          ? false
          : null;
  const pack = String(p.name || "").match(/(?:\b(\d+)\s*(?:adet|pcs)\b)/i);
  const warnings = [
    "Paket adedini ve teknik özellikleri satıcı sayfasında doğrulayın.",
  ];
  if (vat === null) warnings.push("KDV durumu doğrulanamadı.");
  const rawImage = Array.isArray(p.image) ? p.image[0] : p.image;
  const image = rawImage && typeof rawImage === "object" ? (rawImage as Record<string, unknown>).url : rawImage;
  return {
    url,
    name: visibleTitle || String(p.name || '').trim(),
    mpn: String(p.mpn || ""),
    manufacturer: brand,
    model: String(p.model || p.mpn || ""),
    image:
      typeof image === "string" && image.startsWith("https://") ? image : null,
    price: parsePrice(offers.price ?? spec.price),
    currency: String(offers.priceCurrency || spec.priceCurrency || ""),
    vatIncluded: vat,
    vatRate: null,
    packageQuantity: pack ? Number(pack[1]) : null,
    stockStatus: String(offers.availability || "").includes("InStock")
      ? "in_stock"
      : String(offers.availability || "").includes("OutOfStock")
        ? "out_of_stock"
        : "unknown",
    stockQuantity: null,
    specifications,
    warnings,
  };
}
export class JsonLdAdapter implements StoreAdapter {
  storeId: string;
  constructor(protected store: StoreConfig) {
    this.storeId = store.id;
  }
  async searchProducts(_query: string): Promise<ExtractedProduct[]> {
    throw new Error(
      "Otomatik arama entegrasyonu bekliyor. Ürün URL’si kullanılabilir.",
    );
  }
  protected async readPage(raw: string) {
    const url = safeStoreUrl(raw, this.store.domain);
    const signal=this.store.requestSignal || AbortSignal.timeout(12000);
    signal.throwIfAborted();
    let robots: string;
    try {
      let cached=robotsCache.get(url.origin);
      if(!cached || Date.now()-cached.at>(cached.failed?60000:10*60*1000)) {
        const record={at:Date.now(),failed:false,value:Promise.resolve('')};
        record.value=boundedFetch(new URL('/robots.txt',url),this.store.domain).then(page=>page.html).catch(error=>{record.failed=true;throw error;});
        robotsCache.set(url.origin,record);cached=record;
      }
      robots=await waitForSignal(cached.value,signal);
    } catch(error) {
      const detail=error instanceof Error ? error.message : 'Bağlantı hatası';
      console.warn('Merchant robots read failed',{host:url.hostname,detail});
      throw new StoreReadError(`Mağazaya şu anda ulaşılamıyor; otomatik erişim kuralları doğrulanamadı. ${detail}`,isRetryableStoreError(error));
    }
    if (!robotsAllowed(robots, url.pathname + url.search))
      throw new Error(
        "Mağazanın robots.txt kuralları bu sayfanın okunmasına izin vermiyor.",
      );
    const delay=Math.max(0,...[...robots.matchAll(/^\s*Crawl-delay:\s*([\d.]+)/gim)].map(m=>Number(m[1])*1000));
    if(delay){
      const at=Math.max(Date.now(),nextMerchantRead.get(url.origin)||0);
      nextMerchantRead.set(url.origin,at+delay);
      if(at>Date.now())await waitForSignal(new Promise<void>(resolve=>setTimeout(resolve,at-Date.now())),signal);
    }
    return boundedFetch(url, this.store.domain,signal);
  }
  async getProduct(raw: string) {
    const page = await this.readPage(raw);
    return this.normalizeProduct(parseProduct(page.html, page.url));
  }
  async getCatalogProduct(raw: string) {
    const page = await this.readPage(raw);
    try { return this.normalizeProduct(parseProduct(page.html, page.url)); }
    catch {
      const $ = load(page.html);
      const name = $("h1").first().text().replace(/\s+/g, " ").trim() || $('meta[property="og:title"]').attr("content")?.trim() || "";
      if (name.length < 3 || name.length > 220) throw new Error("Ürün başlığı doğrulanamadı.");
      const image = $('meta[property="og:image"]').attr("content") || null;
      return { url: page.url, name, mpn: "", manufacturer: "", model: "",
        image: image?.startsWith("https://") ? image : null,
        price: null, currency: "", vatIncluded: null, vatRate: null,
        packageQuantity: null, stockStatus: "unknown", stockQuantity: null,
        specifications: "{}", warnings: ["Ürün bilgisi sayfadan alındı; fiyat ve stok doğrulanmadı."],
      };
    }
  }
  getPrice(p: ExtractedProduct) {
    return p.price;
  }
  getStock(p: ExtractedProduct) {
    return p.stockStatus;
  }
  async getShippingRules() {
    return { estimated: true, available: false };
  }
  normalizeProduct(p: ExtractedProduct) {
    return { ...p, name: p.name.trim() };
  }
  normalizePrice(v: unknown) {
    return parsePrice(v);
  }
}
