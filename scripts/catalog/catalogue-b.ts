import {initialArchiveQueue,firstPassProgress} from './bootstrap-queue';
/** Independent merchant collector. No Cloudflare runtime or browser session required. */
import {DatabaseSync} from 'node:sqlite';
import {collectionQueue,REFRESH_AFTER_MS} from './queue';
import {registerCollectorRequests} from './collector-requests';
import type {CollectorRequest} from '../../src/lib/collector-routing';
import {readFileSync,mkdirSync,openSync,closeSync,unlinkSync,existsSync,writeFileSync} from 'node:fs';
import {createReadStream} from 'node:fs';
import {createInterface} from 'node:readline';
import {resolve} from 'node:path';
import {createHash} from 'node:crypto';
import {storeCatalog} from '../../src/lib/catalog';
import {adapterFor} from '../../src/stores/registry';
import {validateSnapshot,type SnapshotRecord} from '../../src/lib/catalog-snapshot';
import {validateCatalogMetadata,type CatalogMetadata} from '../../src/lib/catalog-metadata';
import {safeStoreUrl} from '../../src/stores/base';
const arg=(key:string,fallback='')=>process.argv.find(a=>a.startsWith(`--${key}=`))?.slice(key.length+3)||fallback;
const requestsOnly=process.argv.includes('--requests-only'),initial=process.argv.includes('--initial');
const dir=resolve(requestsOnly?'work/catalogue-requests':'work/catalogue-b');mkdirSync(dir,{recursive:true});
const lock=resolve(dir,'collector.lock');
try{if(existsSync(lock)){const pid=Number(readFileSync(lock,'utf8'));try{process.kill(pid,0);throw new Error('Başka bir toplayıcı çalışıyor.');}catch(e){if((e as NodeJS.ErrnoException).code!=='ESRCH')throw e;unlinkSync(lock);}}const fd=openSync(lock,'wx');writeFileSync(fd,String(process.pid));closeSync(fd);}catch(e){console.error(e instanceof Error?e.message:e);process.exit(1);}
const db=new DatabaseSync(resolve(dir,'catalogue.sqlite'));
db.exec(`PRAGMA journal_mode=WAL;PRAGMA synchronous=NORMAL;
 CREATE TABLE IF NOT EXISTS metadata(key TEXT PRIMARY KEY,value TEXT NOT NULL);
 CREATE TABLE IF NOT EXISTS products(store_id TEXT NOT NULL,url TEXT NOT NULL,name TEXT NOT NULL,category TEXT NOT NULL,source_category TEXT NOT NULL,generation TEXT NOT NULL,active INTEGER NOT NULL DEFAULT 1,priority INTEGER NOT NULL DEFAULT 0,checked_at TEXT,payload TEXT,last_attempt TEXT,next_due TEXT NOT NULL DEFAULT '',error TEXT,uploaded_at TEXT,PRIMARY KEY(store_id,url));
 CREATE INDEX IF NOT EXISTS collect_queue ON products(store_id,active,next_due,priority,last_attempt);
 CREATE INDEX IF NOT EXISTS export_category ON products(active,category,url);
 CREATE TABLE IF NOT EXISTS runs(id TEXT PRIMARY KEY,started_at TEXT NOT NULL,finished_at TEXT,summary TEXT);
 CREATE TABLE IF NOT EXISTS history(store_id TEXT,url TEXT,checked_at TEXT,price INTEGER,stock TEXT,PRIMARY KEY(store_id,url,checked_at));
 CREATE TABLE IF NOT EXISTS metadata_observations(store_id TEXT,url TEXT,payload TEXT NOT NULL,uploaded_at TEXT,PRIMARY KEY(store_id,url));`);
const write=db.prepare(`UPDATE products SET name=?,checked_at=?,payload=?,last_attempt=?,next_due=?,error=NULL,uploaded_at=NULL WHERE store_id=? AND url=? AND (checked_at IS NULL OR checked_at<? OR (checked_at=? AND COALESCE(json_extract(payload,'$.readerRevision'),0)<?))`);
function save(record:SnapshotRecord){const p=record.product,key=record.requestedUrl||p.url;db.prepare('INSERT OR IGNORE INTO products(store_id,url,name,category,source_category,generation) VALUES(?,?,?,?,?,?)').run(record.storeId,key,p.name,'Diğer','',String(db.prepare("SELECT value FROM metadata WHERE key='generation'").get()?.value||''));return write.run(p.name,record.checkedAt,JSON.stringify(record),record.checkedAt,new Date(Date.parse(record.checkedAt)+REFRESH_AFTER_MS).toISOString(),record.storeId,key,record.checkedAt,record.checkedAt,record.readerRevision||0).changes;}
async function run(){
 const manifestText=readFileSync('public/catalog/manifest.json','utf8'),manifest=JSON.parse(manifestText),generation=createHash('sha256').update(manifestText).update(':bulk-without-ozdisan-v1').digest('hex');
 if(!requestsOnly&&db.prepare("SELECT value FROM metadata WHERE key='generation'").get()?.value!==generation){
  const put=db.prepare(`INSERT INTO products(store_id,url,name,category,source_category,generation) VALUES(?,?,?,?,?,?) ON CONFLICT(store_id,url) DO UPDATE SET category=excluded.category,source_category=excluded.source_category,generation=excluded.generation,active=1`);
  for(const store of manifest.stores.filter((s:{id:string})=>s.id!=='ozdisan'))for(const chunk of store.chunks){
   const rows=JSON.parse(readFileSync(resolve('public/catalog',chunk.key),'utf8'));
   db.exec('BEGIN');try{for(const [path,name,category] of rows)put.run(store.id,new URL(path,store.base).href,name,chunk.group,category||chunk.group,generation);db.exec('COMMIT');}catch(e){db.exec('ROLLBACK');throw e;}
  }
  db.prepare('UPDATE products SET active=0 WHERE generation<>?').run(generation);
  db.prepare("INSERT OR REPLACE INTO metadata VALUES('generation',?)").run(generation);
 }
 if(requestsOnly&&arg('targets'))throw new Error('İstek modu kurtarma listesiyle birleştirilemez.');
 const site=arg('site','https://komponent-radari.equalwood4.chatgpt.site'),secret=process.env.CATALOG_INGEST_SECRET;
 const recoveryFile=arg('targets');
 const targets:{storeId:string;url:string}[]=recoveryFile?JSON.parse(readFileSync(recoveryFile,'utf8')):[];
 if(!Array.isArray(targets)||targets.length>100||recoveryFile&&!targets.length)throw new Error('Geçersiz kurtarma listesi.');
 for(const row of targets){const store=storeCatalog.find(s=>s.id===row.storeId);if(!store)throw new Error('Bilinmeyen kurtarma mağazası.');row.url=safeStoreUrl(row.url,store.domain).href;}
 const targetKeys=new Set(targets.map(t=>t.storeId+':'+t.url));
 const startedAt=new Date().toISOString(),storeErrors=new Map<string,string>();
 let requests:CollectorRequest[]=[];const requestFailures:{id:string;requestedAt:string;error:string}[]=[];
 const auth:Record<string,string>=secret?{authorization:`Bearer ${secret}`}:{},summary={indexed:db.prepare('SELECT COUNT(*) AS n FROM products WHERE active=1').get()!.n,checked:0,failed:0,imported:0,uploaded:0,metadataUploaded:0,uploadError:''};
 if(arg('feed')){
  let lineNo=0;for await(const line of createInterface({input:createReadStream(arg('feed')),crlfDelay:Infinity})){lineNo++;if(!line.trim())continue;try{const record=validateSnapshot(JSON.parse(line),storeCatalog);if(save(record))summary.imported++;}catch(e){summary.failed++;console.error(`Veri satırı ${lineNo}: ${e instanceof Error?e.message:e}`);}}
 }
 if(process.argv.includes('--collect')){
  if(secret&&!recoveryFile){try{const r=await fetch(`${site}/api/catalog-snapshot`,{headers:auth,signal:AbortSignal.timeout(15000)});if(!r.ok)throw new Error(`HTTP ${r.status}`);const payload=await r.json() as {requests?:CollectorRequest[];watchlist:{storeId:string;url:string}[]};db.prepare('UPDATE products SET priority=0 WHERE priority>=10').run();const mark=db.prepare('UPDATE products SET priority=10,active=1 WHERE store_id=? AND url=?');for(const row of payload.watchlist)mark.run(row.storeId,row.url);requests=registerCollectorRequests(db,payload.requests||[],storeCatalog,generation);for(const request of requests){const old=db.prepare('SELECT error,last_attempt FROM products WHERE store_id=? AND url=?').get(request.storeId,request.url) as {error:string|null;last_attempt:string|null};if(old?.error&&old.last_attempt&&old.last_attempt>=request.requestedAt)requestFailures.push({id:request.id,requestedAt:request.requestedAt,error:old.error.slice(0,500)});}}catch(e){if(requestsOnly)throw e;console.error('Yenileme kuyruğu alınamadı; katalog sırası kullanılıyor:',e instanceof Error?e.message:e);}}
  const selected=requestsOnly?[...new Set(requests.map(r=>r.storeId))]:recoveryFile?[...new Set(targets.map(t=>t.storeId))]:arg('stores',storeCatalog.filter(s=>s.id!=='ozdisan').map(s=>s.id).join(',')).split(','),limit=Math.min(250,Math.max(1,Number(arg('limit','40'))));
  if(requestsOnly&&!secret)throw new Error('İstek modu yetkili toplayıcı anahtarı gerektirir.');
  const collectionDeadline=Date.now()+(requestsOnly?5:Math.min(18,Math.max(1,Number(arg('minutes','18')))))*60*1000;
  let lastProgress=0;const progress=()=>{if(initial&&Date.now()-lastProgress>30000){lastProgress=Date.now();writeFileSync(resolve(dir,'bootstrap-progress.json'),JSON.stringify(firstPassProgress(db,selected)));}};progress();
  const knownOnly=process.argv.includes('--known-only');
  if(!Number.isInteger(limit)||selected.some(id=>!storeCatalog.some(s=>s.id===id)))throw new Error('Geçersiz mağaza veya kayıt sınırı.');
  await Promise.all(storeCatalog.filter(s=>selected.includes(s.id)).map(async store=>{
   let delay=3000;
   try{const r=await fetch(`https://${store.domain}/robots.txt`,{headers:{'user-agent':'EUB-PriceComparison/1.0 (+public product metadata; no authentication)'},signal:AbortSignal.timeout(10000)});if(!r.ok)throw new Error(`robots HTTP ${r.status}`);const text=await r.text();delay=Math.max(delay,...[...text.matchAll(/^\s*Crawl-delay:\s*([\d.]+)/gim)].map(m=>Number(m[1])*1000));}catch(e){summary.failed++;storeErrors.set(store.id,String(e).slice(0,500));for(const request of requests.filter(r=>r.storeId===store.id))requestFailures.push({id:request.id,requestedAt:request.requestedAt,error:String(e).slice(0,500)});console.error(`${store.id}: ${e instanceof Error?e.message:e}`);return;}
   const rows=requestsOnly?requests.filter(r=>r.storeId===store.id).slice(0,limit):recoveryFile?targets.filter(t=>t.storeId===store.id):initial?initialArchiveQueue(db,store.id,limit):collectionQueue(db,store.id,limit,knownOnly);
   if(recoveryFile)for(const row of rows)db.prepare('INSERT OR IGNORE INTO products(store_id,url,name,category,source_category,generation) VALUES(?,?,?, ?,?,?)').run(store.id,row.url,'','Diğer','',generation);
   for(const row of rows){
    progress();
    if(Date.now()+delay+30000>=collectionDeadline){console.log(`${store.id}: Turun süre sınırı; kalan kayıtlar sonraki turda devam edecek.`);break;}
    await new Promise(r=>setTimeout(r,delay));
    try{
     const p=await adapterFor(store).getProduct(row.url),pack=p.packageQuantity||1;
     const product={...p,packageQuantity:pack,minimumOrderQuantity:p.minimumOrderQuantity||pack,orderStep:p.orderStep||pack,image:p.image?.startsWith('https://')?p.image:null};
     const record=validateSnapshot({readerRevision:2,storeId:store.id,requestedUrl:row.url,checkedAt:new Date().toISOString(),product},storeCatalog);
     if(save(record)){db.prepare('INSERT OR IGNORE INTO history VALUES(?,?,?,?,?)').run(store.id,product.url,record.checkedAt,product.price,product.stockStatus);}
     summary.checked++;console.log(`${store.id}: ${p.name} · ${((p.price||0)/100).toFixed(2)} TL · ${p.stockStatus}`);
    }catch(e){const at=new Date().toISOString(),error=e instanceof Error?e.message:String(e);db.prepare('UPDATE products SET last_attempt=?,next_due=?,error=? WHERE store_id=? AND url=?').run(at,new Date(Date.now()+12*3600000).toISOString(),error,store.id,row.url);for(const request of requests.filter(r=>r.storeId===store.id&&r.url===row.url))requestFailures.push({id:request.id,requestedAt:request.requestedAt,error:error.slice(0,500)});summary.failed++;console.error(`${store.id}: ${row.url}: ${error}`);
     if((store.id==='ozdisan'&&error.includes('fiyat ve stok talebi'))||(store.id==='komponentci'&&error.includes('satış birimi'))){
      try{const metadataProduct=await adapterFor(store).getCatalogProduct?.(row.url);if(metadataProduct?.image){const metadata=validateCatalogMetadata({storeId:store.id,url:row.url,name:metadataProduct.name,image:metadataProduct.image,observedAt:new Date().toISOString(),reason:error.slice(0,500)},storeCatalog);db.prepare('INSERT INTO metadata_observations VALUES(?,?,?,NULL) ON CONFLICT(store_id,url) DO UPDATE SET payload=excluded.payload,uploaded_at=NULL').run(store.id,metadata.url,JSON.stringify(metadata));console.log(`${store.id}: Ürün görseli kaydedildi; fiyat doğrulanmadı.`);}}catch(metadataError){console.error(`${store.id}: Görsel de doğrulanamadı: ${String(metadataError)}`);}
     }
    }
   }
  }));
 }
 if(secret){
  for(let offset=0;offset<requestFailures.length;offset+=100){const r=await fetch(`${site}/api/catalog-snapshot`,{method:'PATCH',headers:{...auth,'content-type':'application/json'},body:JSON.stringify({failures:requestFailures.slice(offset,offset+100)}),signal:AbortSignal.timeout(20000)});if(!r.ok)throw new Error(`Yenileme hata durumu kaydedilemedi: HTTP ${r.status}`);}
  const pending=(db.prepare(`SELECT store_id,url,payload,checked_at FROM products WHERE payload IS NOT NULL AND uploaded_at IS NULL AND checked_at>? ORDER BY checked_at`).all(new Date(Date.now()-12*3600000).toISOString()) as {store_id:string;url:string;payload:string;checked_at:string}[]).filter(row=>!recoveryFile||targetKeys.has(row.store_id+':'+row.url));
  for(let offset=0;offset<pending.length;offset+=50){const batch=pending.slice(offset,offset+50);try{let result:{saved:number;ignored:number}|undefined;for(let attempt=0;attempt<3;attempt++){try{const r=await fetch(`${site}/api/catalog-snapshot`,{method:'POST',headers:{...auth,'content-type':'application/json'},body:JSON.stringify({records:batch.map(row=>JSON.parse(row.payload))}),signal:AbortSignal.timeout(20000)});if(!r.ok)throw new Error(`HTTP ${r.status}: ${(await r.text()).slice(0,200)}`);result=await r.json() as {saved:number;ignored:number};break;}catch(error){if(attempt===2)throw error;await new Promise(resolve=>setTimeout(resolve,1000*(attempt+1)));}}if(!result)throw new Error('Arşiv aktarımı yanıt vermedi.');if(result.saved+result.ignored!==batch.length)throw new Error('Aktarım sayısı uyuşmuyor.');const mark=db.prepare('UPDATE products SET uploaded_at=? WHERE store_id=? AND url=? AND checked_at=?');for(const row of batch)mark.run(new Date().toISOString(),row.store_id,row.url,row.checked_at);summary.uploaded+=batch.length;}catch(e){summary.uploadError=e instanceof Error?e.message:String(e);console.error(summary.uploadError);break;}}
  const metadataPending=(db.prepare('SELECT store_id,url,payload FROM metadata_observations WHERE uploaded_at IS NULL').all() as {store_id:string;url:string;payload:string}[]).filter(row=>!recoveryFile||targets.some(t=>t.storeId===row.store_id&&new URL(t.url).pathname===new URL(row.url).pathname));
  for(let offset=0;offset<metadataPending.length;offset+=25){const batch=metadataPending.slice(offset,offset+25);const r=await fetch(`${site}/api/catalog-snapshot`,{method:'POST',headers:{...auth,'content-type':'application/json'},body:JSON.stringify({metadata:batch.map(row=>JSON.parse(row.payload) as CatalogMetadata)}),signal:AbortSignal.timeout(30000)});if(!r.ok)throw new Error(`Görsel aktarımı başarısız: HTTP ${r.status}`);const result=await r.json() as {metadata:{saved:number;ignored:number}};if(result.metadata.saved+result.metadata.ignored!==batch.length)throw new Error('Görsel aktarım sayısı uyuşmuyor.');for(const row of batch)db.prepare('UPDATE metadata_observations SET uploaded_at=? WHERE store_id=? AND url=? AND payload=?').run(new Date().toISOString(),row.store_id,row.url,row.payload);summary.metadataUploaded+=result.metadata.saved;}
 }
 if(initial)writeFileSync(resolve(dir,'bootstrap-progress.json'),JSON.stringify(firstPassProgress(db,storeCatalog.filter(s=>s.id!=='ozdisan').map(s=>s.id))));
 const stats=db.prepare('SELECT store_id,COUNT(*) AS indexed,SUM(payload IS NOT NULL) AS verified FROM products WHERE active=1 GROUP BY store_id').all() as {store_id:string;indexed:number;verified:number}[];
 const failures=db.prepare('SELECT store_id,COUNT(*) AS failed,MAX(error) AS error FROM products WHERE last_attempt>=? AND error IS NOT NULL GROUP BY store_id').all(startedAt) as {store_id:string;failed:number;error:string}[];
 const status={state:'completed',startedAt,...summary,stores:storeCatalog.map(store=>({...stats.find(row=>row.store_id===store.id)||{store_id:store.id,indexed:0,verified:0},error:storeErrors.get(store.id)||(failures.some(row=>row.store_id===store.id)?failures.filter(row=>row.store_id===store.id).map(row=>`${row.failed} sayfa doğrulanamadı: ${row.error}`).join('; ').slice(0,500):null)||(!stats.some(row=>row.store_id===store.id)?'Ürün adres dizini entegrasyonu yok.':null)}))};
 writeFileSync(resolve(dir,'status.json'),JSON.stringify({...status,at:new Date().toISOString()},null,2));
 if(secret&&!requestsOnly){const r=await fetch(`${site}/api/catalog-snapshot`,{method:'PUT',headers:{...auth,'content-type':'application/json'},body:JSON.stringify(status),signal:AbortSignal.timeout(20000)});if(!r.ok)throw new Error(`Toplayıcı durumu kaydedilemedi: HTTP ${r.status}`);}

 console.log(JSON.stringify(summary));if(summary.uploadError)process.exitCode=1;
}
try{await run();}catch(e){console.error(e instanceof Error?e.message:e);process.exitCode=1;}finally{db.exec('PRAGMA wal_checkpoint(TRUNCATE)');db.close();unlinkSync(lock);}
