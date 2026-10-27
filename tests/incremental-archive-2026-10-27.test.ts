import test from 'node:test';
import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import {readFileSync,mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join,resolve} from 'node:path';
import {createServer} from 'node:http';
import {spawn} from 'node:child_process';
import {gunzipSync} from 'node:zlib';
import {COPY_ARCHIVE_DELTA_SQL} from '../src/lib/archive-batch-sql';
import {openPublicationState,putObservation,pendingObservations} from '../scripts/catalog/incremental-state';
import {validateArchiveManifest} from '../src/lib/ready-archive';

test('late uploads and same-date reader corrections enter the delta without touching old snapshots',()=>{
 const db=new DatabaseSync(':memory:');db.exec('CREATE TABLE catalog_snapshots(id TEXT PRIMARY KEY,store_id TEXT,url TEXT,checked_at TEXT,payload TEXT);CREATE TABLE archive_batch_rows(id TEXT,batch_id TEXT,source_id TEXT,store_id TEXT,url TEXT,checked_at TEXT,payload TEXT);');
 db.exec(readFileSync('drizzle/0008_tense_omega_red.sql','utf8').replaceAll('--> statement-breakpoint',''));
 const insert=db.prepare('INSERT INTO catalog_snapshots VALUES(?,?,?,?,?)');insert.run('old','ulutas','https://ulutaselektronik.com/old','2026-10-20T00:00:00Z','old');
 const cursor=Number(db.prepare('SELECT MAX(seq) AS n FROM catalog_archive_changes').get()!.n);
 insert.run('late','ulutas','https://ulutaselektronik.com/late','2026-10-19T00:00:00Z','late');
 db.prepare('UPDATE catalog_snapshots SET payload=? WHERE id=?').run('corrected','old');
 const watermark=Number(db.prepare('SELECT MAX(seq) AS n FROM catalog_archive_changes').get()!.n);
 db.prepare(COPY_ARCHIVE_DELTA_SQL).run('batch','batch','2026-10-27T00:00:00Z',cursor,watermark);
 assert.deepEqual(db.prepare('SELECT source_id FROM archive_batch_rows ORDER BY source_id').all().map(r=>r.source_id),['late','old']);
 insert.run('next','ulutas','https://ulutaselektronik.com/next','2026-10-21T00:00:00Z','next');
 db.prepare(COPY_ARCHIVE_DELTA_SQL).run('next-batch','next-batch','2026-10-27T00:00:00Z',watermark,999);
 assert.deepEqual(db.prepare('SELECT source_id FROM archive_batch_rows WHERE batch_id=?').all('next-batch').map(r=>r.source_id),['next']);db.close();
});

test('a changed price with an unfinished image preserves the previous complete observation across restart',()=>{
 const directory=mkdtempSync(join(tmpdir(),'kr-state-')),file=join(directory,'state.sqlite');let db=openPublicationState(file);
 try{const row={source_id:'one',store_id:'ulutas',url:'https://www.ulutaselektronik.com/one',checked_at:'2026-10-26T01:00:00Z',payload:'original'};assert.equal(putObservation(db,row),true);db.prepare('UPDATE observations SET ready=?').run(JSON.stringify({fingerprint:pendingObservations(db)[0].fingerprint,price:100,checkedAt:row.checked_at}));assert.equal(putObservation(db,row),false);assert.equal(pendingObservations(db).length,0);assert.equal(putObservation(db,{...row,checked_at:'2026-10-27T01:00:00Z',payload:'new image unavailable'}),true);db.close();db=openPublicationState(file);assert.equal(pendingObservations(db).length,1);const ready=JSON.parse(String(db.prepare('SELECT ready FROM observations').get()!.ready));assert.equal(ready.price,100);assert.equal(ready.checkedAt,row.checked_at);}finally{db.close();rmSync(directory,{recursive:true,force:true});}
});

test('independent publisher resumes durable state, skips unchanged objects/images, and retains the live edition after failure',async()=>{
 const directory=mkdtempSync(join(tmpdir(),'kr-publish-')),objects=new Map<string,Buffer>();let checkpoint:Buffer|undefined,checkpointHash='',active:any,sequence=2,failPublish=false,imagesEnumerated=0;
 const photo='images/'+'a'.repeat(64)+'.webp',date='2026-10-26T01:00:00.000Z';
 function observation(id:string,name:string,price:number,checkedAt=date){const url='https://www.ulutaselektronik.com/urun/'+id,record={readerRevision:2,storeId:'ulutas',checkedAt,product:{url,name,mpn:id,manufacturer:'',model:'',image:'https://cdn.ulutaselektronik.com/'+id+'.jpg',price,currency:'TRY',vatIncluded:true,vatRate:20,packageQuantity:1,minimumOrderQuantity:1,orderStep:1,quantityVerified:true,stockStatus:'in_stock',stockQuantity:10,specifications:'',warnings:[]}};return {source_id:id,store_id:'ulutas',url,checked_at:checkedAt,payload:JSON.stringify(record)};}
 let rows=[observation('kbu410','KBU410 4A 1000V Köprü Diyot',1788),observation('max7219','MAX7219 8x8 LED Modül',10000)];const changedSeq=new Map(rows.map((r,i)=>[r.source_id,i+1])),batches=new Map<string,any>();
 const server=createServer(async(req,res)=>{try{const url=new URL(req.url!,'http://localhost'),parts:Buffer[]=[];for await(const bytes of req)parts.push(bytes);const raw=Buffer.concat(parts);let body:any=raw.length&&req.headers['content-type']==='application/json'?JSON.parse(raw.toString()):null;res.setHeader('content-type','application/json');
 if(url.pathname==='/api/archive-publisher-state'){if(req.method==='POST'){res.end('{}');return;}if(req.method==='GET'){if(!checkpoint){res.statusCode=404;res.end('{}');return;}res.setHeader('x-checkpoint-sha256',checkpointHash);res.end(checkpoint);return;}checkpoint=raw;checkpointHash=String(req.headers['x-checkpoint-sha256']);res.end('{"saved":true}');return;}
 if(url.pathname.startsWith('/api/archive-assets/')){objects.set(url.pathname.slice('/api/archive-assets/'.length),raw);res.end(JSON.stringify({bytes:raw.length}));return;}
 if(url.pathname==='/api/archive-build'&&req.method==='GET'){
 if(url.searchParams.has('seed')){const index=JSON.parse(gunzipSync(objects.get(active.sourceIndex.file)!).toString());res.end(JSON.stringify({rows:Object.values(index.shards).flatMap((p:any)=>JSON.parse(gunzipSync(objects.get(p.file)!).toString())),next:null}));return;}
 if(url.searchParams.has('images')){imagesEnumerated++;res.end(JSON.stringify({rows:rows.map(r=>({url:JSON.parse(r.payload).product.image,key:photo,bytes:1000,original_bytes:4000})),next:null}));return;}
 if(url.searchParams.has('imageUrl'))throw new Error('Known images must not be looked up or downloaded again.');
 res.end(JSON.stringify(url.searchParams.get('cursor')?[]:batches.get(url.searchParams.get('id')!)?.rows||[]));return;}
 if(body?.action==='begin'){const reset=body.base!==active?.id,delta=rows.filter(r=>reset||(changedSeq.get(r.source_id)||0)>body.cursor),batch={id:body.id,cutoff:new Date().toISOString(),sequence,candidates:delta.length,reset,base:active?.id||null,baseOffers:active?.offers||0,rows:delta};batches.set(body.id,batch);res.end(JSON.stringify(batch));return;}
 if(body?.action==='ready'){res.end('{"ready":true}');return;}
 if(body?.action==='publish'){if(failPublish){res.statusCode=503;res.end('{"error":"injected publication failure"}');return;}active=validateArchiveManifest(body.manifest);res.end('{"published":true}');return;}
 throw new Error('Unexpected request '+url.pathname);
 }catch(e){res.statusCode=500;res.end(JSON.stringify({error:String(e)}));}});
 await new Promise<void>(r=>server.listen(0,'127.0.0.1',r));const address=server.address() as {port:number};
 async function run(){return new Promise<{code:number|null;log:string}>(r=>{let log='';const child=spawn(process.execPath,['--import','tsx',resolve('scripts/catalog/publish-incremental.ts')],{cwd:process.cwd(),env:{...process.env,CATALOG_INGEST_SECRET:'test-secret-'.repeat(4),ARCHIVE_SITE:'http://127.0.0.1:'+address.port,PUBLICATION_WORKDIR:directory}});child.stdout.on('data',d=>log+=d);child.stderr.on('data',d=>log+=d);child.on('close',code=>r({code,log}));});}
 try{
 const first=await run();assert.equal(first.code,0,first.log);assert.equal(active.offers,2);assert.ok(checkpoint);const originalDate=JSON.parse(gunzipSync(objects.get(active.chunks[0].file)!).toString())[0].previews[0].checkedAt;assert.equal(originalDate,date);const firstObjects=objects.size;
 const second=await run();assert.equal(second.code,0,second.log);assert.match(second.log,/"changed":0/);assert.match(second.log,/"downloadedImages":0/);assert.match(second.log,/"uploadedObjects":0/);assert.equal(objects.size,firstObjects);assert.equal(imagesEnumerated,1);
 const beforeFailure=active.id;sequence++;rows=[observation('kbu410','KBU410 4A 1000V Köprü Diyot',2000,'2026-10-27T01:00:00.000Z'),rows[1]];changedSeq.set('kbu410',sequence);failPublish=true;const failed=await run();assert.notEqual(failed.code,0);assert.equal(active.id,beforeFailure);
 failPublish=false;const resumed=await run();assert.equal(resumed.code,0,resumed.log);assert.match(resumed.log,/"changed":0/);assert.match(resumed.log,/"downloadedImages":0/);assert.equal(active.offers,2);
 const products=active.chunks.flatMap((c:any)=>JSON.parse(gunzipSync(objects.get(c.file)!).toString())),previews=products.flatMap((p:any)=>p.previews);assert.equal(previews.find((p:any)=>p.url.includes('kbu410')).price,2000);assert.equal(previews.find((p:any)=>p.url.includes('max7219')).checkedAt,date);assert.ok(previews.every((p:any)=>p.image.endsWith('a'.repeat(64)+'.webp')));
 // Lose both runner and publisher caches: seed every old ready row before a newer invalid observation.
 checkpoint=undefined;rmSync(join(directory,'publication.sqlite'));sequence++;
 const invalid=JSON.parse(rows[0].payload);invalid.product.currency='USD';rows[0]={...rows[0],payload:JSON.stringify(invalid)};changedSeq.set('kbu410',sequence);
 const recovered=await run();assert.equal(recovered.code,0,recovered.log);assert.match(recovered.log,/"phase":"preserved-baseline","offers":2/);assert.match(recovered.log,/"downloadedImages":0/);assert.equal(active.offers,2);
 const preserved=active.chunks.flatMap((c:any)=>JSON.parse(gunzipSync(objects.get(c.file)!).toString())).flatMap((p:any)=>p.previews);assert.equal(preserved.find((p:any)=>p.url.includes('kbu410')).price,2000);

 }finally{server.closeAllConnections();await new Promise<void>(r=>server.close(()=>r()));rmSync(directory,{recursive:true,force:true});}
});
