import {adapterFor} from '../../stores/registry';
import type {ExtractedProduct,StoreConfig} from '../../stores/types';
import {one,listIn,binding,isSupabase,supabase,config} from './db';
import {storeCatalog} from '../catalog';
import {cookies} from 'next/headers';
import {LIVE_TTL_MS} from '../pricing';
import {snapshotProduct,snapshotUsable,SNAPSHOT_TTL_MS,validateSnapshot,SNAPSHOT_UPSERT_SQL,SNAPSHOT_TRUST_SQL,upgradeSnapshotReader,type SnapshotRecord} from '../catalog-snapshot';
import type {Offer} from '../domain';
import {safeStoreUrl,canRetainObservedProduct} from '../../stores/base';
import {matchesCatalogRequirement} from '../catalog-identity';
import {usesCollector,COLLECTOR_TTL_MS,collectorLabel,CollectorReadError} from '../collector-routing';
import {requestCollectorRefresh,collectorRequestStatus} from './collector-requests';
import {canonicalMerchantPath,merchantPathAliases} from '../merchant-url-aliases';
export async function pricePhase(){try{return (await cookies()).get('eub_price_phase')?.value==='B'?'B':'A';}catch{return 'A';}}
export type SnapshotRow={id:string;store_id:string;url:string;checked_at:string;payload:string};
export function addressAliases(raw:string){const u=new URL(raw),bare=u.hostname.replace(/^www\./,'');u.hash='';const values:string[]=[];for(const path of u.search?[u.pathname]:merchantPathAliases(bare,u.pathname)){u.pathname=path;u.hostname=bare;values.push(u.href);u.hostname='www.'+bare;values.push(u.href);}return [...new Set(values)];}
function canonicalAddress(raw:string,storeId:string){const domain=storeCatalog.find(s=>s.id===storeId)?.domain;const u=new URL(raw);if(domain)u.hostname=domain;if(!u.search)u.pathname=canonicalMerchantPath(u.hostname,u.pathname);u.hash='';return u.href;}
/** Write through actual page observations; a cache read never advances its date. */
export async function saveSnapshot(record:SnapshotRecord){
 const url=new URL(record.requestedUrl||record.product.url);url.hash='';
 const row={id:crypto.randomUUID(),store_id:record.storeId,url:url.href,checked_at:record.checkedAt,payload:JSON.stringify(record)};
 if(isSupabase()){
  const {data,error}=await supabase().rpc('eub_save_catalog_snapshot',{snapshot:row});if(error)throw error;return Boolean(data);
 }else {const result=await binding().prepare(SNAPSHOT_UPSERT_SQL).bind(row.id,row.store_id,row.url,row.checked_at,row.payload).run();return result.meta.changes>0;}
}
/** One atomic database batch avoids a network round trip for every collected page. */
export async function saveSnapshots(records:SnapshotRecord[]){
 if(isSupabase()){let saved=0;for(const record of records)if(await saveSnapshot(record))saved++;return {saved,ignored:records.length-saved};}
 let saved=0;
 for(let offset=0;offset<records.length;offset+=50){
  const statements=records.slice(offset,offset+50).map(record=>{
   const url=new URL(record.requestedUrl||record.product.url);url.hash='';
   return binding().prepare(SNAPSHOT_UPSERT_SQL).bind(crypto.randomUUID(),record.storeId,url.href,record.checkedAt,JSON.stringify(record));
  });
  const results=await binding().batch(statements);saved+=results.filter(r=>r.meta.changes>0).length;
 }
 return {saved,ignored:records.length-saved};
}
async function rememberProduct(store:StoreConfig,product:ExtractedProduct){
 const pack=product.packageQuantity||1;
 const url=safeStoreUrl(product.url,store.domain);url.hostname=store.domain;url.hash='';
 const checkedAt=product.checkedAt||new Date().toISOString();
 const p={...product,url:url.href,checkedAt};
 if(p.price && p.currency==='TRY' && p.vatIncluded===true && p.quantityVerified){
  const record=validateSnapshot({readerRevision:2,storeId:store.id,checkedAt,product:{...p,packageQuantity:pack,minimumOrderQuantity:p.minimumOrderQuantity||pack,orderStep:p.orderStep||pack,image:p.image?.startsWith('https://')?p.image:null}},[store]);
  await saveSnapshot(record);
 }
 return p;
}
export async function readSnapshot(store:StoreConfig,url:string,maxAge:number) {
 const address=safeStoreUrl(url,store.domain);address.hostname=store.domain;address.hash='';
 if(!address.search)address.pathname=canonicalMerchantPath(address.hostname,address.pathname);
 const row=(await listIn<SnapshotRow>('catalog_snapshots','url',addressAliases(address.href))).filter(r=>r.store_id===store.id).sort((a,b)=>b.checked_at.localeCompare(a.checked_at))[0];
 if(!row||!snapshotUsable(row.checked_at,maxAge))return undefined;
 const original=JSON.parse(row.payload) as SnapshotRecord;
 const record=upgradeSnapshotReader(original);if(!record)return undefined;
 if(record!==original)await saveSnapshot(record);
 return snapshotProduct({...record,product:{...record.product,url:address.href}});
}
export async function readProduct(store:StoreConfig,url:string,force=false):Promise<ExtractedProduct>{
 const phase=await pricePhase();
 if(usesCollector(store.id)){
  const cached=await readSnapshot(store,url,COLLECTOR_TTL_MS);
  const job=force||!cached?await requestCollectorRefresh(store,url):undefined;
  const pending=job?.status==='collector_pending';
  if(cached)return {...cached,collectorManaged:true,collectorPending:pending,readWarning:collectorLabel(cached.checkedAt!)+(pending?' · yenileme sırada':'')};
  throw new CollectorReadError(pending?'Otomatik toplayıcıya yenileme isteği gönderildi; doğrulanmış fiyat bekleniyor.':job?.error?'Toplayıcı fiyatı doğrulayamadı: '+job.error:'Toplayıcıdan doğrulanmış fiyat bekleniyor.',pending);
 }
 if(!force){
  const cached=await readSnapshot(store,url,phase==='B'?SNAPSHOT_TTL_MS:LIVE_TTL_MS);
  if(cached)return cached;
 }
 try{return await rememberProduct(store,await adapterFor(store).getProduct(url));}catch(error){
  if(!canRetainObservedProduct(error))throw error;
  const cached=await readSnapshot(store,url,Infinity);
  if(cached)return {...cached,readWarning:'Canlı yenileme başarısız; kayıtlı fiyatın kontrol tarihi korunuyor. '+(error instanceof Error?error.message:'Mağaza okunamadı.')};
  throw error;
 }
}
export async function phaseOffers(offers:Offer[]){
 const phase=await pricePhase();
 const snapshots=new Map((await snapshotSources(offers.filter(o=>o.source==='live').map(o=>o.product_url))).sort((a,b)=>a.checked_at.localeCompare(b.checked_at)).map(row=>[row.store_id+':'+canonicalAddress(row.url,row.store_id),row]));
 return offers.map(offer=>{
  const row=snapshots.get(offer.store_id+':'+canonicalAddress(offer.product_url,offer.store_id));
  const record=row?upgradeSnapshotReader(JSON.parse(row.payload)):undefined;
  const corrected=!row||Boolean(record);
  let next=corrected?offer:{...offer,last_error:'Satış adımı yeniden kontrol edilmeli.'};
  if(corrected && row && (row.checked_at>offer.last_checked_at||row.checked_at===offer.last_checked_at&&!offer.last_error) && snapshotUsable(row.checked_at,Infinity)){
   const p=record!.product;
   if(matchesCatalogRequirement({name:offer.title,manufacturer:offer.manufacturer,specifications:offer.specifications,unit_type:offer.unit_type},p))next={...offer,unit_type:p.unitType,title:p.name,specifications:p.specifications,price_gross:p.price,price_net:p.priceNet??p.price,unit_price:Math.round(p.price/p.packageQuantity),package_quantity:p.packageQuantity,minimum_order_quantity:p.minimumOrderQuantity,order_step:p.orderStep,price_tiers:JSON.stringify(p.priceTiers||[]),stock_status:p.stockStatus,stock_quantity:p.stockQuantity,image_url:p.image,last_checked_at:row.checked_at,last_error:null};
  }
  if(usesCollector(offer.store_id))return {...next,price_source:'collector' as const,snapshot_max_age_ms:COLLECTOR_TTL_MS,...(!row?{last_error:'Toplayıcıdan doğrulanmış fiyat bekleniyor.'}:{})};
  return phase==='B'?{...next,snapshot_max_age_ms:SNAPSHOT_TTL_MS}:next;
 });
}
export async function snapshotStatus(){
 const at=new Date().toISOString(),since=new Date(Date.now()-SNAPSHOT_TTL_MS).toISOString();
 let totals:{verified:number;fresh:number;lastCheckedAt:string|null};
 if(isSupabase()){
  const client=supabase();const [all,fresh,last]=await Promise.all([client.from('catalog_snapshots').select('id',{count:'exact',head:true}),client.from('catalog_snapshots').select('id',{count:'exact',head:true}).gt('checked_at',since).lte('checked_at',at),client.from('catalog_snapshots').select('checked_at').order('checked_at',{ascending:false}).limit(1)]);
  if(all.error||fresh.error||last.error)throw all.error||fresh.error||last.error;
  totals={verified:all.count||0,fresh:fresh.count||0,lastCheckedAt:last.data?.[0]?.checked_at||null};
 }else totals=(await binding().prepare(`SELECT COUNT(*) AS verified,COALESCE(SUM(checked_at>? AND checked_at<=?),0) AS fresh,MAX(checked_at) AS lastCheckedAt FROM catalog_snapshots WHERE ${SNAPSHOT_TRUST_SQL}`).bind(since,at).first()) as typeof totals;
 const collector=await one<{updated_at:string;payload:string}>('catalog_collection_runs',{id:'latest'});
 const perStore=isSupabase() ? [] : await binding().prepare(`SELECT store_id,COUNT(*) AS verified,SUM(checked_at>? AND checked_at<=?) AS fresh,MAX(checked_at) AS lastCheckedAt FROM catalog_snapshots WHERE ${SNAPSHOT_TRUST_SQL} GROUP BY store_id`).bind(since,at).all();
 return {phase:await pricePhase(),...totals,ttlHours:12,requests:await collectorRequestStatus(),collectorConfigured:config('CATALOG_INGEST_SECRET').length>=32,collector:collector?{updatedAt:collector.updated_at,...JSON.parse(collector.payload)}:null,stores:storeCatalog.map(store=>({id:store.id,name:store.name,updateMethod:usesCollector(store.id)?'collector':'direct',...(!Array.isArray(perStore)?perStore.results.find((row:any)=>row.store_id===store.id)||{}:{})}))};
}
export async function snapshotSources(urls:string[]){return listIn<SnapshotRow>('catalog_snapshots','url',[...new Set(urls.flatMap(addressAliases))]);}
