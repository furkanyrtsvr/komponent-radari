import {fairImageQueue} from './archive-image-queue';
import {DatabaseSync} from 'node:sqlite';
import {mkdirSync,writeFileSync} from 'node:fs';
import {gzipSync} from 'node:zlib';
import {resolve} from 'node:path';
import {archivePreviews} from '../../src/lib/archive-preview';
import {archiveProducts} from '../../src/lib/archive-discovery';
import {validateSnapshot,upgradeSnapshotReader} from '../../src/lib/catalog-snapshot';
import {imagePath,validateArchiveManifest,type ReadyArchive} from '../../src/lib/ready-archive';
import {storeCatalog} from '../../src/lib/catalog';
import {compactProductImage,downloadProductImage,digest} from './archive-images';
import {canonicalMerchantPath} from '../../src/lib/merchant-url-aliases';
const arg=(k:string,d='')=>process.argv.find(a=>a.startsWith('--'+k+'='))?.split('=').slice(1).join('=')||d;
const site=arg('site','https://komponent-radari.equalwood4.chatgpt.site'),secret=process.env.CATALOG_INGEST_SECRET;if(!secret||secret.length<32)throw new Error('Yetkili toplayıcı anahtarı gerekli.');
const headers={authorization:'Bearer '+secret},directory=resolve('work/archive-publisher');mkdirSync(directory,{recursive:true});
const cache=new DatabaseSync(resolve(directory,'images.sqlite'));cache.exec('CREATE TABLE IF NOT EXISTS images(url TEXT PRIMARY KEY,key TEXT NOT NULL,bytes INTEGER NOT NULL,original_bytes INTEGER NOT NULL,checked_at TEXT NOT NULL)');
async function call(path:string,body?:unknown,binary?:Uint8Array){
 for(let attempt=0;;attempt++)try{const response=await fetch(site+'/api/'+path,{method:binary?'PUT':body?'POST':'GET',headers:{...headers,...(binary?{'content-type':'application/octet-stream'}:body?{'content-type':'application/json'}:{})},body:binary?binary as BodyInit:body?JSON.stringify(body):undefined,signal:AbortSignal.timeout(90000)});if(!response.ok)throw new Error('Katalog API HTTP '+response.status+': '+(await response.text()).slice(0,300));return await response.json() as any;}catch(e){if(attempt>=2)throw e;await new Promise(r=>setTimeout(r,1000*(attempt+1)));}
}
async function run(){
 const batch=await call('archive-build',{action:'begin',id:crypto.randomUUID()}),id=batch.id;const rows:any[]=[];let cursor='';
 for(;;){const page=await call('archive-build?id='+id+'&cursor='+encodeURIComponent(cursor));rows.push(...page);if(page.length<200)break;cursor=page.at(-1).source_id;}
 if(rows.length!==batch.candidates)throw new Error('Dondurulmuş katalog satır sayısı tutarsız.');
 const deadline=Date.now()+Number(arg('minutes','170'))*60000,observations:any[]=[],failures:any[]=[],imageStats=new Map<string,{bytes:number;original:number}>();
 const jobs=new Map<string,any[]>(),seenUrls=new Set<string>();
 for(const row of rows.sort((a,b)=>b.checked_at.localeCompare(a.checked_at))){
  try{const record=upgradeSnapshotReader(validateSnapshot(JSON.parse(row.payload),storeCatalog,Date.parse(row.checked_at)));if(!record?.product.image||record.storeId!==row.store_id||record.checkedAt!==row.checked_at)throw new Error('Doğrulanmış ürün/görsel kaynağı yok.');const address=new URL(record.product.url);address.hostname=address.hostname.replace(/^www\./,'');address.hash='';if(!address.search)address.pathname=canonicalMerchantPath(address.hostname,address.pathname);const key=record.storeId+':'+address.href;if(seenUrls.has(key))throw new Error('Aynı adresin daha yeni gözlemi kullanıldı.');seenUrls.add(key);row.url=record.product.url;row.record=record;const list=jobs.get(record.product.image)||[];list.push(row);jobs.set(record.product.image,list);}catch(e){failures.push({url:row.url,reason:String(e)});}
 }
 const entries=fairImageQueue([...jobs]),ready:any[]=[];let at=0;
 await Promise.all(Array.from({length:12},async()=>{for(;;){const index=at++;if(index>=entries.length)return;const [source,linked]=entries[index];
  try{
   let image=cache.prepare('SELECT * FROM images WHERE url=?').get(source) as {key:string;bytes:number;original_bytes:number;checked_at:string}|undefined;
   if(!image||Date.now()-Date.parse(image.checked_at)>7*86400000){const bytes=await downloadProductImage(source,deadline),prepared=await compactProductImage(bytes);await call('archive-assets/'+prepared.key,undefined,prepared.bytes);image={key:prepared.key,bytes:prepared.bytes.length,original_bytes:prepared.originalBytes,checked_at:new Date().toISOString()};cache.prepare('INSERT OR REPLACE INTO images VALUES(?,?,?,?,?)').run(source,image.key,image.bytes,image.original_bytes,image.checked_at);}
   imageStats.set(image.key,{bytes:image.bytes,original:image.original_bytes});
   for(const row of linked){ready.push({sourceId:row.source_id,imageKey:image.key});observations.push({...row,imageKey:image.key});}
   if(ready.length%100===0)console.log('Hazır teklif:',ready.length,'/',rows.length);
  }catch(e){for(const row of linked)failures.push({url:row.url,reason:e instanceof Error?e.message:String(e)});}
 }}));
 for(let i=0;i<ready.length;i+=50)await call('archive-build',{action:'ready',id,rows:ready.slice(i,i+50)});
 const items:any[]=[];
 for(let i=0;i<observations.length;i+=120){const group=observations.slice(i,i+120),seen=await archivePreviews(group.map(r=>r.url),storeCatalog,async()=>group,new Date(batch.cutoff).getTime());
  for(const p of seen){const row=group.find(r=>r.url===p.url);if(p.price&&row)items.push({storeId:row.store_id,preview:{...p,image:imagePath(row.imageKey)}});}
 }
 const products=archiveProducts(items),chunks:ReadyArchive['chunks']=[];
 for(let i=0;i<products.length;i+=200){const slice=products.slice(i,i+200),bytes=gzipSync(JSON.stringify(slice)),file=`catalogs/${id}/${chunks.length}.json.gz`;const uploaded=await call('archive-assets/'+file,undefined,bytes);chunks.push({file,sha256:digest(bytes),bytes:uploaded.bytes,products:slice.length});}
 const count=items.length;if(count!==ready.length)throw new Error('Hazır tekliflerin yayın sayısı uyuşmuyor.');
 const manifest=validateArchiveManifest({version:1,id,preparedAt:new Date().toISOString(),cutoff:batch.cutoff,products:products.length,offers:count,candidates:rows.length,chunks,imageBytes:[...imageStats.values()].reduce((s,v)=>s+v.bytes,0),originalImageBytes:[...imageStats.values()].reduce((s,v)=>s+v.original,0),stores:storeCatalog.map(s=>({id:s.id,offers:items.filter(i=>i.storeId===s.id).length,fresh:items.filter(i=>i.storeId===s.id&&i.preview.archiveState==='fresh').length}))});
 writeFileSync(resolve(directory,'publication.json'),JSON.stringify({manifest,failures},null,2));
 await call('archive-build',{action:'publish',id,manifest});console.log(JSON.stringify({published:id,products:manifest.products,offers:manifest.offers,candidates:manifest.candidates,imageBytes:manifest.imageBytes,originalImageBytes:manifest.originalImageBytes,excluded:failures.length}));
}
try{await run();}finally{cache.close();}
