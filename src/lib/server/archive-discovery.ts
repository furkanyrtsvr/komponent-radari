import {list,pages} from './db';
import type {Store} from '../domain';
import type {SnapshotRow} from './snapshots';
import {archivePreviews} from '../archive-preview';
import {archiveProducts,archivePage,type ArchiveProduct} from '../archive-discovery';
import {catalogMetadataImages} from './catalog-metadata';
import {enrichCatalogPreview} from '../catalog-metadata';
import {addressAliases} from './snapshots';
let cache:{at:number;value:Promise<ArchiveProduct[]>}|undefined;
async function inventory(){
 const [stores,metadata]=await Promise.all([list<Store>('stores'),catalogMetadataImages()]),items:{storeId:string;preview:Awaited<ReturnType<typeof archivePreviews>>[number]}[]=[];
 for await(const batch of pages<SnapshotRow>('catalog_snapshots')){
  const valid=batch.filter(row=>{try{const u=new URL(row.url);return stores.some(s=>s.enabled&&s.id===row.store_id&&s.domain.replace(/^www\./,'')===u.hostname.replace(/^www\./,''))&&u.protocol==='https:'&&!u.username&&!u.password&&!u.port;}catch{return false;}});
  for(let i=0;i<valid.length;i+=120){
   const rows=valid.slice(i,i+120),previews=await archivePreviews(rows.map(r=>r.url),stores,async()=>rows);
   for(const preview of previews){const row=rows.find(r=>r.url===preview.url)!,image=metadata.find(m=>m.store_id===row.store_id&&addressAliases(preview.url).includes(m.url));let next=preview;try{if(image)next=enrichCatalogPreview(preview,JSON.parse(image.metadata),stores);}catch{/* Preserve the price observation if image metadata is invalid. */}items.push({storeId:row.store_id,preview:next});}
  }
 }
 return archiveProducts(items);
}
export async function discoverArchive(options:Parameters<typeof archivePage>[1]){
 if(!cache||Date.now()-cache.at>60000){const value=inventory();cache={at:Date.now(),value};void value.catch(()=>{if(cache?.value===value)cache=undefined;});}
 return archivePage(await cache.value,options);
}
