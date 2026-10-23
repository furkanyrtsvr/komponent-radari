import {salesUnit,unitConflict} from '../sales-unit';
import { id, now, type Product, type Offer, type Store } from "../domain";
import { canMergeCatalogProducts, jumperDetails,matchesCatalogRequirement,variantConflict } from "../catalog-identity";
import {nameMatchScore,ascii,productEvidence,evidenceAttributeConflict} from '../../../public/catalog/product-identity.js';
import { list, pages, one, insert, update, HttpError } from "./db";
import { adapterFor } from "../../stores/registry";
import {readProduct,pricePhase} from './snapshots';
import { persist } from "./live";
import { mergeCanonical } from "./admin";
import { liveSources } from "../../stores/live-catalog";
import { isRetryableStoreError } from "../../stores/base";
import { isFresh } from "../pricing";
import type {ExtractedProduct} from "../../stores/types";

const categories = new Set(["Geliştirme Kartları", "Butonlar", "Kablolar", "Sensörler", "Dirençler", "Kondansatörler", "Entegreler", "Modüller", "Motorlar", "Güç ve Pil", "Bağlantı Elemanları", "Ölçüm ve Test", "Diğer"]);
export async function importCatalogProduct(url: string, requestedCategory: string, targetProductId?: string) {
  const parsed = new URL(url);
  const stores = await list<Store>("stores");
  const store = stores.find(s => s.enabled && s.domain.replace(/^www\./, "") === parsed.hostname.replace(/^www\./, ""));
  if (!store || parsed.protocol !== "https:") throw new HttpError(400, "Desteklenen mağazanın HTTPS ürün bağlantısı gerekli.");
  const previousOffer = await one<Offer>("store_offers", { product_url: url, source: "live" });
  const adapter = adapterFor(store);
  let p;
  try { p = await readProduct(store,url); }
  catch (error) {
    if(previousOffer && isRetryableStoreError(error) && isFresh(previousOffer)) {
      const product=await one<Product>("canonical_products",{id:previousOffer.canonical_product_id});
      const target=targetProductId ? await one<Product>("canonical_products",{id:targetProductId}) : undefined;
      if(product && canMergeCatalogProducts(product,{name:previousOffer.title,manufacturer:previousOffer.manufacturer}) && (!targetProductId || target && canMergeCatalogProducts(target,product))) {
        if(target && target.id!==product.id) await mergeCanonical(product.id,target.id);
        return {product:target||product,offer:{...previousOffer,canonical_product_id:target?.id||product.id},verified:true,store:store.name,retained:true,sourceWarning:undefined};
      }
    }
    if (previousOffer && await pricePhase()!=='B' && !isRetryableStoreError(error)) await update("store_offers", {last_error:error instanceof Error ? error.message : "Mağaza okunamadı."}, {id:previousOffer.id});
    if (!adapter.getCatalogProduct) throw error;
    try{p = await adapter.getCatalogProduct(url);}
    catch(error){throw new HttpError(502,error instanceof Error?error.message:'Mağaza ürün sayfasına şu anda ulaşılamıyor.');}
  }
  return saveCatalogProduct(store,p,requestedCategory,targetProductId);
}
/** Only called with a page already read by a trusted store adapter. */
export async function saveCatalogProduct(store:Store,p:ExtractedProduct,requestedCategory:string,targetProductId?:string){
  const previous=await one<{raw_data:string}>("store_products",{store_id:store.id,url:p.url});
  const previousOffer=await one<Offer>("store_offers",{store_id:store.id,product_url:p.url,source:"live"});
  const previousId=previousOffer?.canonical_product_id || (previous && JSON.parse(previous.raw_data).catalogProductId as string | undefined);
  const previousProduct = previousId ? await one<Product>("canonical_products", { id: previousId }) : undefined;
  const targetProduct = targetProductId ? await one<Product>("canonical_products", { id: targetProductId }) : undefined;
  const provisional=Boolean(previousProduct&&!previousOffer&&previous&&JSON.parse(previous.raw_data).quantityVerified!==true&&nameMatchScore(previousProduct,p)>=0.65&&!variantConflict(previousProduct,p));
  const descriptionUpgrade=Boolean(previousProduct&&ascii(previousProduct.name)===ascii(p.name)&&previousProduct.package_quantity===(p.packageQuantity||1)&&productEvidence(p).descriptionConfirmed&&!productEvidence(previousProduct).descriptionConfirmed&&!evidenceAttributeConflict(previousProduct,p));
  if (previousProduct && (!matchesCatalogRequirement(previousProduct,p)&&!(salesUnit(p)==='metre'&&previousProduct.unit_type==='adet'&&ascii(previousProduct.name)===ascii(p.name))) && !provisional&&!descriptionUpgrade)
    throw new HttpError(400, "Mağaza bağlantısındaki ürün değişmiş; eski ürüne bağlanamaz.");
  if((provisional||descriptionUpgrade)&&previousProduct){
    const facts={name:p.name,manufacturer:p.manufacturer,mpn:p.mpn,model:p.model,image:p.image,specifications:p.specifications,package_quantity:p.packageQuantity||1,unit_type:jumperDetails(p.name)?'set':salesUnit(p)};
    await update('canonical_products',facts,{id:previousProduct.id});Object.assign(previousProduct,facts);
  }
  if (targetProductId && !targetProduct) throw new HttpError(404, "Birleştirilecek ürün bulunamadı.");
  if (targetProduct && (!canMergeCatalogProducts(targetProduct,p)||unitConflict(targetProduct,p)))
    throw new HttpError(400, "Farklı model veya ürün tipi aynı karta birleştirilemez.");
  if (targetProduct && previousProduct && previousProduct.id !== targetProduct.id)
    await mergeCanonical(previousProduct.id, targetProduct.id);
  const matching:Product[]=[];
  if(!targetProduct) for await(const candidates of pages<Product>("canonical_products"))
    matching.push(...candidates.filter(c => c.package_quantity === (p.packageQuantity || 1) && canMergeCatalogProducts(c,p)));
  const reviewed = matching.find(c=>liveSources.some(s=>s.productId===c.id));
  const existing = targetProduct || reviewed || previousProduct;
  if (reviewed && previousProduct && !targetProduct && reviewed.id !== previousProduct.id)
    await mergeCanonical(previousProduct.id,reviewed.id);
  const product = existing || (matching.length === 1 ? matching[0] : {
    id: id(), name: p.name, category: categories.has(requestedCategory) ? requestedCategory : "Diğer",
    manufacturer: p.manufacturer, mpn: p.mpn, model: p.model,
    description: p.price===null ? "Katalog bağlantısından ürün ihtiyacı eklendi; fiyat ve stok henüz doğrulanmadı." : "Mağaza ürün sayfasından alındı; fiyat ve stok doğrulama durumuna göre kullanılır.",
    image: p.image, specifications: p.specifications,
    unit_type: jumperDetails(p.name) ? "set" : salesUnit(p), package_quantity: p.packageQuantity || 1, created_at: now(),
  } satisfies Product);
  if (!existing && matching.length !== 1) await insert("canonical_products", product);
  // Refresh the original merchant's name evidence as well as its price.
  // A differently named counterpart must retain its own scoped description.
  if(ascii(product.name)===ascii(p.name)&&product.specifications!==p.specifications){product.specifications=p.specifications;await update('canonical_products',{specifications:p.specifications},{id:product.id});}
  if (p.image && !product.image) { product.image = p.image; await update("canonical_products", {image:p.image}, {id:product.id}); }
  if (jumperDetails(p.name)) {
    product.unit_type = "set"; product.package_quantity = 1;
    await update("canonical_products", {unit_type:"set",package_quantity:1}, {id:product.id});
  }
  if(salesUnit(product)!==salesUnit(p)&&salesUnit(p)==='metre'){
    product.unit_type='metre';await update('canonical_products',{unit_type:'metre'}, {id:product.id});
  }
  const verified = p.price !== null && p.price > 0 && p.currency === "TRY" && p.vatIncluded === true && p.quantityVerified === true;
  let offer: Offer | undefined;
  if (verified) offer = await persist(store, p, product.id, p.packageQuantity || 1);
  else {
    if (previousOffer && await pricePhase()!=='B') await update("store_offers", {last_error:"Fiyat, KDV veya satış birimi doğrulanamadı."}, {id:previousOffer.id});
    const row = await one<{ id: string }>("store_products", { store_id: store.id, url: p.url });
    const record = { id: row?.id || id(), store_id: store.id, url: p.url,
      title: p.name, mpn: p.mpn, raw_data: JSON.stringify({ ...p, catalogProductId: product.id }) };
    await insert("store_products", record, true);
    await update("store_products", record, { id: record.id });
  }
  return { product, offer, verified, store: store.name,sourceWarning:verified ? p.readMethod==='snapshot'?'Kayıtlı fiyat kullanıldı; son kontrol: '+p.checkedAt:undefined : p.warnings.join(' ') };
}

export async function importCatalogBundle(urls: string[], requestedCategory: string) {
  const unique = [...new Set(urls)].filter((url,index,all)=>all.findIndex(other=>new URL(other).hostname===new URL(url).hostname)===index).slice(0,14);
  let anchor: Awaited<ReturnType<typeof importCatalogProduct>> | undefined;
  const imported: Awaited<ReturnType<typeof importCatalogProduct>>[] = [];
  const errors: string[] = [];
  for (const url of unique) {
    try {
      const result = await importCatalogProduct(url, requestedCategory, anchor?.product.id);
      anchor ||= result;
      imported.push(result);
    } catch (error) {
      errors.push(`${new URL(url).hostname}: ${error instanceof Error ? error.message : "Ürün okunamadı."}`);
    }
  }
  if (!anchor) throw new HttpError(502, errors[0] || "Mağaza ürünleri okunamadı.");
  return {
    product: anchor.product,
    verified: imported.some((entry) => entry.verified),
    stores: imported.map((entry) => entry.store),
    verifiedStores: imported.filter((entry) => entry.verified).map((entry) => entry.store),
    errors,
  };
}
