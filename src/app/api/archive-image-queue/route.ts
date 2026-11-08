import {z} from 'zod';
import {authorizeCollector} from '@/lib/server/collector-auth';
import {binding,HttpError} from '@/lib/server/db';
import {archiveBucket} from '@/lib/server/ready-archive';
import {archiveImageKey} from '@/lib/ready-archive';
import {validateSnapshot,upgradeSnapshotReader} from '@/lib/catalog-snapshot';
import {storeCatalog} from '@/lib/catalog';
import {IMAGE_LOOKUP_SQL,IMAGE_CACHE_CHANGES_SQL,IMAGE_DISCOVERY_SQL,IMAGE_SOURCE_CHANGES_SQL,imagePrefixRange,IMAGE_LOOKUP_LIMIT,IMAGE_REGISTER_LIMIT,imageInfrastructureError} from '@/lib/image-queue';
export const dynamic='force-dynamic';
const source=z.string().url().max(2000).refine(s=>{const u=new URL(s);return u.protocol==='https:'&&!u.username&&!u.password&&!u.port;}),key=z.string().refine(archiveImageKey);
const mapSchema=z.object({source,sourceId:z.string().min(1).max(100),key,bytes:z.number().int().positive().max(500000),original_bytes:z.number().int().positive().max(8000000)});
const digest=async(bytes:Uint8Array)=>[...new Uint8Array(await crypto.subtle.digest('SHA-256',bytes as BufferSource))].map(n=>n.toString(16).padStart(2,'0')).join('');
const mapKey=async(url:string)=>'image-queue/maps/'+await digest(new TextEncoder().encode(url))+'.json';
async function journal(url:string){const o=await archiveBucket().get(await mapKey(url));if(!o)return null;const value=mapSchema.safeParse(await o.json());return value.success&&value.data.source===url?value.data:null;}
function failure(error:unknown){return Response.json({error:error instanceof Error?error.message:'Görsel kuyruğu okunamadı.'},{status:error instanceof HttpError?error.status:imageInfrastructureError(error)?503:400});}
export async function GET(request:Request){try{
 const p=new URL(request.url).searchParams,bucket=archiveBucket();
 if(p.has('status')){const o=await bucket.get('image-queue/status.json');return Response.json(o?await o.json():{stage:'waiting',ready:0,pending:0,retry:0},{headers:{'Cache-Control':'no-store'}});}
 authorizeCollector(request);
 if(p.has('state')){const o=await bucket.get('image-queue/state.json');if(!o)return new Response(null,{status:404});let pointer:any=await o.json();if(p.get('state')==='previous')pointer=pointer.previous;if(!pointer)throw new HttpError(503,'Görsel kuyruğu yedeği yok.');const object=await bucket.get(pointer.key);if(!object||object.size!==pointer.bytes||object.customMetadata?.sha256!==pointer.sha256)throw new HttpError(503,'Görsel kuyruğu kaydı doğrulanamadı.');return new Response(object.body,{headers:{'Content-Type':'application/octet-stream','Content-Encoding':'identity','Content-Length':String(object.size),'X-Checkpoint-Sha256':pointer.sha256,'Cache-Control':'private, no-store, no-transform'}});}
 if(p.has('cache')){const after=z.coerce.number().int().nonnegative().parse(p.get('after')||0),rows=(await binding().prepare(IMAGE_CACHE_CHANGES_SQL).bind(after).all()).results;return Response.json({rows,next:rows.length===1000?(rows.at(-1) as any).seq:null});}
 if(p.has('anchor')){const r=await binding().prepare('SELECT COALESCE(MAX(seq),0) seq FROM catalog_archive_changes').first<{seq:number}>();return Response.json({seq:r?.seq||0});}
 if(p.has('changes')){const after=z.coerce.number().int().nonnegative().parse(p.get('after')||0),rows=(await binding().prepare(IMAGE_SOURCE_CHANGES_SQL).bind(after).all()).results;return Response.json({rows,next:rows.length===1000?(rows.at(-1) as any).seq:null,sequence:(rows.at(-1) as any)?.seq||after});}
 const prefix=z.string().regex(/^[0-9a-f]$/).parse(p.get('prefix')),cursor=z.string().max(100).parse(p.get('cursor')||''),[start,end]=imagePrefixRange(prefix),rows=(await binding().prepare(IMAGE_DISCOVERY_SQL).bind(start,end,cursor).all()).results;
 return Response.json({rows,next:rows.length===1000?(rows.at(-1) as any).source_id:null});
 }catch(error){return failure(error);}}
export async function POST(request:Request){try{
 authorizeCollector(request);const raw=await request.text();if(raw.length>100000)throw new HttpError(413,'Görsel isteği çok büyük.');const body=JSON.parse(raw),bucket=archiveBucket();
 if(body.action==='status'){const safe=z.object({stage:z.enum(['discovering','running','saved','failed']),ready:z.number().int().nonnegative(),pending:z.number().int().nonnegative(),retry:z.number().int().nonnegative(),withoutSource:z.number().int().nonnegative(),downloaded:z.number().int().nonnegative(),reused:z.number().int().nonnegative(),indexedPending:z.number().int().nonnegative(),newThisRun:z.number().int().nonnegative(),bytes:z.number().nonnegative(),lastCheckpointAt:z.string().max(40).optional(),error:z.string().max(300).optional(),errors:z.array(z.object({reason:z.string().max(200),count:z.number().int().nonnegative()})).max(8).optional()}).parse(body);await bucket.put('image-queue/status.json',JSON.stringify({...safe,updatedAt:new Date().toISOString()}),{httpMetadata:{contentType:'application/json'}});return Response.json({saved:true});}
 if(body.action==='lookup'){const urls=[...new Set(z.array(source).min(1).max(IMAGE_LOOKUP_LIMIT).parse(body.sources))],rows=(await binding().prepare(IMAGE_LOOKUP_SQL).bind(JSON.stringify(urls)).all()).results as any[];for(const row of rows)if(!(row.bytes>0&&row.original_bytes>0)&&archiveImageKey(row.key)){const image=await bucket.head(row.key);if(image){row.bytes=image.size;row.original_bytes=image.size;row.indexed=false;}}for(const url of urls){if(rows.some(r=>r.url===url))continue;const saved=await journal(url);if(saved){const image=await bucket.head(saved.key);if(image?.httpMetadata?.contentType==='image/webp'&&image.size===saved.bytes)rows.push({url,...saved,indexed:false,durable:true});}}return Response.json({rows});}
 if(body.action==='register'){
  const inputs=z.array(mapSchema).min(1).max(IMAGE_REGISTER_LIMIT).parse(body.rows),ids=inputs.map(r=>r.sourceId),sources=(await binding().prepare('SELECT id,payload,checked_at FROM catalog_snapshots WHERE id IN (SELECT value FROM json_each(?))').bind(JSON.stringify(ids)).all<{id:string;payload:string;checked_at:string}>()).results;
  const existing=(await binding().prepare(IMAGE_LOOKUP_SQL).bind(JSON.stringify(inputs.map(r=>r.source))).all()).results as any[],rows:any[]=[],statements=[];
  for(const input of inputs){const known=existing.find(r=>r.url===input.source);if(known?.bytes>0&&known.original_bytes>0){rows.push({...known,indexed:true});continue;}const saved=await journal(input.source);if(!saved){const row=sources.find(r=>r.id===input.sourceId);if(!row)throw new HttpError(404,'Görselin ürün kaydı yok.');const record=upgradeSnapshotReader(validateSnapshot(JSON.parse(row.payload),storeCatalog,Date.parse(row.checked_at)));if(record?.product.image!==input.source)throw new HttpError(400,'Ürünün görsel kaynağı uyuşmuyor.');}
   const value=saved||input,image=await bucket.head(value.key);if(!image||image.httpMetadata?.contentType!=='image/webp'||image.size!==value.bytes)throw new HttpError(400,'Hazır görsel dosyası bulunamadı.');
   if(!saved)await bucket.put(await mapKey(value.source),JSON.stringify(value),{httpMetadata:{contentType:'application/json'}});
   statements.push(binding().prepare('INSERT INTO archive_image_cache(url,image_key,bytes,original_bytes) VALUES(?,?,?,?) ON CONFLICT(url) DO UPDATE SET bytes=excluded.bytes,original_bytes=excluded.original_bytes WHERE archive_image_cache.image_key=excluded.image_key AND (archive_image_cache.bytes<=0 OR archive_image_cache.original_bytes<=0)').bind(value.source,value.key,value.bytes,value.original_bytes));rows.push({url:value.source,...value,indexed:false,durable:true});
  }
  let indexed=true;try{if(statements.length)await binding().batch(statements);}catch(error){if(!imageInfrastructureError(error)&&!/Exceeded maximum DB size/.test(String(error)))throw error;indexed=false;}
  if(indexed){for(const row of rows)row.indexed=true;await bucket.put('image-queue/catalog-change.json',JSON.stringify({updatedAt:new Date().toISOString()}),{httpMetadata:{contentType:'application/json'}});}
  return Response.json({rows,indexed});
 }
 throw new HttpError(400,'Geçersiz görsel işlemi.');
 }catch(error){return failure(error);}}
export async function PUT(request:Request){try{
 authorizeCollector(request);const length=Number(request.headers.get('content-length')),sha=request.headers.get('x-checkpoint-sha256');if(!request.body||!Number.isSafeInteger(length)||length<1||length>24*1024*1024||!sha||!/^[a-f0-9]{64}$/.test(sha))throw new HttpError(400,'Görsel kuyruk kaydı geçersiz.');
 const bucket=archiveBucket(),previous=await bucket.get('image-queue/state.json'),old:any=previous?await previous.json():null,key='image-queue/checkpoints/'+crypto.randomUUID()+'.sqlite.gz';await bucket.put(key,request.body,{sha256:sha,customMetadata:{sha256:sha}});const object=await bucket.head(key);if(!object||object.size!==length||object.customMetadata?.sha256!==sha)throw new HttpError(503,'Görsel kuyruğu kaydedilemedi; önceki kayıt korundu.');
 const pointer={key,sha256:sha,bytes:length,updatedAt:new Date().toISOString(),...(old?{previous:{key:old.key,sha256:old.sha256,bytes:old.bytes}}:{})};await bucket.put('image-queue/state.json',JSON.stringify(pointer),{httpMetadata:{contentType:'application/json'}});
 if(old?.previous?.key?.startsWith('image-queue/checkpoints/')&&old.previous.key!==key&&old.previous.key!==old.key)await bucket.delete(old.previous.key).catch(()=>{});
 return Response.json({saved:true,updatedAt:pointer.updatedAt});
 }catch(error){return failure(error);}}
