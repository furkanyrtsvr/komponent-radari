import type {DatabaseSync} from 'node:sqlite';
import {archivePreviews} from '../../src/lib/archive-preview';
import {imagePath} from '../../src/lib/ready-archive';
import {storeCatalog} from '../../src/lib/catalog';
import {reusableImage} from './archive-image-queue';
import {partition} from './incremental-state';

/** Image preparation must never gate a verified price. This table is temporary:
 * the full catalog lives in R2, not in another permanent D1/SQLite price copy. */
export async function preparePriceCatalog(db:DatabaseSync,cutoff:string){
 db.exec('CREATE TABLE IF NOT EXISTS price_views(source_id TEXT PRIMARY KEY,fingerprint TEXT NOT NULL,view TEXT NOT NULL)');
 db.exec('DROP TABLE IF EXISTS temp.priced_catalog; CREATE TEMP TABLE priced_catalog(canonical_key TEXT PRIMARY KEY,source_id TEXT,store_id TEXT,checked_at TEXT,part TEXT,source_part TEXT,entry TEXT NOT NULL); CREATE INDEX temp.priced_part ON priced_catalog(part); CREATE INDEX temp.priced_source_part ON priced_catalog(source_part)');
 const imageFor=db.prepare('SELECT key,bytes,original_bytes FROM images WHERE url=?');
 const put=db.prepare('INSERT INTO priced_catalog VALUES(?,?,?,?,?,?,?) ON CONFLICT(canonical_key) DO UPDATE SET source_id=excluded.source_id,store_id=excluded.store_id,checked_at=excluded.checked_at,part=excluded.part,source_part=excluded.source_part,entry=excluded.entry WHERE excluded.checked_at>=priced_catalog.checked_at');
 const cachedView=db.prepare('SELECT view FROM price_views WHERE source_id=? AND fingerprint=?'),saveView=db.prepare('INSERT OR REPLACE INTO price_views VALUES(?,?,?)');
 let rejected=0,reused=0,validated=0,processed=0;
 db.exec('BEGIN');try{
 for(const observation of db.prepare('SELECT source_id,store_id,url,checked_at,payload,fingerprint,ready FROM observations ORDER BY source_id').iterate() as Iterable<any>){
  if(observation.store_id==='ozdisan')continue;
  const previous=observation.ready?JSON.parse(observation.ready):null;
  let accepted=false;
  // Preserve the last verified observation if a newer row fails validation.
  for(const row of [observation,previous].filter(Boolean)){
   if(Date.parse(row.checked_at)>Date.parse(cutoff))continue;
   const hit=cachedView.get(row.source_id,row.fingerprint) as {view:string}|undefined;
   let preview:any,sourceImage:string|null;
   if(hit){const view=JSON.parse(hit.view);preview=view.preview;sourceImage=view.sourceImage;reused++;}
   else{[preview]=await archivePreviews([row.url],storeCatalog,async()=>[row],Date.parse(cutoff));sourceImage=preview.image;validated++;}
   if(!preview.price||!preview.key)continue;
   if(!hit)saveView.run(row.source_id,row.fingerprint,JSON.stringify({preview,sourceImage}));
   const cached=sourceImage?imageFor.get(sourceImage) as any:undefined;
   const old=previous?.fingerprint===row.fingerprint?{key:previous.image_key,bytes:previous.bytes,original_bytes:previous.original_bytes}:undefined;
   const image=reusableImage(cached)?cached:reusableImage(old)?old:null;
   const entry={source_id:row.source_id,store_id:row.store_id,url:row.url,checked_at:row.checked_at,payload:row.payload,fingerprint:row.fingerprint,image_key:image?.key||null,bytes:image?.bytes||0,original_bytes:image?.original_bytes||0,preview:{...preview,image:image?imagePath(image.key):null,imagePending:!image}};
   put.run(row.store_id+':'+(preview.canonicalUrl||row.url),row.source_id,row.store_id,row.checked_at,partition(preview.key),partition(row.url),JSON.stringify(entry));accepted=true;break;
  }
  if(!accepted)rejected++;
  if(++processed%500===0)db.exec('COMMIT; BEGIN');
 }
 db.exec('COMMIT');}catch(error){db.exec('ROLLBACK');throw error;}
 const count=Number((db.prepare('SELECT COUNT(*) n FROM priced_catalog').get() as any).n);
 return {count,rejected,reused,validated,parts:(kind:'part'|'source_part')=>(db.prepare('SELECT DISTINCT '+kind+' value FROM priced_catalog ORDER BY '+kind).all() as {value:string}[]).map(r=>r.value),rows:(kind:'part'|'source_part',part:string)=>(db.prepare('SELECT entry FROM priced_catalog WHERE '+kind+'=? ORDER BY source_id').all(part) as {entry:string}[]).map(r=>JSON.parse(r.entry))};
}

/** Bound decoded chunk size as well as row count. The browser loads a small
 * number of immutable files once; opening a product never fetches a merchant. */
export function* packCatalogProducts(groups:Iterable<any[]>,limit=5*1024*1024){let rows:any[]=[],bytes=2;for(const group of groups)for(const product of group){const size=Buffer.byteLength(JSON.stringify(product))+1;if(size>limit)throw Error('Tek ürün güvenli katalog boyutunu aşıyor.');if(rows.length&&(bytes+size>limit||rows.length>=4000)){yield rows;rows=[];bytes=2;}rows.push(product);bytes+=size;}if(rows.length)yield rows;}
