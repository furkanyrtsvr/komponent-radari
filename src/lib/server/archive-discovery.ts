import {list,pages,binding,isSupabase} from './db';
import {archiveModelQuery,ARCHIVE_MODEL_ROWS_SQL} from '../archive-model-query';
import type {Store} from '../domain';
import type {SnapshotRow} from './snapshots';
import {archivePreviews} from '../archive-preview';
import {archiveProducts,archivePage,type ArchiveProduct} from '../archive-discovery';
import {catalogMetadataImages} from './catalog-metadata';
import {enrichCatalogPreview} from '../catalog-metadata';
import {addressAliases} from './snapshots';
const cache=new Map<string,{at:number;value:Promise<ArchiveProduct[]>}>();
async function* snapshotRows(model:string){
 if(!model||isSupabase()){yield* pages<SnapshotRow>('catalog_snapshots');return;}
 let cursor='';
 for(;;){const rows=(await binding().prepare(ARCHIVE_MODEL_ROWS_SQL).bind(cursor,'%'+model+'%','%'+model+'%').all<SnapshotRow&{id:string}>()).results;if(!rows.length)return;yield rows;cursor=rows.at(-1)!.id;if(rows.length<500)return;}
}
async function inventory(model:string){
 const [stores,metadata]=await Promise.all([list<Store>('stores'),catalogMetadataImages()]),items:{storeId:string;preview:Awaited<ReturnType<typeof archivePreviews>>[number]}[]=[];
 for await(const batch of snapshotRows(model)){
  const valid=batch.filter(row=>{try{const u=new URL(row.url);return stores.some(s=>s.enabled&&s.id===row.store_id&&s.domain.replace(/^www\./,'')===u.hostname.replace(/^www\./,''))&&u.protocol==='https:'&&!u.username&&!u.password&&!u.port;}catch{return false;}});
  for(let i=0;i<valid.length;i+=120){
   const rows=valid.slice(i,i+120),previews=await archivePreviews(rows.map(r=>r.url),stores,async()=>rows);
   for(const preview of previews){const row=rows.find(r=>r.url===preview.url)!,image=metadata.find(m=>m.store_id===row.store_id&&addressAliases(preview.url).includes(m.url));let next=preview;try{if(image)next=enrichCatalogPreview(preview,JSON.parse(image.metadata),stores);}catch{/* Preserve the price observation if image metadata is invalid. */}items.push({storeId:row.store_id,preview:next});}
  }
 }
 return archiveProducts(items);
}
export async function discoverArchive(options:Parameters<typeof archivePage>[1]){
 const key=archiveModelQuery(options.query);let entry=cache.get(key);
 if(!entry||Date.now()-entry.at>60000){if(cache.size>=4)cache.delete(cache.keys().next().value!);const value=inventory(key);entry={at:Date.now(),value};cache.set(key,entry);void value.then(()=>{if(cache.get(key)?.value===value)cache.get(key)!.at=Date.now();},()=>{if(cache.get(key)?.value===value)cache.delete(key);});}
 return archivePage(await entry.value,options);
}
