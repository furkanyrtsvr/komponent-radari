import {assetPage,ARCHIVE_READY_PAGE,ARCHIVE_PAYLOAD_PAGE} from '@/lib/archive-runtime-bounds';
import {z} from 'zod';
import {authorizeCollector} from '@/lib/server/collector-auth';
import {binding,one,HttpError} from '@/lib/server/db';
import {archiveBucket,publishedArchive,publicationSeed} from '@/lib/server/ready-archive';
import {archiveImageKey,validateArchiveManifest} from '@/lib/ready-archive';
import {validateSnapshot,upgradeSnapshotReader} from '@/lib/catalog-snapshot';
import {storeCatalog} from '@/lib/catalog';
import {COPY_ARCHIVE_BATCH_SQL,COPY_ARCHIVE_DELTA_SQL,ACTIVATE_ARCHIVE_SQL} from '@/lib/archive-batch-sql';
export const dynamic='force-dynamic';
const uuid=z.string().uuid();
function failure(e:unknown){return Response.json({error:e instanceof Error?e.message:'Katalog hazırlanamadı.'},{status:e instanceof HttpError?e.status:400});}
export async function GET(request:Request){try{
 authorizeCollector(request);const params=new URL(request.url).searchParams,cursor=params.get('cursor')||'';
 if(params.has('seed')){const base=uuid.parse(params.get('base')),offset=z.coerce.number().int().min(0).max(1000000).parse(cursor||0),batch=await publishedArchive(base);if(!batch)throw new HttpError(404,'Eski hazır katalog bulunamadı.');return Response.json(await publicationSeed(batch,offset));}
 if(params.has('imageKey')){const key=z.string().refine(archiveImageKey).parse(params.get('imageKey')),object=await archiveBucket().head(key);if(!object||object.httpMetadata?.contentType!=='image/webp')throw new HttpError(404,'Önceki hazır görsel bulunamadı.');return Response.json({image:{key,bytes:object.size,original_bytes:object.size}});}
 if(params.has('imageUrl')){const url=z.string().url().max(2000).parse(params.get('imageUrl'));let row=await binding().prepare('SELECT image_key AS key,bytes,original_bytes FROM archive_image_cache WHERE url=?').bind(url).first<{key:string;bytes:number;original_bytes:number}>();if(!row){const legacy=await binding().prepare("SELECT image_key AS key FROM archive_batch_rows WHERE ready=1 AND json_extract(payload,'$.product.image')=? LIMIT 1").bind(url).first<{key:string}>();if(legacy)row={...legacy,bytes:0,original_bytes:0};}if(row&&!row.bytes){const o=await archiveBucket().head(row.key);if(o){row.bytes=o.size;row.original_bytes=o.size;await binding().prepare('INSERT OR REPLACE INTO archive_image_cache(bytes,original_bytes,url,image_key) VALUES(?,?,?,?)').bind(row.bytes,row.original_bytes,url,row.key).run();}else return Response.json({image:null});}return Response.json({image:row});}
 if(params.get('images')==='1'){
  const stored=await binding().prepare('SELECT url,image_key AS key,bytes,original_bytes FROM archive_image_cache WHERE url>? ORDER BY url LIMIT 500').bind(cursor).all<{url:string;key:string;bytes:number;original_bytes:number}>();return Response.json({rows:stored.results.filter(r=>r.bytes>0),next:stored.results.length===500?stored.results.at(-1)!.url:null});
 }
 const id=uuid.parse(params.get('id'));
 if(params.has('digests')){const rows=await binding().prepare("SELECT source_id,checked_at,ready,image_key,COALESCE(json_extract(payload,'$.readerRevision'),0) AS revision FROM archive_batch_rows WHERE batch_id=? AND source_id>? ORDER BY source_id LIMIT 1000").bind(id,cursor).all();return Response.json({rows:rows.results,next:rows.results.length===1000?(rows.results.at(-1) as any).source_id:null});}

 const rows=await binding().prepare('SELECT source_id,store_id,url,checked_at,payload FROM archive_batch_rows WHERE batch_id=? AND source_id>? ORDER BY source_id LIMIT 200').bind(id,cursor).all();return Response.json(rows.results);
}catch(e){return failure(e);}}
export async function POST(request:Request){try{
 authorizeCollector(request);const raw=await request.text();if(raw.length>1000000)throw new HttpError(413,'Katalog isteği çok büyük.');const body=JSON.parse(raw);
 if(body.action==='begin'){
  if(body.recover===true&&typeof body.base==='string'){const old=await binding().prepare("SELECT id,cutoff,manifest FROM archive_batches WHERE state='building' AND json_extract(manifest,'$.base')=? ORDER BY cutoff DESC LIMIT 1").bind(body.base).first<{id:string;cutoff:string;manifest:string}>();if(old){const metadata=JSON.parse(old.manifest),count=await binding().prepare('SELECT COUNT(*) AS n,COALESCE(SUM(ready=1),0) AS ready FROM archive_batch_rows WHERE batch_id=?').bind(old.id).first<{n:number;ready:number}>(),active=await publishedArchive();if(active&&active.id===body.base)return Response.json({id:old.id,cutoff:old.cutoff,candidates:count?.n||0,alreadyReady:count?.ready||0,sequence:metadata.sequence,reset:false,base:active.id,baseOffers:active.offers,recovered:true});}}

  const id=uuid.parse(body.id),previous=await one<{state:string;cutoff:string;manifest:string|null}>('archive_batches',{id}),cutoff=previous?.cutoff||new Date().toISOString();
  if(previous){if(previous.state!=='building')throw new HttpError(409,'Bu sürüm zaten yayımlandı.');const count=await binding().prepare('SELECT COUNT(*) AS n,COALESCE(SUM(ready=1),0) AS ready FROM archive_batch_rows WHERE batch_id=?').bind(id).first<{n:number;ready:number}>(),metadata=previous.manifest?JSON.parse(previous.manifest):{},base=metadata.base?await publishedArchive(metadata.base):null;return Response.json({id,cutoff,candidates:count?.n||0,alreadyReady:count?.ready||0,sequence:metadata.sequence||0,reset:body.base!==metadata.base,base:metadata.base||null,baseOffers:base?.offers||0});}
  const incremental=body.incremental===true;
  const active=await one<{payload:string}>('catalog_collection_runs',{id:'archive-active'}),current=active?validateArchiveManifest(JSON.parse(active.payload)):null;
  const cursor=z.number().int().nonnegative().parse(body.cursor||0),reset=incremental&&(!current||body.base!==current.id);
  const water=await binding().prepare('SELECT COALESCE(MAX(seq),0) AS seq FROM catalog_archive_changes').first<{seq:number}>(),sequence=water?.seq||0;
  const metadata=incremental?JSON.stringify({incremental:true,base:current?.id||null,sequence}):null;
  await binding().batch([
   binding().prepare('INSERT INTO archive_batches(id,state,created_at,cutoff,manifest) VALUES(?,?,?,?,?)').bind(id,'building',cutoff,cutoff,metadata),
   incremental&&!reset?binding().prepare(COPY_ARCHIVE_DELTA_SQL).bind(id,id,cutoff,cursor,sequence):binding().prepare(COPY_ARCHIVE_BATCH_SQL).bind(id,id,cutoff),
  ]);
  const count=await binding().prepare('SELECT COUNT(*) AS n FROM archive_batch_rows WHERE batch_id=?').bind(id).first<{n:number}>();return Response.json({id,cutoff,candidates:count?.n||0,sequence,reset,base:current?.id||null,baseOffers:current?.offers||0});
 }
 const id=uuid.parse(body.id),batch=await one<{state:string;cutoff:string;manifest:string|null}>('archive_batches',{id});
 if(batch?.state==='published'&&body.action==='publish'&&batch.manifest&&JSON.stringify(validateArchiveManifest(body.manifest))===batch.manifest)return Response.json({published:true,...JSON.parse(batch.manifest)});
 if(batch?.state!=='building')throw new HttpError(409,'Bu katalog hazırlık durumunda değil.');
 if(body.action==='rows'){const ids=z.array(z.string().min(1).max(100)).min(1).max(ARCHIVE_PAYLOAD_PAGE).parse(body.sources);const result=await binding().prepare('SELECT source_id,store_id,url,checked_at,payload FROM archive_batch_rows WHERE batch_id=? AND source_id IN ('+ids.map(()=>'?').join(',')+')').bind(id,...ids).all();return Response.json(result.results);}
 if(body.action==='verify-files'){
  const manifest=validateArchiveManifest(body.manifest);if(manifest.id!==id||manifest.cutoff!==batch.cutoff)throw new HttpError(400,'Yayın sürümü uyuşmuyor.');
  const digest=[...new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(JSON.stringify(manifest))))].map(x=>x.toString(16).padStart(2,'0')).join(''),key='archive-validation:'+id;
  const old=await one<{payload:string}>('catalog_collection_runs',{id:key}),progress=old?JSON.parse(old.payload):null,files=[...manifest.chunks,...(manifest.sourceIndex?[manifest.sourceIndex]:[])],offset=z.number().int().nonnegative().parse(body.cursor||0);
  if(progress?.digest===digest&&offset<progress.next)return Response.json({next:progress.next});
  if(offset!==(progress?.digest===digest?progress.next:0))throw new HttpError(409,'Dosya denetimi kaldığı sıradan sürmeli.');
  const page=assetPage(files,offset);for(const chunk of page.rows){const object=await archiveBucket().head(chunk.file);if(!object||object.size!==chunk.bytes||object.customMetadata?.sha256!==chunk.sha256)throw new HttpError(400,'Katalog dosyası eksik veya değişmiş.');}
  await binding().prepare('INSERT INTO catalog_collection_runs(id,updated_at,payload) VALUES(?,?,?) ON CONFLICT(id) DO UPDATE SET updated_at=excluded.updated_at,payload=excluded.payload').bind(key,new Date().toISOString(),JSON.stringify({digest,next:page.next})).run();return Response.json({next:page.next});
 }
 if(body.action==='ready'){
  const rows=z.array(z.object({sourceId:z.string().min(1).max(100),imageKey:z.string().refine(archiveImageKey),originalBytes:z.number().int().positive().max(8000000).optional()})).min(1).max(50).parse(body.rows);
  const statements=[];
  const candidates=await binding().prepare('SELECT source_id,payload,checked_at FROM archive_batch_rows WHERE batch_id=? AND source_id IN ('+rows.map(()=>'?').join(',')+')').bind(id,...rows.map(r=>r.sourceId)).all<{source_id:string;payload:string;checked_at:string}>();
  const imageObjects=new Map<string,R2Object|null>();await Promise.all([...new Set(rows.map(r=>r.imageKey))].map(async key=>imageObjects.set(key,await archiveBucket().head(key))));
  for(const row of rows){
   const stored=candidates.results.find(s=>s.source_id===row.sourceId);
   if(!stored)throw new HttpError(404,'Katalog gözlemi yok.');const record=upgradeSnapshotReader(validateSnapshot(JSON.parse(stored.payload),storeCatalog,Date.parse(stored.checked_at)));
   if(!record?.product.image)throw new HttpError(400,'Ürünün kendi görsel kaynağı doğrulanmadı.');
   const image=imageObjects.get(row.imageKey);if(!image||image.httpMetadata?.contentType!=='image/webp')throw new HttpError(400,'Hazır ürün görseli bulunamadı.');
   statements.push(binding().prepare('INSERT OR IGNORE INTO archive_image_cache(url,image_key,bytes,original_bytes) VALUES(?,?,?,?)').bind(record.product.image,row.imageKey,image.size,row.originalBytes||image.size));
   statements.push(binding().prepare('UPDATE archive_batch_rows SET ready=1,image_key=?,url=?,payload=? WHERE batch_id=? AND source_id=?').bind(row.imageKey,record.product.url,JSON.stringify({...JSON.parse(stored.payload),preparedImage:{bytes:image.size,originalBytes:row.originalBytes||image.size}}),id,row.sourceId));
  }
  await binding().batch(statements);return Response.json({ready:rows.length});
 }
 if(body.action==='cache-image'){
  const input=z.object({sourceId:z.string().min(1).max(100),source:z.string().url().max(2000),imageKey:z.string().refine(archiveImageKey),originalBytes:z.number().int().positive().max(8000000)}).parse(body);
  const row=await one<{payload:string;checked_at:string}>('catalog_snapshots',{id:input.sourceId});if(!row)throw new HttpError(404,'Görselin ürün kaydı yok.');const record=upgradeSnapshotReader(validateSnapshot(JSON.parse(row.payload),storeCatalog,Date.parse(row.checked_at)));if(record?.product.image!==input.source)throw new HttpError(400,'Ürünün görsel kaynağı uyuşmuyor.');const image=await archiveBucket().head(input.imageKey);if(!image||image.httpMetadata?.contentType!=='image/webp')throw new HttpError(400,'Görsel dosyası bulunamadı.');await binding().prepare('INSERT OR IGNORE INTO archive_image_cache(url,image_key,bytes,original_bytes) VALUES(?,?,?,?)').bind(input.source,input.imageKey,image.size,input.originalBytes).run();return Response.json({saved:true});
 }
 if(body.action==='publish'){
  const manifest=validateArchiveManifest(body.manifest);if(manifest.id!==id||manifest.cutoff!==batch.cutoff)throw new HttpError(400,'Katalog sürümü uyuşmuyor.');
  const count=await binding().prepare('SELECT COUNT(*) AS n,COALESCE(SUM(ready=1),0) AS ready FROM archive_batch_rows WHERE batch_id=?').bind(id).first<{n:number;ready:number}>();
  const metadata=batch.manifest?JSON.parse(batch.manifest):null;
  if(metadata?.incremental){
   const active=await one<{payload:string}>('catalog_collection_runs',{id:'archive-active'});
   if((active?JSON.parse(active.payload).id:null)!==metadata.base)throw new HttpError(409,'Yayın tabanı değişti; kontrol noktasından yeniden birleştirilmeli.');
   if(!count||count.ready!==body.deltaOffers||manifest.offers<count.ready||manifest.candidates<count.n)throw new HttpError(400,'Değişen kayıt sayısı uyuşmuyor.');
  }else if(count?.ready!==manifest.offers||count.n!==manifest.candidates)throw new HttpError(400,'Hazır teklif sayısı uyuşmuyor.');
  const verification=await one<{payload:string}>('catalog_collection_runs',{id:'archive-validation:'+id}),verified=verification?JSON.parse(verification.payload):null,digest=[...new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(JSON.stringify(manifest))))].map(x=>x.toString(16).padStart(2,'0')).join('');
  if(verified?.digest!==digest||verified.next!==manifest.chunks.length+(manifest.sourceIndex?1:0))throw new HttpError(409,'Dosyalar küçük parçalarla doğrulanmalı; eski hazır sürüm korunuyor.');
  const active=await one<{payload:string}>('catalog_collection_runs',{id:'archive-active'});if(active&&JSON.parse(active.payload).cutoff>=manifest.cutoff)throw new HttpError(409,'Daha yeni bir hazır katalog zaten yayımlandı.');
  const at=new Date().toISOString(),payload=JSON.stringify(manifest);
  await binding().batch([
   binding().prepare("UPDATE archive_batches SET state='published',published_at=?,manifest=? WHERE id=? AND state='building'").bind(at,payload,id),
   binding().prepare(ACTIVATE_ARCHIVE_SQL).bind(at,payload),
   // Retain frozen observations. Bulk deletion here exceeded the Worker memory budget.
  ]);return Response.json({published:true,...manifest});
 }
 throw new HttpError(400,'Geçersiz katalog işlemi.');
}catch(e){return failure(e);}}
