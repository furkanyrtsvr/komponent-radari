import {salesUnit} from "../sales-unit";
import { id, now,money, type Product, type Offer, type Store } from "../domain";
import { verifiedShippingRule } from "../shipping";
import { list, listIn, pages, one, insert, update, HttpError } from "./db";
import { adapterFor } from "../../stores/registry";
import {readProduct,pricePhase,phaseOffers} from './snapshots';
import { liveSources, type LiveSource } from "../../stores/live-catalog";
import type { ExtractedProduct } from "../../stores/types";
import { jumperDetails, catalogIdentity, matchesCatalogRequirement,variantConflict } from "../catalog-identity";
import { isRetryableStoreError, JsonLdAdapter } from "../../stores/base";
import { isFresh,hasObservedPrice } from "../pricing";
import {fairRefreshQueue} from "../async-deadline";
import {usesCollector,CollectorReadError} from '../collector-routing';
import {catalogueSources} from "../catalog-sources";
import {nameMatchScore} from '../../../public/catalog/product-identity.js';
export {catalogueSources} from "../catalog-sources";
const pending = new Map<string, Promise<unknown>>();
const recentFailures = new Map<string, number>();
async function lock<T>(key: string, fn: () => Promise<T>): Promise<T> {
  if (pending.has(key)) return pending.get(key) as Promise<T>;
  const p = fn().finally(() => pending.delete(key));
  pending.set(key, p);
  return p;
}
export async function persist(
  store: Store,
  p: ExtractedProduct,
  productId: string,
  packageQuantity: number,
  previous?: Offer,
) {
  if (
    p.price === null ||
    p.price <= 0 ||
    p.currency !== "TRY" ||
    p.vatIncluded !== true ||
    !p.quantityVerified
  )
    throw new Error("Fiyat, KDV veya satış adımı doğrulanamadı.");
  const existingSp = await one<{ id: string }>("store_products", {
    store_id: store.id,
    url: p.url,
  });
  const sp = {
    id: existingSp?.id || id(),
    store_id: store.id,
    url: p.url,
    title: p.name,
    mpn: p.mpn,
    raw_data: JSON.stringify(p),
  };
  if (!existingSp) {
    await insert("store_products", sp, true);
    sp.id = (await one<{ id: string }>("store_products", {
      store_id: store.id,
      url: p.url,
    }))!.id;
  }
  await update("store_products", sp, { id: sp.id });
  const old =
    previous ||
    (await one<Offer>("store_offers", {
      store_product_id: sp.id,
      source: "live",
    }));
  const offer: Offer = {
    id: old?.id || `live-${sp.id}`,
    canonical_product_id: productId,
    store_id: store.id,
    store_product_id: sp.id,
    title: p.name,
    product_url: p.url,
    image_url: p.image,
    manufacturer: p.manufacturer,
    mpn: p.mpn,
    price_net: p.priceNet ?? p.price,
    vat_rate: p.vatRate,
    price_gross: p.price,
    package_quantity: packageQuantity,
    unit_price: Math.round(p.price / packageQuantity),
    currency: "TRY",
    vat_included: 1,
    stock_status: p.stockStatus,
    stock_quantity: p.stockQuantity,
    match_confidence: old?.match_confidence ?? 95,
    match_type: old?.match_type ?? "verified",
    last_checked_at: p.checkedAt || now(),
    source: "live",
    minimum_order_quantity: p.minimumOrderQuantity || packageQuantity,
    order_step: p.orderStep || packageQuantity,
    price_tiers: JSON.stringify(p.priceTiers || []),
    last_error: null,
  };
  await insert("store_offers", offer, true);
  await update("store_offers", offer, { id: offer.id });
  if(!old || old.last_checked_at!==offer.last_checked_at || old.price_gross!==offer.price_gross || old.stock_status!==offer.stock_status)await insert("price_history", {
    id: id(),
    offer_id: offer.id,
    price_gross: offer.price_gross,
    stock_status: offer.stock_status,
    checked_at: offer.last_checked_at,
  });
  await insert("store_health",{id:id(),store_id:store.id,success:1,message:`${p.readMethod==='snapshot'?'Fiyat arşivi · ':''}${p.name} · ${money(offer.price_gross)} · ${p.stockStatus==="in_stock"?"Stokta":p.stockStatus==="out_of_stock"?"Stokta yok":"Stok belirsiz"}`,checked_at:offer.last_checked_at});
  await update(
    "stores",
    {
      last_successful_sync: offer.last_checked_at,
      status: "live",
      supports_search: Number(adapterFor(store).searchProducts!==JsonLdAdapter.prototype.searchProducts),
      supports_live_price: 1,
      supports_stock: 1,
    },
    { id: store.id },
  );
  return {...offer,unit_type:p.unitType};
}
async function checkSource(
  store: Store,
  source: LiveSource,
  existing?: Offer,
  force = false,
  signal?:AbortSignal,
  knownProduct?:Product,
) {
  const url = new URL(source.path, `https://${store.domain}`).href;
  const phase=await pricePhase();
  return lock(phase+":"+source.productId + ":" + url, async () => {
    if(signal?.aborted)return{store:store.name,status:"deferred",productId:source.productId};
    const canonical = knownProduct || await one<Product>("canonical_products", {id:source.productId});
    const strictIdentity = canonical && /^(model:|cable:|accessory:|passive:|potentiometer:)/.test(catalogIdentity(canonical));
    if (existing && existing.canonical_product_id===source.productId && strictIdentity && !matchesCatalogRequirement(canonical, {name:existing.title,manufacturer:existing.manufacturer})) {
      await update("store_offers", {last_error:"Ürün modeli veya aksesuar türü eşleşmiyor."}, {id:existing.id});
      existing = {...existing,last_error:"Ürün modeli veya aksesuar türü eşleşmiyor."};
    }
    if (
      !force &&
      existing &&
      isFresh(existing)
    )
      return {
        store: store.name,
        status: existing.canonical_product_id===source.productId ? usesCollector(store.id)?'archive':"cached" : "variant",
        relatedProductId:existing.canonical_product_id,
        productId: source.productId,
      };
    if (phase!=='B' && Date.now() - (recentFailures.get(url) || 0) < 60000)
      return {
        store: store.name,
        status: "failed",
        message: "Mağaza yeniden denemesi bir dakika sonra yapılabilir.",
      };
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
      const requestSignal=signal ? AbortSignal.any([signal,AbortSignal.timeout(12000)]) : AbortSignal.timeout(12000);
      const p = await readProduct({...store,requestSignal},url,force);
      if(p.readMethod==='snapshot' && existing && existing.canonical_product_id===source.productId && existing.last_checked_at>p.checkedAt! && hasObservedPrice(existing))return {store:store.name,status:'last_known',productId:source.productId};
      if(canonical && !matchesCatalogRequirement(canonical,p) && nameMatchScore(canonical,p)>=0.65 && p.price && p.currency==='TRY' && p.vatIncluded===true && p.quantityVerified){
        const {saveCatalogProduct}=await import('./catalog-import');
        const saved=await saveCatalogProduct(store,p,canonical.category);
        await update('scrape_jobs',{status:'completed',error:'İsim/model benzerliği ile bulundu; mağaza başlığı ayrı gösterilir.',finished_at:now()},{id:job});
        return {store:store.name,storeId:store.id,status:'variant',productId:source.productId,relatedProductId:saved.product.id};
      }
      if (canonical && !matchesCatalogRequirement(canonical, p))
        throw new Error("Ürün modeli veya aksesuar türü eşleşmiyor; teklif kullanılmadı.");
      const packageQuantity = jumperDetails(p.name) ? 1 : p.packageQuantity || source.packageQuantity;
      if (!source.title.test(p.name))
        throw new Error(
          "Ürün başlığı doğrulanan modelle eşleşmiyor; teklif kullanılmadı.",
        );
      if (
        p.packageQuantity !== null &&
        p.packageQuantity !== source.packageQuantity && !catalogIdentity(canonical || {name:p.name}).startsWith("passive:")
      )
        throw new Error("Paket adedi değişmiş; teklif inceleme bekliyor.");
      await persist(
        store,
        p,
        source.productId,
        packageQuantity,
        existing,
      );
      if (jumperDetails(p.name)) await update("canonical_products", {unit_type:"set",package_quantity:1,image:p.image}, {id:source.productId});
      await update(
        "scrape_jobs",
        { status: "completed", finished_at: now() },
        { id: job },
      );
      return {
        store: store.name,
        status: p.collectorManaged?'archive':p.readMethod==='snapshot' && !isFresh({source:'live',last_error:null,last_checked_at:p.checkedAt!,snapshot_max_age_ms:phase==='B'?43200000:undefined} as Offer)?'last_known':"updated",
        productId: source.productId,
        stockStatus:p.stockStatus,
      };
    } catch (e) {
      const message = e instanceof Error ? e.message : "Mağaza okunamadı";
      if(e instanceof CollectorReadError){await update('scrape_jobs',{status:e.pending?'waiting_collector':'collector_unverified',error:message,finished_at:now()},{id:job});return {store:store.name,status:e.pending?'collector_pending':'failed',productId:source.productId,message};}
      const archiveMode=await pricePhase()==='B';
      if(!archiveMode)recentFailures.set(url, Date.now());
      const retained=Boolean(existing && isRetryableStoreError(e) && hasObservedPrice(existing));
      // Timeouts and temporary access failures do not revoke an observed price.
      // Its real date still determines whether it can be used in a quote.
      if (existing && !retained && !archiveMode && !signal?.aborted && !isRetryableStoreError(e))
        await update(
          "store_offers",
          { last_error: message },
          { id: existing.id },
        );
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
      return {
        store: store.name,
        status: retained ? "retained" : "failed",
        productId: source.productId,
        message:retained ? `${message} Son alınan fiyat gerçek kontrol tarihiyle korundu.` : message,
      };
    }
  });
}
export async function syncLive(productIds?: string[], force = false) {
  if (productIds && !productIds.length) return {demo:false,checked:0,cached:0,failed:0,retained:0,total:0,results:[],message:"Sepette kontrol edilecek ürün yok."};
  const deadline=AbortSignal.timeout(20000);
  const snapshotMode=await pricePhase()==='B';
  if(snapshotMode)return {demo:false,checked:0,cached:0,failed:0,retained:0,total:0,results:[],message:'Hazır B kataloğu kullanılıyor. Mağaza taraması yapılmadı; fiyatların gerçek kontrol tarihleri korunuyor. Yeni sürüm 12 saatlik hazırlama çalışması başarıyla tamamlandığında yayımlanır.'};
  const stores = (await list<Store>("stores")).filter((s) => s.enabled);
  const products:Product[]=[];
  const offers:Offer[]=[];
  if(productIds) {
    products.push(...await listIn<Product>("canonical_products","id",productIds));
    offers.push(...await listIn<Offer>("store_offers","canonical_product_id",productIds,{source:"live"}));
  } else {
    for await(const page of pages<Product>("canonical_products")) products.push(...page);
    for await(const page of pages<Offer>("store_offers",{source:"live"})) offers.push(...page);
  }
  const sources = liveSources.filter(
    (s) => !productIds?.length || productIds.includes(s.productId),
  );
  for (const product of products) {
    for (const entry of catalogueSources(product,true)) {
      if(variantConflict(product,{name:entry.name||''}))continue;
      if (!sources.some(s=>s.productId===product.id && s.storeId===entry.storeId && new URL(s.path,`https://${stores.find(x=>x.id===s.storeId)?.domain}`).href===entry.url))
        sources.push({productId:product.id,storeId:entry.storeId,path:entry.url,title:/.+/,packageQuantity:product.package_quantity});
    }
  }
  // Include previously reviewed/imported products; identity must still match on refresh.
  for (const o of offers.filter(
    (o) => !productIds?.length || productIds.includes(o.canonical_product_id),
  ))
    if (
      !sources.some(
        (s) =>
          s.productId === o.canonical_product_id && s.storeId === o.store_id && new URL(s.path,`https://${stores.find(x=>x.id===s.storeId)?.domain}`).href===o.product_url,
      )
    )
      sources.push({
        productId: o.canonical_product_id,
        storeId: o.store_id,
        path: o.product_url,
        title: /.+/,
        packageQuantity: o.package_quantity,
      });
  const results: unknown[] = [];
  const discoveredOffers=await listIn<Offer>('store_offers','product_url',sources.map(source=>new URL(source.path,`https://${stores.find(store=>store.id===source.storeId)?.domain}`).href),{source:'live'});
  const existingByUrl=new Map((await phaseOffers([...offers,...discoveredOffers])).map(offer=>[offer.product_url,offer]));
  const canonicalById=new Map(products.map(product=>[product.id,product]));
  const freshPairs=new Set((await phaseOffers(offers)).filter(offer=>{
    const product=canonicalById.get(offer.canonical_product_id);
    return isFresh(offer) && offer.stock_status==="in_stock" && product && matchesCatalogRequirement(product,{name:offer.title,manufacturer:offer.manufacturer});
  }).map(offer=>offer.store_id+":"+offer.canonical_product_id));
  let attempts=0;
  const storeResults=await Promise.allSettled(
    stores.map(async (store) => {
      // Sequential within each merchant to keep request volume bounded.
      const existingFor=(source:LiveSource)=>existingByUrl.get(new URL(source.path,`https://${store.domain}`).href);
      const queue=fairRefreshQueue(sources.filter((source)=>source.storeId===store.id),source=>{
        const offer=existingFor(source);
        return offer ? isFresh(offer)?0:!offer.last_error?1:3 : 2;
      });
      // Refresh products with no usable offer before spending the deadline on
      // new alternatives for products that already have a price elsewhere.
      const usableProducts=new Set([...existingByUrl.values()].filter(o=>isFresh(o)&&o.stock_status==='in_stock').map(o=>o.canonical_product_id));
      const firstRound=new Set<string>();
      const first=queue.filter(s=>{if(firstRound.has(s.productId))return false;firstRound.add(s.productId);return true;});
      const firstSet=new Set(first);
      first.sort((a,b)=>Number(usableProducts.has(a.productId))-Number(usableProducts.has(b.productId)));
      queue.splice(0,queue.length,...first,...queue.filter(s=>!firstSet.has(s)));
      for (const source of queue) {
        const existing=existingFor(source);
        const pair=store.id+':'+source.productId;
        if(!force && freshPairs.has(pair))continue;
        // A fresh verified counterpart already exists. Opening the page should
        // reuse it instead of rediscovering every alternate URL on each visit.
        if(!force && freshPairs.has(store.id+":"+source.productId) && existing?.last_error && !nameMatchScore(canonicalById.get(source.productId)||{name:''},{name:existing.title}))continue;
        if(deadline.aborted || attempts>=48){results.push({store:store.name,status:"deferred",productId:source.productId});continue;}
        attempts++;
        try{
          const result=await checkSource(store, source, existing, force,deadline,canonicalById.get(source.productId));
          results.push(result);
          if(result.status==='updated'&&'stockStatus' in result&&result.stockStatus==='in_stock'||result.status==='cached')freshPairs.add(pair);
        }catch(error){
          // A failed job-log write or one exhausted merchant must not discard
          // successful prices collected by the other merchants in this request.
          console.warn('Merchant refresh stopped',{store:store.id,message:error instanceof Error?error.message:String(error)});
          results.push({store:store.name,status:'deferred',productId:source.productId});
        }
      }
      if(deadline.aborted||usesCollector(store.id))return;
      if (!sources.some((s) => s.storeId === store.id)) return;
      await lock("shipping:" + store.id, async () => {
        const rule = await one<{ id: string; last_updated: string; rules:string; source_url?:string|null }>(
          "store_shipping_rules",
          { id: "live-" + store.id },
        );
        if (rule && verifiedShippingRule(rule,store.domain))
          return;
        try {
          const shipping = await adapterFor({...store,requestSignal:deadline}).getShippingRules();
          const row = {
            id: "live-" + store.id,
            store_id: store.id,
            rules: JSON.stringify({
              source: "live",
              free_shipping_threshold: shipping.freeShippingThreshold ?? null,
              source_url: shipping.sourceUrl,
            }),
            estimated: 1,
            source_url: shipping.sourceUrl || null,
            last_updated: now(),
          };
          if (rule) await update("store_shipping_rules", row, { id: row.id });
          else await insert("store_shipping_rules", row);
        } catch {
          /* Unknown shipping stays explicitly unknown. */
        }
      });
    }),
  );
  storeResults.forEach((result,index)=>{if(result.status==='rejected'){console.warn('Merchant refresh failed',{store:stores[index].id,message:result.reason instanceof Error?result.reason.message:String(result.reason)});results.push({store:stores[index].name,status:'failed',message:'Bu mağazanın kontrolü tamamlanamadı; diğer mağazaların fiyatları korundu.'});}});
  const rows = results as { status: string }[];
  const checked = rows.filter((r) => r.status === "updated").length,
    cached = rows.filter((r) => r.status === "cached").length,
    failed = rows.filter((r) => r.status === "failed").length,
    retained = rows.filter((r) => r.status === "retained" || r.status==='last_known').length,
    deferred = rows.filter((r) => r.status === "deferred").length;
  const related=rows.filter(row=>row.status==='variant').length;
  const archived=rows.filter(row=>row.status==='archive').length,pending=rows.filter(row=>row.status==='collector_pending').length;
  return {
    demo: false,
    checked,
    cached,
    failed,
    retained,
    deferred,
    related,
    archived,pending,
    total: rows.length,
    results,
    message: `${checked} ${snapshotMode?'arşiv / canlı teklif güncellendi':'canlı teklif güncellendi'}${archived?`, ${archived} toplayıcı arşiv fiyatı gerçek kontrol tarihiyle kullanıldı`:''}${pending?`, ${pending} ürün otomatik toplama sırasında`:''}${related ? `, ${related} benzer isim/model teklifi bulundu` : ""}${cached ? `, ${cached} teklif son ${snapshotMode?'12 saat':'20 dakika'} içinde kontrol edilmişti` : ""}${retained ? `, ${retained} son alınan fiyat gerçek kontrol tarihiyle korundu` : ""}${failed ? `, ${failed} teklif doğrulanamadı` : ""}${deferred ? `. Yenileme sınırına ulaşıldı; ${deferred} bağlantı sonraki kontrolde ele alınabilir` : ""}${snapshotMode?'. Güncel arşiv kullanılır; toplayıcı mağazalarında eksik kayıt sıraya alınır':''}.`,
  };
}
export async function searchLive(query: string) {
  if(await pricePhase()==='B')throw new HttpError(409,'B modunda hazır katalogda arama yapabilirsin. Canlı mağaza araması için A modunu seç.');
  if (query.trim().length < 2)
    throw new HttpError(400, "En az iki karakter yazın.");
  const stores = (await list<Store>("stores")).filter(
    (s) => s.enabled && ["direnc", "robotistan"].includes(s.id)&&!usesCollector(s.id),
  );
  const results = await Promise.allSettled(
    stores.map(async (store) => {
      const found = await adapterFor(store).searchProducts(query),
        ids: string[] = [];
      for (const p of found) {
        const curated = liveSources.find(
          (s) =>
            s.storeId === store.id &&
            new URL(s.path, `https://${store.domain}`).pathname ===
              new URL(p.url).pathname,
        );
        if (curated) {
          if (
            !curated.title.test(p.name) ||
            (p.packageQuantity !== null &&
              p.packageQuantity !== curated.packageQuantity)
          )
            continue;
          await persist(store, p, curated.productId, curated.packageQuantity);
          ids.push(curated.productId);
          continue;
        }
        // Ambiguous bundles remain review-only. Do not group merely similar titles across stores.
        if (
          !p.quantityVerified ||
          (p.packageQuantity === null && /paket|seti|kit|takım/i.test(p.name))
        )
          continue;
        const old = await one<Offer>("store_offers", {
          product_url: p.url,
          source: "live",
        });
        let productId = old?.canonical_product_id;
        if (!productId) {
          productId = id();
          const product: Product = {
            id: productId,
            name: p.name,
            category: "Mağazadan bulunanlar",
            manufacturer: p.manufacturer,
            mpn: p.mpn,
            model: p.model,
            description:
              "Bu kayıt yalnızca bu mağaza ürününü temsil eder. Mağazalar arası eşleştirme yapılmamıştır.",
            image: p.image,
            specifications: p.specifications,
            unit_type: salesUnit(p),
            package_quantity: p.packageQuantity || 1,
            created_at: now(),
          };
          await insert("canonical_products", product);
        }
        await persist(store, p, productId, p.packageQuantity || 1, old);
        ids.push(productId);
      }
      return { store: store.name, productIds: ids };
    }),
  );
  return {
    results: results.map((r, i) =>
      r.status === "fulfilled"
        ? r.value
        : { store: stores[i].name, error: String(r.reason) },
    ),
  };
}
