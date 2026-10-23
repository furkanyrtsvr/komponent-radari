import test from 'node:test';
import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import {registerCollectorRequests} from '../scripts/catalog/collector-requests';
import {collectionQueue} from '../scripts/catalog/queue';
import {usesCollector,normalizeCollectorUrl,needsCollectorRequest,collectorResultMatches,COLLECTOR_RETRY_MS,COLLECTOR_TTL_MS,type CollectorJob} from '../src/lib/collector-routing';
import {safeRedirectUrl,JsonLdAdapter} from '../src/stores/base';
import {offerAvailability} from '../src/lib/offer-availability';
import {linkQuotes} from '../src/lib/link-quotes';
import {optimize} from '../src/lib/optimizer';
import {demoOffers,storeCatalog} from '../src/lib/catalog';
import {validateSnapshot,SNAPSHOT_TRUST_SQL} from '../src/lib/catalog-snapshot';
import {ROBOTISTAN_TAX_PROOF} from '../src/lib/merchant-price-proof';
const at=Date.parse('2026-10-23T15:00:00.000Z'),date=new Date(at).toISOString();
const request={id:'11111111-1111-4111-8111-111111111111',storeId:'robotistan',url:'https://robotistan.com/a?variant=1#section',requestedAt:date};
function database(){const db=new DatabaseSync(':memory:');db.exec(`CREATE TABLE products(store_id TEXT,url TEXT,name TEXT,category TEXT,source_category TEXT,generation TEXT,active INTEGER DEFAULT 1,priority INTEGER DEFAULT 0,next_due TEXT DEFAULT '',last_attempt TEXT,error TEXT,checked_at TEXT,payload TEXT,uploaded_at TEXT,PRIMARY KEY(store_id,url))`);return db;}

test('only the five configured blocked/regional merchants use the collector route',()=>{
 for(const id of ['robotistan','robotzade','robitshop','ulutas','f1depo'])assert.equal(usesCollector(id),true);
 for(const id of ['direnc','robotsepeti','ozdisan','unknown'])assert.equal(usesCollector(id),false);
});
test('collector URLs preserve product variants, normalize aliases and reject foreign or credentialed addresses',()=>{
 assert.equal(normalizeCollectorUrl(request.url,'www.robotistan.com'),'https://www.robotistan.com/a?variant=1');
 for(const url of ['http://robotistan.com/a','https://evil.example/a','https://robotistan.com:444/a','https://name:secret@robotistan.com/a'])assert.throws(()=>normalizeCollectorUrl(url,'www.robotistan.com'));
});
test('repeated pending requests retain their queue place; completed and failed requests respect retry bounds',()=>{
 const job:CollectorJob={id:request.id,store_id:request.storeId,url:request.url,status:'collector_pending',created_at:date,error:null,finished_at:null};
 assert.equal(needsCollectorRequest(undefined,at),true);assert.equal(needsCollectorRequest(job,at+86400000),false);
 for(const status of ['collector_failed','collector_completed']){
  const done={...job,status,finished_at:date};assert.equal(needsCollectorRequest(done,at+COLLECTOR_RETRY_MS-1),false);assert.equal(needsCollectorRequest(done,at+COLLECTOR_RETRY_MS),true);
 }
 assert.equal(collectorResultMatches(job,date),true);assert.equal(collectorResultMatches(job,new Date(at-1).toISOString()),false);assert.equal(collectorResultMatches({...job,status:'collector_completed'},date),false);
});
test('a previously unindexed requested URL is inserted durably and processed before ordinary discovery',()=>{
 const db=database();try{
  db.prepare(`INSERT INTO products(store_id,url,name,category,source_category,generation) VALUES('robotistan','https://www.robotistan.com/discovery','','','','g')`).run();
  const accepted=registerCollectorRequests(db,[request],[{id:'robotistan',domain:'www.robotistan.com'}],'g',at);
  assert.equal(accepted.length,1);assert.equal(accepted[0].url,'https://www.robotistan.com/a?variant=1');
  assert.equal(collectionQueue(db,'robotistan',1,false,at)[0].url,accepted[0].url);
  registerCollectorRequests(db,[request],[{id:'robotistan',domain:'www.robotistan.com'}],'g',at);
  assert.equal((db.prepare('SELECT COUNT(*) AS n FROM products').get() as any).n,2);
 }finally{db.close();}
});
test('a new explicit request wakes an old backoff but an already attempted request cannot cause a retry loop',()=>{
 const db=database();try{
  const stores=[{id:'robotistan',domain:'www.robotistan.com'}];registerCollectorRequests(db,[request],stores,'g',at);
  db.prepare('UPDATE products SET last_attempt=?,next_due=?,error=?').run(date,new Date(at+COLLECTOR_TTL_MS).toISOString(),'403');
  registerCollectorRequests(db,[request],stores,'g',at);assert.equal(collectionQueue(db,'robotistan',3,false,at).length,0);
  const newer={...request,requestedAt:new Date(at+COLLECTOR_RETRY_MS).toISOString()};registerCollectorRequests(db,[newer],stores,'g',at+COLLECTOR_RETRY_MS);assert.equal(collectionQueue(db,'robotistan',3,false,at+COLLECTOR_RETRY_MS).length,1);
 }finally{db.close();}
});
test('invalid jobs cannot insert arbitrary URLs into the collector database',()=>{
 const db=database();try{
  const rows=[{...request,url:'https://evil.example/a'},{...request,url:'http://robotistan.com/a'},{...request,id:'bad'},{...request,requestedAt:'bad'},{...request,requestedAt:new Date(at+120000).toISOString()}];
  assert.equal(registerCollectorRequests(db,rows,[{id:'robotistan',domain:'www.robotistan.com'}],'g',at).length,0);
  assert.equal((db.prepare('SELECT COUNT(*) AS n FROM products').get() as any).n,0);
 }finally{db.close();}
});
test('requested products are processed in request order rather than letting never-read URLs overtake older requests',()=>{
 const db=database();try{
  const stores=[{id:'robotistan',domain:'www.robotistan.com'}];
  registerCollectorRequests(db,[request],stores,'g',at);db.prepare('UPDATE products SET last_attempt=?').run(new Date(at-3600000).toISOString());
  registerCollectorRequests(db,[{...request,id:'22222222-2222-4222-8222-222222222222',url:'https://www.robotistan.com/new',requestedAt:new Date(at+1000).toISOString()}],stores,'g',at+1000);
  assert.equal(collectionQueue(db,'robotistan',1,false,at+1000)[0].url,'https://www.robotistan.com/a?variant=1');
 }finally{db.close();}
});
test('collector quotes show archive origin, keep observed time and expire at twelve hours',()=>{
 const o={...demoOffers[0],source:'live',vat_included:1,last_error:null,price_source:'collector' as const,snapshot_max_age_ms:COLLECTOR_TTL_MS,last_checked_at:new Date(Date.now()-3600000).toISOString(),price_gross:1000,package_quantity:1,minimum_order_quantity:1,order_step:1,stock_status:'in_stock',stock_quantity:100};
 const state=offerAvailability([o]);assert.equal(state.label,'Toplayıcı arşivi');assert.equal(state.price,1000);assert.match(state.note,/son kontrol/);assert.equal(state.offer?.last_checked_at,o.last_checked_at);
 assert.equal(linkQuotes([o],storeCatalog,1)[0].fromCollector,true);
 assert.equal(offerAvailability([o],1,{at:Date.parse(o.last_checked_at)+COLLECTOR_TTL_MS}).price,null);
 const expired={...o,last_checked_at:new Date(Date.now()-COLLECTOR_TTL_MS-1000).toISOString()};
 assert.equal(linkQuotes([expired],storeCatalog,1).length,0);
 const item={id:'i',cart_id:'c',canonical_product_id:o.canonical_product_id,quantity:1,added_by:'t',notes:'',allow_alternative:0,preferred_manufacturer:'',maximum_unit_price:null,created_at:''};
 assert.equal(optimize([item],[expired],storeCatalog).scenarios.length,0);
});
test('Robotistan ingest rejects missing positive domestic tax proof even on fresh observations',()=>{
 const record={storeId:'robotistan',checkedAt:date,product:{url:'https://www.robotistan.com/a',name:'a',mpn:'',manufacturer:'',model:'',image:null,price:120,currency:'TRY',vatIncluded:true,vatRate:.2,packageQuantity:1,stockStatus:'in_stock',stockQuantity:5,specifications:'{}',warnings:[ROBOTISTAN_TAX_PROOF],quantityVerified:true,minimumOrderQuantity:1,orderStep:1}};
 assert.ok(validateSnapshot(record,[{id:'robotistan',domain:'www.robotistan.com'}],at));
 for(const changes of [{vatRate:0},{vatRate:null},{warnings:[]}])assert.throws(()=>validateSnapshot({...record,product:{...record.product,...changes}},[{id:'robotistan',domain:'www.robotistan.com'}],at),/KDV/);
});
test('archive counts omit old or zero-VAT Robotistan records without deleting price history',()=>{
 const db=new DatabaseSync(':memory:');try{
  db.exec('CREATE TABLE catalog_snapshots(store_id TEXT,payload TEXT)');const put=db.prepare('INSERT INTO catalog_snapshots VALUES(?,?)');
  put.run('robotistan',JSON.stringify({product:{vatRate:0,warnings:[ROBOTISTAN_TAX_PROOF]}}));put.run('robotistan',JSON.stringify({product:{vatRate:.2,warnings:[]}}));put.run('robotistan',JSON.stringify({product:{vatRate:.2,warnings:[ROBOTISTAN_TAX_PROOF]}}));put.run('robotzade',JSON.stringify({product:{vatRate:.2,warnings:[]}}));
  assert.equal((db.prepare(`SELECT COUNT(*) AS n FROM catalog_snapshots WHERE ${SNAPSHOT_TRUST_SQL}`).get() as any).n,2);assert.equal((db.prepare('SELECT COUNT(*) AS n FROM catalog_snapshots').get() as any).n,4);
 }finally{db.close();}
});
test('same-merchant redirect aliases retain the requested queue key and original observation date; foreign aliases are rejected',()=>{
 const row={storeId:'robotzade',requestedUrl:'https://robotzade.com/old#detail',checkedAt:date,product:{url:'https://www.robotzade.com/new',name:'Sensor',mpn:'',manufacturer:'',model:'',image:null,price:120,currency:'TRY',vatIncluded:true,vatRate:.2,packageQuantity:1,stockStatus:'in_stock',stockQuantity:5,specifications:'{}',warnings:[],quantityVerified:true,minimumOrderQuantity:1,orderStep:1}};
 const stores=[{id:'robotzade',domain:'www.robotzade.com'}],validated=validateSnapshot(row,stores,at);
 assert.equal(validated.requestedUrl,'https://www.robotzade.com/old');assert.equal(validated.product.url,'https://www.robotzade.com/new');assert.equal(validated.checkedAt,date);
 for(const requestedUrl of ['https://evil.example/a','http://www.robotzade.com/a','https://u:p@www.robotzade.com/a'])assert.throws(()=>validateSnapshot({...row,requestedUrl},stores,at));
});
test('same-host legacy HTTP redirects are upgraded without an insecure fetch and foreign destinations stay blocked',async()=>{
 const base=new URL('https://www.robotistan.com/old');
 assert.equal(safeRedirectUrl('http://www.robotistan.com/new',base,'www.robotistan.com').href,'https://www.robotistan.com/new');
 for(const url of ['https://evil.example/a','http://evil.example/a','http://u:p@robotistan.com/a','http://robotistan.com:8080/a'])assert.throws(()=>safeRedirectUrl(url,base,'www.robotistan.com'));
 const original=globalThis.fetch,calls:string[]=[];
 globalThis.fetch=async(input)=>{const url=String(input);calls.push(url);if(url.endsWith('/robots.txt'))return new Response('User-agent: *\nAllow: /');if(url.endsWith('/old'))return new Response('',{status:301,headers:{location:'http://legacy-merchant.example/new'}});return new Response('<h1>Product</h1>');};
 class Probe extends JsonLdAdapter{read(url:string){return this.readPage(url);}}
 try{const page=await new Probe({id:'legacy',domain:'legacy-merchant.example'}).read('https://legacy-merchant.example/old');assert.equal(page.url,'https://legacy-merchant.example/new');assert.ok(calls.every(u=>u.startsWith('https://')));}finally{globalThis.fetch=original;}
});
