import {preparePriceCatalog,packCatalogProducts} from './price-catalog';
import {parallelPages} from './bounded-pages';
import {loadPublicationCheckpoint,savePublicationCheckpoint} from './publication-checkpoint';
import {transferPrepared} from './prepared-transfer';
import {retryNetwork,TransferError} from './reliable-transfer';
import {maintainArchive,withArchiveCapacity} from './archive-maintenance';
import {ARCHIVE_READY_PAGE,ARCHIVE_PAYLOAD_PAGE} from '../../src/lib/archive-runtime-bounds';
import {DatabaseSync} from 'node:sqlite';
import {existsSync,mkdirSync,readFileSync,writeFileSync,unlinkSync} from 'node:fs';
import {gzipSync,gunzipSync} from 'node:zlib';
import {resolve} from 'node:path';
import {openPublicationState,putObservation,pendingObservations,deferObservation,getMeta,setMeta,partition,hash} from './incremental-state';
import {downloadProductImage,compactProductImage} from './archive-images';
import {fairImageQueue,reusableImage} from './archive-image-queue';
import {archivePreviews} from '../../src/lib/archive-preview';
import {archiveProducts} from '../../src/lib/archive-discovery';
import {validateSnapshot,upgradeSnapshotReader,SNAPSHOT_TTL_MS} from '../../src/lib/catalog-snapshot';
import {imagePath,validateArchiveManifest,type ReadyArchive} from '../../src/lib/ready-archive';
import {storeCatalog} from '../../src/lib/catalog';
const site=process.env.ARCHIVE_SITE||'https://komponent-radari.fyphotos22-24.chatgpt.site',secret=process.env.CATALOG_INGEST_SECRET;
if(!secret||secret.length<32)throw new Error('Yetkili toplayıcı bağlantısı gerekli.');
const headers={authorization:'Bearer '+secret},directory=resolve(process.env.PUBLICATION_WORKDIR||'work/archive-publisher'),file=directory+'/publication.sqlite';mkdirSync(directory,{recursive:true});
async function call(path:string,body?:any,binary?:Uint8Array){return withArchiveCapacity(()=>retryNetwork(async()=>{const response=await fetch(site+'/api/'+path,{method:binary?'PUT':body?'POST':'GET',headers:{...headers,...(binary?{'content-type':'application/octet-stream'}:body?{'content-type':'application/json'}:{})},body:binary?binary as BodyInit:body?JSON.stringify(body):undefined,signal:AbortSignal.timeout(90000)});if(!response.ok){const message='Yayın API HTTP '+response.status+' · '+(body?.action||path.split('?')[0]);if(response.status>=500||response.status===429||response.status===408)throw new TransferError(message);let detail='';try{detail=String((await response.json() as any).error||'').slice(0,200);}catch{}if(/overloaded|Too many resources|database is locked|D1.*timeout/i.test(detail)){await new Promise(r=>setTimeout(r,15000));throw new TransferError(message+' · '+detail);}throw new Error(message+' · '+detail);}return await response.json() as any;}),()=>maintainArchive(site,headers,16));}
// R2 is authoritative; GitHub's disposable cache is only an accelerator.
const checkpoint=await loadPublicationCheckpoint(site+'/api/archive-publisher-state',headers);
if(checkpoint){const unpacked=gunzipSync(checkpoint,{maxOutputLength:2*1024*1024*1024});if(unpacked.subarray(0,16).toString()!=='SQLite format 3\0')throw new Error('Yayıncı kontrol noktası biçimi geçersiz.');for(const suffix of ['-wal','-shm'])if(existsSync(file+suffix))unlinkSync(file+suffix);writeFileSync(file,unpacked);}
const db=openPublicationState(file),failures:any[]=[];let uploadedObjects=0,reusedObjects=0,downloadedImages=0,changed=0;
db.exec('CREATE TABLE IF NOT EXISTS product_parts(part TEXT PRIMARY KEY,payload TEXT NOT NULL,input_hash TEXT NOT NULL)');
async function object(value:unknown){const bytes=gzipSync(JSON.stringify(value)),sha256=hash(bytes),cached=db.prepare('SELECT file,bytes FROM objects WHERE hash=?').get(sha256) as {file:string;bytes:number}|undefined;if(cached){reusedObjects++;return {...cached,sha256};}const name='objects/'+sha256+'.json.gz';await call('archive-assets/'+name,undefined,bytes);db.prepare('INSERT OR REPLACE INTO objects VALUES(?,?,?)').run(sha256,name,bytes.length);uploadedObjects++;return {file:name,sha256,bytes:bytes.length};}
async function save(){db.exec('PRAGMA wal_checkpoint(TRUNCATE)');const copy=directory+'/state-'+crypto.randomUUID()+'.sqlite';try{db.prepare('VACUUM INTO ?').run(copy);const bytes=gzipSync(readFileSync(copy));await maintainArchive(site,headers,1);await savePublicationCheckpoint(site+'/api/archive-publisher-state',headers,bytes);}finally{if(existsSync(copy))unlinkSync(copy);}}
async function status(value:unknown){try{await fetch(site+'/api/archive-publisher-state',{method:'POST',headers:{...headers,'content-type':'application/json'},body:JSON.stringify(value),signal:AbortSignal.timeout(30000)});}catch{/* Status never replaces the durable state. */}}
async function run(){
 await maintainArchive(site,headers,16);
 await status({stage:'changes'});
 const batch=await call('archive-build',{action:'begin',incremental:true,recover:true,id:crypto.randomUUID(),base:getMeta(db,'base'),cursor:Number(getMeta(db,'readSequence')||getMeta(db,'cursor')||0)}),id=batch.id;
 if(batch.staged===false){let pages=0;for(;;){const part=await call('archive-build',{action:'stage',id});if(++pages%100===0)console.log(JSON.stringify({phase:'staging',pages}));if(part.staged)break;}}
 if(!getMeta(db,'legacyImagesImported')&&existsSync(directory+'/images.sqlite')){const legacy=new DatabaseSync(directory+'/images.sqlite',{readOnly:true});try{for(const image of legacy.prepare('SELECT * FROM images').all() as any[]){const url=image.url,checked_at=image.checked_at;if(reusableImage(image))db.prepare('INSERT OR IGNORE INTO images VALUES(?,?,?,?,?)').run(url,image.key,image.bytes,image.original_bytes,checked_at);}setMeta(db,'legacyImagesImported','1');}finally{legacy.close();}}
 // Permanent mappings are cheap to enumerate once, even if a runner lost its cache.
 if(!getMeta(db,'imagesImported')){let cursor='';for(;;){const page=await call('archive-build?images=1&cursor='+encodeURIComponent(cursor));for(const image of page.rows)db.prepare('INSERT OR IGNORE INTO images VALUES(?,?,?,?,?)').run(image.url,image.key,image.bytes,image.original_bytes,new Date().toISOString());if(!page.next)break;cursor=page.next;}setMeta(db,'imagesImported','1');}
 await status({stage:'images',changed});
 if(batch.base&&getMeta(db,'seeded')!==batch.base&&(batch.reset||!getMeta(db,'base'))){let seeded=0;const remember=db.prepare('INSERT INTO images VALUES(?,?,?,?,?) ON CONFLICT(url) DO UPDATE SET key=excluded.key,bytes=excluded.bytes,original_bytes=excluded.original_bytes,checked_at=excluded.checked_at WHERE images.bytes<=0 OR images.original_bytes<=0');
  async function consumeSeed(page:any){for(const row of page.rows){if(row.store_id==='ozdisan')continue;const [preview]=await archivePreviews([row.url],storeCatalog,async()=>[row],Date.parse(row.checked_at));if(!preview.price)throw new Error('Önceki hazır kayıt yeniden doğrulanamadı; önceki yayın korunuyor.');const hint={key:row.image_key,bytes:row.image_bytes,original_bytes:row.original_image_bytes};let image=reusableImage(hint)?hint:db.prepare('SELECT * FROM images WHERE key=? LIMIT 1').get(row.image_key) as any;if(row.image_key&&!reusableImage(image))image=(await call('archive-build?imageKey='+encodeURIComponent(row.image_key))).image;if(row.image_key&&!reusableImage(image))throw new Error('Önceki hazır görselin kalıcı eşlemesi eksik; önceki yayın korunuyor.');if(row.image_key&&preview.image)remember.run(preview.image,image.key,image.bytes,image.original_bytes,new Date().toISOString());putObservation(db,row);const existing=db.prepare('SELECT ready FROM observations WHERE source_id=?').get(row.source_id) as any;if(row.image_key&&(!existing.ready||JSON.parse(existing.ready).checked_at<row.checked_at)){const ready={fingerprint:hash(JSON.stringify([row.store_id,row.url,row.checked_at,row.payload])),source_id:row.source_id,store_id:row.store_id,url:row.url,checked_at:row.checked_at,payload:row.payload,image_key:row.image_key,bytes:image.bytes,original_bytes:image.original_bytes,preview:{...preview,image:imagePath(row.image_key)}};db.prepare('UPDATE observations SET ready=? WHERE source_id=?').run(JSON.stringify(ready),row.source_id);setMeta(db,'unpublished','1');}seeded++;}}
  const first=await call('archive-build?seed=1&base='+batch.base+'&cursor=0');await consumeSeed(first);
  if(Number.isInteger(first.totalPages)&&first.totalPages>0&&first.totalPages<=4096)await parallelPages(1,first.totalPages,4,async page=>consumeSeed(await call('archive-build?seed=1&base='+batch.base+'&cursor='+page)));
  else{let cursor=first.next;while(cursor!==null){const page=await call('archive-build?seed=1&base='+batch.base+'&cursor='+cursor);await consumeSeed(page);cursor=page.next;}}
  if(seeded!==batch.baseOffers)throw new Error('Önceki hazır kayıtların tümü aktarılmadı; önceki yayın korunuyor.');setMeta(db,'seeded',batch.base);await save();console.log(JSON.stringify({phase:'preserved-baseline',offers:seeded}));}

 const delta=new Set<string>(),readyOnServer=new Map<string,string>();let pendingPage=call('archive-build?digests=1&id='+id+'&cursor=').then(value=>({value,error:null as unknown}),error=>({value:null,error}));for(;;){const result=await pendingPage;if(result.error)throw result.error;const page=result.value,needed:string[]=[];const next=page.next?call('archive-build?digests=1&id='+id+'&cursor='+encodeURIComponent(page.next)).then(value=>({value,error:null as unknown}),error=>({value:null,error})):null;
  for(const item of page.rows){delta.add(item.source_id);if(item.ready)readyOnServer.set(item.source_id,item.image_key);const old=db.prepare('SELECT checked_at,payload FROM observations WHERE source_id=?').get(item.source_id) as {checked_at:string;payload:string}|undefined;if(!old||old.checked_at!==item.checked_at||(JSON.parse(old.payload).readerRevision||0)!==item.revision)needed.push(item.source_id);}
  await parallelPages(0,Math.ceil(needed.length/ARCHIVE_PAYLOAD_PAGE),4,async page=>{const rows=await call('archive-build',{action:'rows',id,sources:needed.slice(page*ARCHIVE_PAYLOAD_PAGE,(page+1)*ARCHIVE_PAYLOAD_PAGE)});for(const row of rows)if(putObservation(db,row))changed++;});
  if(!next)break;pendingPage=next;}

 setMeta(db,'readSequence',String(batch.sequence));await save();

 console.log(JSON.stringify({phase:'delta',received:delta.size,changed,reset:batch.reset,sequence:batch.sequence}));
 const minutes=Math.max(1,Math.min(30,Number(process.env.PREPARE_MINUTES||8))),deadline=Date.now()+(getMeta(db,'pricedCatalogVersion')==='1'?minutes*60000:0);
 const jobs=new Map<string,any[]>();
 const pending=pendingObservations(db);
 if(getMeta(db,'pricedCatalogVersion')==='1'&&!changed&&!pending.length&&getMeta(db,'base')&&getMeta(db,'unpublished')!=='1'){setMeta(db,'cursor',String(batch.sequence));console.log(JSON.stringify({phase:'unchanged',changed:0,downloadedImages:0,uploadedObjects:0}));await status({stage:'published',changed:0});return;}
 for(const row of pending){try{if(row.store_id==='ozdisan')continue;const record=upgradeSnapshotReader(validateSnapshot(JSON.parse(row.payload),storeCatalog,Date.parse(row.checked_at)));if(!record?.product.image||record.storeId!==row.store_id||record.checkedAt!==row.checked_at)throw new Error('Ürün/görsel kaynağı doğrulanmadı.');const values=jobs.get(record.product.image)||[];values.push({...row,url:record.product.url});jobs.set(record.product.image,values);}catch(e){deferObservation(db,row.source_id);failures.push({url:row.url,reason:String(e)});}}
 const entries=fairImageQueue([...jobs]);let at=0;
 await Promise.all(Array.from({length:12},async()=>{for(;;){const index=at++;if(index>=entries.length)return;const [source,linked]=entries[index];try{
  let image=db.prepare('SELECT * FROM images WHERE url=?').get(source) as any;
  if(!reusableImage(image)){
   if(Date.now()>=deadline)continue;
   const known=await call('archive-build?imageUrl='+encodeURIComponent(source));image=known.image;
   if(!reusableImage(image)){if(Date.now()>=deadline)continue;const bytes=await downloadProductImage(source,deadline),prepared=await compactProductImage(bytes);await call('archive-assets/'+prepared.key,undefined,prepared.bytes);image={key:prepared.key,bytes:prepared.bytes.length,original_bytes:prepared.originalBytes};await call('archive-build',{action:'cache-image',id,sourceId:linked[0].source_id,source,imageKey:image.key,originalBytes:image.original_bytes});downloadedImages++;}
   db.prepare('INSERT OR REPLACE INTO images VALUES(?,?,?,?,?)').run(source,image.key,image.bytes,image.original_bytes,new Date().toISOString());
  }
  for(const row of linked){const [preview]=await archivePreviews([row.url],storeCatalog,async()=>[row],Date.parse(batch.cutoff));if(!preview.price)throw new Error('Fiyat/satış birimi doğrulanamadı.');const ready={fingerprint:row.fingerprint,source_id:row.source_id,store_id:row.store_id,url:row.url,checked_at:row.checked_at,payload:row.payload,image_key:image.key,bytes:image.bytes,original_bytes:image.original_bytes,preview:{...preview,image:imagePath(image.key)}};db.prepare('UPDATE observations SET ready=? WHERE source_id=?').run(JSON.stringify(ready),row.source_id);setMeta(db,'unpublished','1');}
 }catch(e){for(const row of linked){deferObservation(db,row.source_id);failures.push({url:row.url,reason:e instanceof Error?e.message:String(e)});}}}}));
 const prepared=(db.prepare('SELECT ready FROM observations WHERE ready IS NOT NULL ORDER BY source_id').all() as {ready:string}[]).map(row=>JSON.parse(row.ready));
 const priced=await preparePriceCatalog(db,batch.cutoff);console.log(JSON.stringify({phase:'priced-catalog',offers:priced.count,rejected:priced.rejected,reused:priced.reused,validated:priced.validated}));
 // Only current, fully prepared delta rows are marked ready in this frozen batch.
 await status({stage:'publishing',changed});
 const readyDelta=prepared.filter(row=>delta.has(row.source_id)&&(db.prepare('SELECT fingerprint FROM observations WHERE source_id=?').get(row.source_id) as any).fingerprint===row.fingerprint);
 const newReady=readyDelta.filter(row=>readyOnServer.get(row.source_id)!==row.image_key);await transferPrepared(newReady.map(row=>({sourceId:row.source_id,imageKey:row.image_key,originalBytes:row.original_bytes,payload:row.payload})),rows=>call('archive-build',{action:'ready',id,rows}));
 if(!priced.count)throw new Error('Henüz doğrulanmış fiyat yok; önceki yayın korunuyor.');
 const chunks:ReadyArchive['chunks']=[],chunkJobs:any[][]=[];let productCount=0;
 function* productGroups(){for(const part of priced.parts('part')){const items=priced.rows('part',part).map(row=>({storeId:row.store_id,preview:row.preview}));yield archiveProducts(items,Date.parse(batch.cutoff));}}
 for(const values of packCatalogProducts(productGroups())){chunkJobs.push(values);productCount+=values.length;}
 let chunkAt=0;await Promise.all(Array.from({length:4},async()=>{for(;;){const index=chunkAt++;if(index>=chunkJobs.length)return;const values=chunkJobs[index];chunks[index]={...await object(values),products:values.length};}}));
 const refs:Record<string,any>={};let shardAt=0;const groups=priced.parts('source_part');
 await Promise.all(Array.from({length:4},async()=>{for(;;){const i=shardAt++;if(i>=groups.length)return;const part=groups[i],values=priced.rows('source_part',part).map(row=>({id:row.source_id,source_id:row.source_id,store_id:row.store_id,url:row.url,checked_at:row.checked_at,payload:row.payload,ready:1,image_key:row.image_key}));const encoded=Buffer.from(JSON.stringify(values));if(encoded.length>8*1024*1024||gzipSync(encoded).length>2000000)throw new Error('Kaynak katalog parçası güvenli boyutu aşıyor; önceki yayın korunuyor.');refs[part]={...await object(values),count:values.length};}}));
 const index={offers:priced.count,prefixLength:2,shards:Object.fromEntries(Object.entries(refs).sort(([a],[b])=>a.localeCompare(b)))},bytes=gzipSync(JSON.stringify(index)),sourceFile='catalogs/'+id+'/snapshots-index-'+hash(bytes)+'.json.gz';await call('archive-assets/'+sourceFile,undefined,bytes);
 const images=new Map<string,any>(),counts=new Map<string,{offers:number;fresh:number}>();let priceOnlyOffers=0;
 for(const part of priced.parts('part'))for(const row of priced.rows('part',part)){if(row.image_key)images.set(row.image_key,row);else priceOnlyOffers++;const count=counts.get(row.store_id)||{offers:0,fresh:0};count.offers++;if(Date.parse(batch.cutoff)-Date.parse(row.checked_at)<SNAPSHOT_TTL_MS)count.fresh++;counts.set(row.store_id,count);}
 const candidates=Number((db.prepare('SELECT COUNT(*) AS n FROM observations').get() as any).n);
 const manifest=validateArchiveManifest({version:1,id,preparedAt:new Date().toISOString(),cutoff:batch.cutoff,products:productCount,offers:priced.count,priceOnlyOffers,candidates,chunks,sourceIndex:{file:sourceFile,sha256:hash(bytes),bytes:bytes.length,offers:priced.count},imageBytes:[...images.values()].reduce((n,r)=>n+r.bytes,0),originalImageBytes:[...images.values()].reduce((n,r)=>n+r.original_bytes,0),stores:storeCatalog.map(s=>({id:s.id,...(counts.get(s.id)||{offers:0,fresh:0})}))});
 let verified=0;const fileCount=manifest.chunks.length+(manifest.sourceIndex?1:0);while(verified<fileCount){const result=await call('archive-build',{action:'verify-files',id,manifest,cursor:verified});if(result.next<=verified)throw new Error('Dosya denetimi ilerlemedi.');verified=result.next;}
 await call('archive-build',{action:'publish',id,manifest,deltaOffers:Number(batch.alreadyReady||0)+newReady.filter(row=>!readyOnServer.has(row.source_id)).length});
 setMeta(db,'pricedCatalogVersion','1');setMeta(db,'unpublished','0');setMeta(db,'base',id);setMeta(db,'cursor',String(batch.sequence));
 await status({stage:'published',changed,products:productCount,offers:priced.count,downloadedImages,reusedObjects});
 const report={manifest,changed,received:delta.size,downloadedImages,uploadedObjects,reusedObjects,failures};writeFileSync(directory+'/publication.json',JSON.stringify(report,null,2));console.log(JSON.stringify({phase:'published',products:productCount,offers:priced.count,changed,downloadedImages,uploadedObjects,reusedObjects}));
}
try{await run();}catch(e){await status({stage:'failed',error:String(e).slice(0,500)});throw e;}finally{try{await save();}finally{db.close();}}
