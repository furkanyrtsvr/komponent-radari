import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,mkdtempSync,mkdirSync,writeFileSync,rmSync,realpathSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {resolve,join,sep,basename} from 'node:path';
import {pathToFileURL} from 'node:url';
import {spawnSync} from 'node:child_process';
import {DatabaseSync} from 'node:sqlite';
import {parseIdeasoftProduct} from '../src/stores/ideasoft';
import {archiveProducts,archivePage} from '../src/lib/archive-discovery';
import {archiveRefreshStatus} from '../src/lib/archive-refresh';
import type {CatalogPreview} from '../src/lib/server/catalog-preview';
const url='https://www.ulutaselektronik.com/urun/kbu410-4a-1000v-kopru-diyot',fixture=resolve('tests/fixtures/requested/ulutas-kbu410.html');
const empty:CatalogPreview={url,name:'',image:null,key:'',price:null,checkedAt:'',stockStatus:'unknown',archiveState:'missing',message:''};
test('the actual KBU410 page verifies net14.90, gross17.88TRY, stock and its own product image',()=>{
 const p=parseIdeasoftProduct(readFileSync(fixture,'utf8'),url);assert.equal(p.price,1788);assert.equal(p.priceNet,1490);assert.equal(p.mpn,'DY1198');assert.equal(p.stockQuantity,1981);assert.equal(p.quantityVerified,true);assert.match(p.image!,/624\/image-2021/);
});
test('a verified price without an image stays discoverable; unpriced records still cannot enter the priced archive',()=>{
 const at=Date.now(),preview={...empty,name:'KBU410 4A 1000V Köprü Diyot',key:'title:kbu410',price:1788,checkedAt:new Date(at-1000).toISOString(),archiveState:'fresh' as const};
 const products=archiveProducts([{storeId:'ulutas',preview},{storeId:'ulutas',preview:{...empty,name:'Other',key:'other'}}],at);
 const page=archivePage(products,{query:'KBU410',store:'all',group:'all',page:0});assert.equal(page.count,1);assert.equal(page.previews[0].image,null);assert.equal(page.previews[0].price,1788);
});
test('job polling is read-only and preserves old amount/date through pending, failed and completed states',async()=>{
 const p={...empty,price:1788,checkedAt:'2026-10-21T12:00:00Z',archiveState:'expired' as const};
 for(const status of ['collector_pending','collector_failed','collector_completed']){
  let calls=0;const [next]=await archiveRefreshStatus([p],[{id:'ulutas',domain:'www.ulutaselektronik.com',enabled:1}],async()=>{calls++;return {status,error:'Page unavailable'};});assert.equal(calls,1);assert.equal(next.price,p.price);assert.equal(next.checkedAt,p.checkedAt);assert.equal(next.collectorPending,status==='collector_pending');
 }
});
test('request-only collector skips the million-link index, reads only the requested page and uploads a real dated observation without replacing global status',()=>{
 const directory=mkdtempSync(join(tmpdir(),'eub-request-only-'));
 try{
  mkdirSync(join(directory,'public/catalog'),{recursive:true});writeFileSync(join(directory,'public/catalog/manifest.json'),JSON.stringify({stores:[{chunks:[{key:'MUST-NOT-BE-READ.json'}]}]}));
  const hook=join(directory,'mock.mjs'),trace=join(directory,'trace.jsonl'),saved=join(directory,'records.json');
  writeFileSync(hook,`import {readFileSync,appendFileSync,writeFileSync} from 'node:fs';
globalThis.fetch=async(input,options={})=>{const u=new URL(String(input)),method=options.method||'GET';appendFileSync(${JSON.stringify(trace)},JSON.stringify({url:u.href,method})+'\\n');
if(u.origin==='https://collector.test'&&u.pathname==='/api/catalog-snapshot'){
if(method==='GET')return Response.json({requests:[{id:'00000000-0000-4000-8000-000000000001',storeId:'ulutas',url:${JSON.stringify(url)},requestedAt:new Date().toISOString()}],watchlist:[]});
if(method==='POST'){const b=JSON.parse(options.body);writeFileSync(${JSON.stringify(saved)},JSON.stringify(b));return Response.json({saved:b.records.length,ignored:0});}
throw new Error('Unexpected global status or failure write: '+method);}
if(u.origin==='https://www.ulutaselektronik.com'&&u.pathname==='/robots.txt')return new Response('User-agent: *\\nAllow: /');
if(u.href===${JSON.stringify(url)})return new Response(readFileSync(${JSON.stringify(fixture)},'utf8'));
throw new Error('Unexpected external request: '+u.href);};`);
  const result=spawnSync(process.execPath,['--import',pathToFileURL(resolve('node_modules/tsx/dist/loader.mjs')).href,'--import',pathToFileURL(hook).href,resolve('scripts/catalog/catalogue-b.ts'),'--collect','--requests-only','--limit=8','--site=https://collector.test'],{cwd:directory,env:{...process.env,CATALOG_INGEST_SECRET:'local-test-request-collector-secret-000000'},encoding:'utf8',timeout:30000});
  assert.equal(result.status,0,result.stderr+'\n'+result.stdout);
  const records=JSON.parse(readFileSync(saved,'utf8')).records;assert.equal(records.length,1);assert.equal(records[0].product.price,1788);assert.equal(records[0].requestedUrl,url);assert.ok(Date.now()-Date.parse(records[0].checkedAt)<30000);
  const calls=readFileSync(trace,'utf8').trim().split('\n').map(line=>JSON.parse(line));assert.ok(calls.every(r=>r.method!=='PUT'));assert.equal(calls.filter(r=>r.url===url).length,1);
  const db=new DatabaseSync(join(directory,'work/catalogue-requests/catalogue.sqlite'));assert.equal(db.prepare('SELECT COUNT(*) AS n FROM products').get()!.n,1);assert.equal(db.prepare('SELECT COUNT(*) AS n FROM history').get()!.n,1);db.close();
 }finally{const target=realpathSync(directory);assert.ok(target.startsWith(realpathSync(tmpdir())+sep)&&basename(target).startsWith('eub-request-only-'));rmSync(target,{recursive:true,force:true});}
});
