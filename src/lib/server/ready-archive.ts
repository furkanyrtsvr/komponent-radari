import {ByteCache,boundedText} from '../archive-runtime-bounds';
import {env} from 'cloudflare:workers';
import {binding,one,listIn,HttpError} from './db';
import {archivePreviews} from '../archive-preview';
import {validateSnapshot,snapshotProduct} from '../catalog-snapshot';
import {imagePath,archiveImageKey,contentObject,validateArchiveManifest,type ReadyArchive} from '../ready-archive';
import {merchantPathAliases} from '../merchant-url-aliases';
import {storeCatalog} from '../catalog';
import type {SnapshotRow} from './snapshots';
import {cookies} from 'next/headers';
type BatchRow=SnapshotRow&{batch_id:string;source_id:string;image_key:string;ready:number};
export function archiveBucket(){const bucket=(env as unknown as {BUCKET?:R2Bucket}).BUCKET;if(!bucket)throw new HttpError(503,'Hazır katalog dosya alanı hazırlanıyor.');return bucket;}
export async function activeArchive(){const row=await one<{payload:string}>('catalog_collection_runs',{id:'archive-active'});if(!row)return null;try{return validateArchiveManifest(JSON.parse(row.payload));}catch{return null;}}
export async function publishedArchive(id?:string){const active=await activeArchive();if(!id||id===active?.id)return active;const row=await one<{state:string;manifest:string}>('archive_batches',{id});if(row?.state!=='published'||!row.manifest)return null;return validateArchiveManifest(JSON.parse(row.manifest));}
export async function selectedArchive(){let id:string|undefined;try{id=(await cookies()).get('eub_archive_version')?.value;}catch{}return await publishedArchive(id)||await activeArchive();}
function aliases(raw:string){const u=new URL(raw),bare=u.hostname.replace(/^www\./,''),out:string[]=[];u.hash='';for(const p of u.search?[u.pathname]:merchantPathAliases(bare,u.pathname)){u.pathname=p;u.hostname=bare;out.push(u.href);u.hostname='www.'+bare;out.push(u.href);}return out;}
type SourceIndex={offers:number;prefixLength?:number;shards:Record<string,{file:string;sha256:string;bytes:number;count:number}>};
const objectCache=new ByteCache<any>();let objectTail:Promise<void>=Promise.resolve();
async function checkedObject(file:string,sha:string){const cached=objectCache.get(file);if(cached)return cached;const before=objectTail;let release!:()=>void;objectTail=new Promise<void>(r=>release=r);await before;
 try{const existing=objectCache.get(file);if(existing)return existing;const object=await archiveBucket().get(file);if(!object||object.size>2000000)throw new HttpError(503,'Hazır kayıt dosyası eksik veya çok büyük.');const bytes=await object.arrayBuffer(),hash=[...new Uint8Array(await crypto.subtle.digest('SHA-256',bytes))].map(x=>x.toString(16).padStart(2,'0')).join('');if(hash!==sha)throw new HttpError(503,'Hazır ürün kaydı doğrulanamadı.');const decoded=await boundedText(new Blob([bytes]).stream().pipeThrough(new DecompressionStream('gzip'))),value=JSON.parse(decoded.text);objectCache.set(file,value,decoded.bytes*3);return value;}finally{release();}}
/** One-time migration reads old prepared records directly from R2, not merchants. */
export async function publicationSeed(batch:ReadyArchive,offset:number){
 if(!batch.sourceIndex){const rows=await binding().prepare('SELECT source_id,store_id,url,checked_at,payload,image_key FROM archive_batch_rows WHERE batch_id=? AND ready=1 ORDER BY source_id LIMIT 200 OFFSET ?').bind(batch.id,offset).all();return {rows:rows.results,next:rows.results.length===200?offset+200:null};}
 const index=await checkedObject(batch.sourceIndex.file,batch.sourceIndex.sha256) as SourceIndex;if(index.offers!==batch.offers)throw new HttpError(503,'Eski katalog sayısı uyuşmuyor.');const parts=Object.entries(index.shards).sort(([a],[b])=>a.localeCompare(b)),page=parts.slice(offset,offset+1),rows:BatchRow[]=[];
 for(let i=0;i<page.length;i+=8){const values=await Promise.all(page.slice(i,i+8).map(async([prefix,part])=>{if(part.file!==`catalogs/${batch.id}/snapshots/${prefix}.json.gz`&&!contentObject(part.file,part.sha256))throw new HttpError(503,'Eski kayıt dosyası geçersiz.');const found=await checkedObject(part.file,part.sha256) as BatchRow[];if(found.length!==part.count)throw new HttpError(503,'Eski kayıt parçası eksik.');return found;}));rows.push(...values.flat());}
 return {rows,next:offset+1<parts.length?offset+1:null};
}
export async function fileSnapshotRows(batch:ReadyArchive,urls:string[]){const index=await checkedObject(batch.sourceIndex!.file,batch.sourceIndex!.sha256) as SourceIndex;if(index.offers!==batch.offers)throw new HttpError(503,'Hazır ürün kayıt sayısı uyuşmuyor.');const length=index.prefixLength??3;if(![2,3].includes(length))throw new HttpError(503,'Katalog bölüm biçimi geçersiz.');const addresses=[...new Set(urls.flatMap(aliases))],wanted=new Set(addresses),prefixes=new Set<string>();for(const url of addresses){const bytes=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(url));prefixes.add([...new Uint8Array(bytes)].map(x=>x.toString(16).padStart(2,'0')).join('').slice(0,length));}const rows:BatchRow[]=[];for(const prefix of prefixes){const part=index.shards[prefix];if(!part)continue;if(part.file!==`catalogs/${batch.id}/snapshots/${prefix}.json.gz`&&!contentObject(part.file,part.sha256))throw new HttpError(503,'Hazır ürün dosyası sürümü uyuşmuyor.');const values=await checkedObject(part.file,part.sha256) as BatchRow[];if(values.length!==part.count)throw new HttpError(503,'Hazır ürün parçası eksik.');rows.push(...values.filter(r=>wanted.has(r.url)));}return rows;}
export async function readyRows(urls:string[],id?:string){const batch=id?await publishedArchive(id):await selectedArchive();if(!batch)return {batch:null,rows:[] as BatchRow[]};if(batch.sourceIndex)return {batch,rows:await fileSnapshotRows(batch,urls)};return {batch,rows:await listIn<BatchRow>('archive_batch_rows','url',[...new Set(urls.flatMap(aliases))],{batch_id:batch.id,ready:1})};}
export async function readyPreviews(urls:string[],id?:string){
 const {batch,rows}=await readyRows(urls,id),values=await archivePreviews(urls,storeCatalog,async()=>rows);
 return values.map(p=>{const row=rows.find(r=>aliases(p.url).includes(r.url)&&archiveImageKey(r.image_key));return row&&p.price?{...p,image:imagePath(row.image_key),collectorManaged:false,collectorPending:false,message:'Hazır B kataloğu · yayın: '+batch!.preparedAt+' · gerçek fiyat kontrolü: '+p.checkedAt}:{...p,image:null,price:null,message:'Bu ürün son hazır B kataloğunda bulunmuyor. Canlı okuma için A modunu kullanabilirsin.'};});
}
export async function readyProduct(store:{id:string;domain:string},url:string){
 const {batch,rows}=await readyRows([url]);const row=rows.filter(r=>r.store_id===store.id).sort((a,b)=>b.checked_at.localeCompare(a.checked_at))[0];
 if(!batch||!row||!archiveImageKey(row.image_key))throw new HttpError(409,'Ürün son hazır B kataloğunda yok. B modunda mağaza taraması yapılmaz; A modunu kullanabilirsin.');
 const record=validateSnapshot(JSON.parse(row.payload),storeCatalog,Date.parse(row.checked_at)),p=snapshotProduct(record);
 return {...p,image:imagePath(row.image_key),readWarning:'Hazır B kataloğu · gerçek fiyat kontrolü: '+row.checked_at};
}
export async function readySnapshotSources(urls:string[]){const {rows}=await readyRows(urls);return rows.map(r=>{const record=JSON.parse(r.payload);record.product.image=imagePath(r.image_key);return {...r,payload:JSON.stringify(record)};});}
export async function readyCatalogPage(options:{query:string;group:string;store:string;page:number}){
 const batch=await selectedArchive();if(!batch)throw new HttpError(503,'İlk hazır B kataloğu hazırlanıyor. Ürünler hazır olmadan listelenmez.');
 // A packed, immutable catalog is also used by export/check clients. Browser
 // search downloads each compressed chunk once and filters locally.
 const {archivePage}=await import('../archive-discovery');let count=0;const results:any[]=[],previews:any[]=[],offset=options.page*40;
 for(const chunk of batch.chunks){const products=await checkedObject(chunk.file,chunk.sha256) as any[];for(const product of products){const item=archivePage([product],{...options,page:0});if(!item.count)continue;if(count>=offset&&results.length<40){results.push(...item.results);previews.push(...item.previews);}count++;}}
 return {results,previews,count,hasMore:count>offset+40,batch};
}
