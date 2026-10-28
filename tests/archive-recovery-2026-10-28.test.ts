import test from 'node:test';
import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import {mkdtempSync,readFileSync,writeFileSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {gzipSync,gunzipSync} from 'node:zlib';
import {ByteCache,boundedText,assetPage,ARCHIVE_CACHE_BYTES} from '../src/lib/archive-runtime-bounds';
import {transferRecords,TransferError,retryNetwork} from '../scripts/catalog/reliable-transfer';
import {retainLocalCheckpoint,compactCollectorCheckpoint} from '../scripts/catalog/bootstrap-queue';
import {finishTransferRound,type BootstrapJob} from '../src/lib/archive-bootstrap';

test('decoded objects stay inside a byte budget and oversized streams are cancelled',async()=>{
 const cache=new ByteCache<object>();for(let i=0;i<100;i++){cache.set(String(i),{i},700000);assert.ok(cache.bytes<=ARCHIVE_CACHE_BYTES);}assert.equal(cache.get('0'),undefined);cache.set('huge',{},ARCHIVE_CACHE_BYTES);assert.equal(cache.get('huge'),undefined);
 let cancelled=false;const stream=new ReadableStream<Uint8Array>({pull(controller){controller.enqueue(new Uint8Array(65536));},cancel(){cancelled=true;}});await assert.rejects(()=>boundedText(stream,100000),/bellek/);assert.equal(cancelled,true);
 const assets=Array.from({length:513},(_,id)=>({id})),seen:number[]=[];let cursor=0;while(cursor<assets.length){const page=assetPage(assets,cursor);assert.ok(page.rows.length<=6);seen.push(...page.rows.map(x=>x.id));cursor=page.next;}assert.equal(new Set(seen).size,513);assert.throws(()=>assetPage(assets,514));
});

test('timeouts after a remote commit replay idempotently and preserve original observation dates',async()=>{
 const original='2026-10-26T10:00:00.000Z',records=Array.from({length:23},(_,id)=>({id,checkedAt:original})),remote=new Set<number>(),acknowledged:number[]=[];let loseResponse=true;
 const request=(async(_url:any,options:any)=>{const batch=JSON.parse(options.body).records;assert.ok(batch.length<=10);assert.ok(Buffer.byteLength(options.body)<=200000);assert.ok(batch.every((r:any)=>r.checkedAt===original));let saved=0;for(const r of batch)if(!remote.has(r.id)){remote.add(r.id);saved++;}if(loseResponse){loseResponse=false;throw new DOMException('Lost acknowledgement','TimeoutError');}return Response.json({saved,ignored:batch.length-saved});}) as typeof fetch;
 assert.equal(await transferRecords(records,'https://collector.example',{},batch=>acknowledged.push(...batch.map(r=>r.id)),{fetch:request,sleep:async()=>{}}),23);assert.equal(remote.size,23);assert.deepEqual(acknowledged,records.map(r=>r.id));
});

test('partial success remains acknowledged and failing batches shrink before a later resume',async()=>{
 const records=Array.from({length:25},(_,id)=>({id})),acknowledged=new Set<number>();let outage=true;
 const request=(async(_url:any,options:any)=>{const rows=JSON.parse(options.body).records;if(outage&&rows.some((r:any)=>r.id>=10))throw new DOMException('offline','TimeoutError');if(rows.length>2&&rows[0].id>=10)return new Response('',{status:413});return Response.json({saved:rows.length,ignored:0});}) as typeof fetch;
 const ack=(rows:{id:number}[])=>rows.forEach(row=>acknowledged.add(row.id));await assert.rejects(()=>transferRecords(records,'https://collector.example',{},ack,{fetch:request,sleep:async()=>{},attempts:1}),TransferError);assert.equal(acknowledged.size,10);outage=false;const pending=records.filter(row=>!acknowledged.has(row.id));assert.equal(await transferRecords(pending,'https://collector.example',{},ack,{fetch:request,sleep:async()=>{},attempts:1}),15);assert.equal(acknowledged.size,25);
});

test('90,483 queue rows and all 488 unacknowledged prices survive checkpoint compaction and restore',()=>{
 const directory=mkdtempSync(join(tmpdir(),'kr-90483-')),file=join(directory,'queue.sqlite'),restored=join(directory,'restored.sqlite');let db=new DatabaseSync(file);
 try{db.exec("CREATE TABLE metadata(key TEXT PRIMARY KEY,value TEXT);INSERT INTO metadata VALUES('bootstrap_job','same-initial-job');CREATE TABLE products(store_id TEXT,url TEXT,active INTEGER,last_attempt TEXT,checked_at TEXT,payload TEXT,uploaded_at TEXT);WITH RECURSIVE n(x) AS (VALUES(1) UNION ALL SELECT x+1 FROM n WHERE x<90483) INSERT INTO products SELECT 'ulutas','https://shop.example/'||x,1,'2026-10-28T14:00:00.000Z','2026-10-28T14:00:00.000Z',json_object('readerRevision',2,'checkedAt','2026-10-28T14:00:00.000Z','product',json_object('price',1788)),CASE WHEN x<=89995 THEN 'ack' ELSE NULL END FROM n;");assert.equal(retainLocalCheckpoint(db,'same-initial-job',90483),true);assert.equal(retainLocalCheckpoint(db,'another-job',90483),false);assert.equal(retainLocalCheckpoint(db,'same-initial-job',90484),false);compactCollectorCheckpoint(db);db.close();writeFileSync(restored,gunzipSync(gzipSync(readFileSync(file))));db=new DatabaseSync(restored);assert.equal(db.prepare('SELECT COUNT(*) AS n FROM products').get()!.n,90483);assert.equal(db.prepare('SELECT COUNT(*) AS n FROM products WHERE uploaded_at IS NULL AND json_extract(payload,\'$.product.price\')=1788').get()!.n,488);assert.equal(retainLocalCheckpoint(db,'same-initial-job',90483),true);}finally{db.close();rmSync(directory,{recursive:true,force:true});}
});

test('temporary transfer failure queues a safe retry while explicit pause and permanent errors remain respected',()=>{
 const job={id:'original',revision:1,state:'running',stage:'prices',createdAt:'2026-10-25T00:00:00Z',updatedAt:'2026-10-28T00:00:00Z',checkpointAt:'2026-10-28T14:30:53Z',checkpointKey:'original-checkpoint',workedSeconds:10,windowHours:12,stopRequested:false,lastReady:8901,lastAttempted:90483,stalledRounds:2,lastError:'',progress:{stores:[{storeId:'ulutas',indexed:200517,attempted:90483,verified:80874,failed:9609,unseen:110034}]}} as BootstrapJob;
 const next=finishTransferRound(job,60,8901,'timeout',true);assert.equal(next.state,'queued');assert.equal(next.lastAttempted,90483);assert.equal(next.checkpointKey,'original-checkpoint');assert.equal(next.stalledRounds,0);assert.equal(finishTransferRound({...job,stopRequested:true},60,8901,'timeout',true).state,'paused');assert.equal(finishTransferRound(job,60,8901,'invalid schema',false).state,'attention');
});

test('checkpoint retries only transient failures without replacing the last safe pointer',async()=>{
 let attempts=0,pointer='saved-90483';
 const result=await retryNetwork(async()=>{attempts++;if(attempts<3)throw new DOMException('network timeout','TimeoutError');pointer='saved-90484';return pointer;},async()=>{});assert.equal(attempts,3);assert.equal(result,'saved-90484');
 attempts=0;await assert.rejects(()=>retryNetwork(async()=>{attempts++;throw new Error('invalid lease');},async()=>{}));assert.equal(attempts,1);assert.equal(pointer,'saved-90484');
});
