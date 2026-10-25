import {z} from 'zod';
import {authorizeCollector} from '@/lib/server/collector-auth';
import {binding,one,HttpError} from '@/lib/server/db';
import {archiveBucket} from '@/lib/server/ready-archive';
import {archiveImageKey,validateArchiveManifest} from '@/lib/ready-archive';
import {validateSnapshot,upgradeSnapshotReader} from '@/lib/catalog-snapshot';
import {storeCatalog} from '@/lib/catalog';
import {COPY_ARCHIVE_BATCH_SQL,ACTIVATE_ARCHIVE_SQL} from '@/lib/archive-batch-sql';
export const dynamic='force-dynamic';
const uuid=z.string().uuid();
function failure(e:unknown){return Response.json({error:e instanceof Error?e.message:'Katalog hazırlanamadı.'},{status:e instanceof HttpError?e.status:400});}
export async function GET(request:Request){try{
 authorizeCollector(request);const params=new URL(request.url).searchParams,id=uuid.parse(params.get('id')),cursor=params.get('cursor')||'';
 const rows=await binding().prepare('SELECT source_id,store_id,url,checked_at,payload FROM archive_batch_rows WHERE batch_id=? AND source_id>? ORDER BY source_id LIMIT 200').bind(id,cursor).all();return Response.json(rows.results);
}catch(e){return failure(e);}}
export async function POST(request:Request){try{
 authorizeCollector(request);const raw=await request.text();if(raw.length>1000000)throw new HttpError(413,'Katalog isteği çok büyük.');const body=JSON.parse(raw);
 if(body.action==='begin'){
  const id=uuid.parse(body.id),previous=await one<{state:string;cutoff:string}>('archive_batches',{id}),cutoff=previous?.cutoff||new Date().toISOString();
  if(previous){const count=await binding().prepare('SELECT COUNT(*) AS n FROM archive_batch_rows WHERE batch_id=?').bind(id).first<{n:number}>();return Response.json({id,cutoff,candidates:count?.n||0});}
  await binding().batch([
   binding().prepare('INSERT INTO archive_batches(id,state,created_at,cutoff) VALUES(?,?,?,?)').bind(id,'building',cutoff,cutoff),
   binding().prepare(COPY_ARCHIVE_BATCH_SQL).bind(id,id,cutoff),
  ]);
  const count=await binding().prepare('SELECT COUNT(*) AS n FROM archive_batch_rows WHERE batch_id=?').bind(id).first<{n:number}>();return Response.json({id,cutoff,candidates:count?.n||0});
 }
 const id=uuid.parse(body.id),batch=await one<{state:string;cutoff:string;manifest:string|null}>('archive_batches',{id});
 if(batch?.state==='published'&&body.action==='publish'&&batch.manifest&&JSON.stringify(validateArchiveManifest(body.manifest))===batch.manifest)return Response.json({published:true,...JSON.parse(batch.manifest)});
 if(batch?.state!=='building')throw new HttpError(409,'Bu katalog hazırlık durumunda değil.');
 if(body.action==='ready'){
  const rows=z.array(z.object({sourceId:z.string().min(1).max(100),imageKey:z.string().refine(archiveImageKey)})).min(1).max(50).parse(body.rows);
  const statements=[];
  for(const row of rows){
   const stored=await binding().prepare('SELECT payload,checked_at FROM archive_batch_rows WHERE batch_id=? AND source_id=?').bind(id,row.sourceId).first<{payload:string;checked_at:string}>();
   if(!stored)throw new HttpError(404,'Katalog gözlemi yok.');const record=upgradeSnapshotReader(validateSnapshot(JSON.parse(stored.payload),storeCatalog,Date.parse(stored.checked_at)));
   if(!record?.product.image)throw new HttpError(400,'Ürünün kendi görsel kaynağı doğrulanmadı.');
   const image=await archiveBucket().head(row.imageKey);if(!image||image.httpMetadata?.contentType!=='image/webp')throw new HttpError(400,'Hazır ürün görseli bulunamadı.');
   statements.push(binding().prepare('UPDATE archive_batch_rows SET ready=1,image_key=?,url=? WHERE batch_id=? AND source_id=?').bind(row.imageKey,record.product.url,id,row.sourceId));
  }
  await binding().batch(statements);return Response.json({ready:rows.length});
 }
 if(body.action==='publish'){
  const manifest=validateArchiveManifest(body.manifest);if(manifest.id!==id||manifest.cutoff!==batch.cutoff)throw new HttpError(400,'Katalog sürümü uyuşmuyor.');
  const count=await binding().prepare('SELECT COUNT(*) AS n,SUM(ready=1) AS ready FROM archive_batch_rows WHERE batch_id=?').bind(id).first<{n:number;ready:number}>();
  if(count?.ready!==manifest.offers||count.n!==manifest.candidates)throw new HttpError(400,'Hazır teklif sayısı uyuşmuyor.');
  for(const chunk of manifest.chunks){const object=await archiveBucket().head(chunk.file);if(!object||object.size!==chunk.bytes||object.customMetadata?.sha256!==chunk.sha256)throw new HttpError(400,'Katalog dosyası eksik veya değişmiş.');}
  const active=await one<{payload:string}>('catalog_collection_runs',{id:'archive-active'});if(active&&JSON.parse(active.payload).cutoff>=manifest.cutoff)throw new HttpError(409,'Daha yeni bir hazır katalog zaten yayımlandı.');
  const at=new Date().toISOString(),payload=JSON.stringify(manifest);
  await binding().batch([
   binding().prepare("UPDATE archive_batches SET state='published',published_at=?,manifest=? WHERE id=? AND state='building'").bind(at,payload,id),
   binding().prepare(ACTIVATE_ARCHIVE_SQL).bind(at,payload),
  ]);return Response.json({published:true,...manifest});
 }
 throw new HttpError(400,'Geçersiz katalog işlemi.');
}catch(e){return failure(e);}}
