import {adapterFor} from '../../stores/registry';
import type {ExtractedProduct,StoreConfig} from '../../stores/types';
import {one,listIn,binding,isSupabase,supabase} from './db';
import {cookies} from 'next/headers';
import {LIVE_TTL_MS} from '../pricing';
import {snapshotProduct,snapshotUsable,SNAPSHOT_TTL_MS,validateSnapshot,SNAPSHOT_UPSERT_SQL,upgradeSnapshotReader,type SnapshotRecord} from '../catalog-snapshot';
import type {Offer} from '../domain';
import {safeStoreUrl} from '../../stores/base';
import {matchesCatalogRequirement} from '../catalog-identity';
export async function pricePhase(){try{return (await cookies()).get('eub_price_phase')?.value==='B'?'B':'A';}catch{return 'A';}}
export type SnapshotRow={id:string;store_id:string;url:string;checked_at:string;payload:string};
/** Write through actual page observations; a cache read never advances its date. */
export async function saveSnapshot(record:SnapshotRecord){
 const url=new URL(record.product.url);url.hash='';
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
   const url=new URL(record.product.url);url.hash='';
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
 const row=await one<SnapshotRow>('catalog_snapshots',{store_id:store.id,url:address.href});
 if(!row||!snapshotUsable(row.checked_at,maxAge))return undefined;
 const original=JSON.parse(row.payload) as SnapshotRecord;
 const record=upgradeSnapshotReader(original);if(!record)return undefined;
 if(record!==original)await saveSnapshot(record);
 return snapshotProduct(record);
}
export async function readProduct(store:StoreConfig,url:string,force=false):Promise<ExtractedProduct>{
 const phase=await pricePhase();
 if(!force){
  const cached=await readSnapshot(store,url,phase==='B'?SNAPSHOT_TTL_MS:LIVE_TTL_MS);
  if(cached)return cached;
 }
 try{return await rememberProduct(store,await adapterFor(store).getProduct(url));}catch(error){
  const cached=await readSnapshot(store,url,Infinity);
  if(cached)return cached;
  throw error;
 }
}
export async function phaseOffers(offers:Offer[]){
 const phase=await pricePhase();
 const snapshots=new Map((await snapshotSources(offers.filter(o=>o.source==='live').map(o=>o.product_url))).map(row=>[row.store_id+':'+row.url,row]));
 return offers.map(offer=>{
  const row=snapshots.get(offer.store_id+':'+offer.product_url);
  const record=row?upgradeSnapshotReader(JSON.parse(row.payload)):undefined;
  const corrected=!['robotzade','robitshop'].includes(offer.store_id)||Boolean(record);
  let next=corrected?offer:{...offer,last_error:'Satış adımı yeniden kontrol edilmeli.'};
  if(corrected && row && row.checked_at>=offer.last_checked_at && snapshotUsable(row.checked_at,Infinity)){
   const p=record!.product;
   if(matchesCatalogRequirement({name:offer.title,manufacturer:offer.manufacturer,specifications:offer.specifications},p))next={...offer,title:p.name,specifications:p.specifications,price_gross:p.price,price_net:p.priceNet??p.price,unit_price:Math.round(p.price/p.packageQuantity),package_quantity:p.packageQuantity,minimum_order_quantity:p.minimumOrderQuantity,order_step:p.orderStep,price_tiers:JSON.stringify(p.priceTiers||[]),stock_status:p.stockStatus,stock_quantity:p.stockQuantity,image_url:p.image,last_checked_at:row.checked_at,last_error:null};
  }
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
 }else totals=(await binding().prepare('SELECT COUNT(*) AS verified,COALESCE(SUM(checked_at>? AND checked_at<=?),0) AS fresh,MAX(checked_at) AS lastCheckedAt FROM catalog_snapshots').bind(since,at).first()) as typeof totals;
 return {phase:await pricePhase(),...totals,ttlHours:12};
}
export async function snapshotSources(urls:string[]){return listIn<SnapshotRow>('catalog_snapshots','url',urls);}
