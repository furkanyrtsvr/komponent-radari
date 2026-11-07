import {test} from 'node:test';
import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import {gzipSync} from 'node:zlib';
import {openPublicationState,putObservation,hash} from '../scripts/catalog/incremental-state';
import {preparePriceCatalog,packCatalogProducts} from '../scripts/catalog/price-catalog';
import {archiveProducts,archivePage} from '../src/lib/archive-discovery';
import {validateArchiveManifest} from '../src/lib/ready-archive';
import {searchReadyProducts,decodeReadyChunk} from '../public/catalog/ready-search.js';
import {catalogQuery,prepareCatalogSearchTitle} from '../public/catalog/product-identity.js';
const at='2026-11-07T13:00:00.000Z',old='2026-11-01T10:00:00.000Z';
function row(id:string,changes:any={}){const url='https://www.ulutaselektronik.com/urun/'+id;return {source_id:id,store_id:'ulutas',url,checked_at:old,payload:JSON.stringify({storeId:'ulutas',checkedAt:old,product:{url,name:'KBU410 4A 1000V Köprü Diyot '+id,mpn:'KBU410',manufacturer:'',model:'KBU410',image:null,price:1788,currency:'TRY',vatIncluded:true,vatRate:20,packageQuantity:1,stockStatus:'in_stock',stockQuantity:10,specifications:'',warnings:[],quantityVerified:true,minimumOrderQuantity:1,orderStep:1,...changes}})};}
function entries(db:DatabaseSync){return (db.prepare('SELECT entry FROM priced_catalog').all() as {entry:string}[]).map(r=>JSON.parse(r.entry));}

test('verified prices publish without an image, reuse existing images and never contact a merchant',async()=>{
 const db=openPublicationState(':memory:'),original=globalThis.fetch;globalThis.fetch=(async()=>{throw Error('Merchant fetch forbidden');}) as typeof fetch;
 try{putObservation(db,row('missing'));putObservation(db,row('remote',{image:'https://cdn.example.com/unavailable.jpg'}));putObservation(db,row('cached',{image:'https://cdn.example.com/cached.jpg'}));db.prepare('INSERT INTO images VALUES(?,?,?,?,?)').run('https://cdn.example.com/cached.jpg','images/'+'a'.repeat(64)+'.webp',100,200,old);
 const result=await preparePriceCatalog(db,at),values=entries(db);assert.equal(result.count,3);assert.equal(result.rejected,0);assert.equal(values.filter(v=>v.preview.imagePending).length,2);assert.equal(values.find(v=>v.source_id==='cached').preview.image,'/api/archive-image/'+'a'.repeat(64)+'.webp');assert.ok(values.every(v=>v.preview.price===1788&&v.checked_at===old));assert.equal(db.prepare('SELECT COUNT(*) n FROM observations').get()!.n,3);
 }finally{globalThis.fetch=original;db.close();}
});

test('invalid tax, missing price, future dates and excluded Ozdisan never become priced offers',async()=>{
 const db=openPublicationState(':memory:');putObservation(db,row('tax',{vatIncluded:false}));putObservation(db,row('zero',{price:0}));const future=row('future');future.checked_at='2026-12-01T00:00:00.000Z';future.payload=JSON.stringify({...JSON.parse(future.payload),checkedAt:future.checked_at});putObservation(db,future);const excluded=row('excluded');excluded.store_id='ozdisan';putObservation(db,excluded);const result=await preparePriceCatalog(db,at);assert.equal(result.count,0);assert.equal(result.rejected,3);assert.equal(db.prepare('SELECT COUNT(*) n FROM observations').get()!.n,4);db.close();
});

test('new verified price is not held back by its new missing image, and no old image is attached',async()=>{
 const db=openPublicationState(':memory:'),previous=row('changed',{image:'https://cdn.example.com/old.jpg'});putObservation(db,previous);const fp=(db.prepare('SELECT fingerprint FROM observations').get() as any).fingerprint;db.prepare('UPDATE observations SET ready=?').run(JSON.stringify({...previous,fingerprint:fp,image_key:'images/'+'b'.repeat(64)+'.webp',bytes:100,original_bytes:200}));const next=row('changed',{image:'https://cdn.example.com/new.jpg',price:2300});next.checked_at='2026-11-07T12:00:00.000Z';next.payload=JSON.stringify({...JSON.parse(next.payload),checkedAt:next.checked_at});putObservation(db,next);await preparePriceCatalog(db,at);const [value]=entries(db);assert.equal(value.preview.price,2300);assert.equal(value.preview.checkedAt,next.checked_at);assert.equal(value.image_key,null);assert.equal(value.preview.imagePending,true);assert.ok((db.prepare('SELECT ready FROM observations').get() as any).ready.includes(previous.checked_at));db.close();
});

test('bad newer observation keeps the last verified offer with its real old date and preserves permanent records',async()=>{
 const db=openPublicationState(':memory:'),previous=row('preserved');putObservation(db,previous);const fp=(db.prepare('SELECT fingerprint FROM observations').get() as any).fingerprint;db.prepare('UPDATE observations SET ready=?').run(JSON.stringify({...previous,fingerprint:fp,image_key:null,bytes:0,original_bytes:0}));const next=row('preserved',{price:999999,quantityVerified:false});next.checked_at='2026-11-07T12:00:00.000Z';next.payload=JSON.stringify({...JSON.parse(next.payload),checkedAt:next.checked_at});putObservation(db,next);await preparePriceCatalog(db,at);const [value]=entries(db);assert.equal(value.preview.price,1788);assert.equal(value.checked_at,old);assert.equal(value.preview.archiveState,'expired');assert.equal((db.prepare('SELECT payload FROM observations').get() as any).payload,next.payload);assert.equal(db.prepare("SELECT COUNT(*) n FROM sqlite_master WHERE name='priced_catalog'").get()!.n,0);db.close();
});

test('both catalog search paths include price-only offers and preserve expiry, store filters and missing-image state',async()=>{
 const db=openPublicationState(':memory:');putObservation(db,row('search'));await preparePriceCatalog(db,at);const [entry]=entries(db),products=archiveProducts([{storeId:'ulutas',preview:entry.preview}],Date.parse(at)),options={query:'KBU410',group:'all',store:'ulutas',page:0};const browser=searchReadyProducts(products,options,Date.parse(at)),server=archivePage(products,options);assert.equal(browser.count,1);assert.equal(server.count,1);assert.equal(browser.previews[0].image,null);assert.equal(browser.previews[0].archiveState,'expired');assert.equal(browser.previews[0].checkedAt,old);assert.equal(searchReadyProducts(products,{...options,store:'robotistan'},Date.parse(at)).count,0);const bad=structuredClone(products);bad[0].previews[0].price=0;assert.equal(searchReadyProducts(bad,options,Date.parse(at)).count,0);db.close();
});

test('browser worker accepts immutable content-addressed catalogs, validates hashes and rejects another object path',async()=>{
 const bytes=gzipSync(JSON.stringify([{key:'test',name:'KBU410',group:'Diğer',sources:[{storeId:'ulutas',url:'https://www.ulutaselektronik.com/urun/test',name:'KBU410'}],previews:[{url:'https://www.ulutaselektronik.com/urun/test',key:'test',price:1788,checkedAt:old,image:null,imagePending:true}]}])),sha=hash(bytes),id='00000000-0000-4000-8000-000000000007';
 const original=globalThis.fetch,originalSelf=(globalThis as any).self,messages:any[]=[];globalThis.fetch=(async()=>new Response(bytes as any)) as typeof fetch;(globalThis as any).self={postMessage:(m:any)=>messages.push(m)};
 try{await import('../public/catalog/ready-worker.js');await (globalThis as any).self.onmessage({data:{requestId:1,manifest:{id,chunks:[{file:'objects/'+sha+'.json.gz',sha256:sha,products:1}]},query:'KBU410',group:'all',store:'all',page:0}});assert.equal(messages.at(-1).count,1);assert.equal(messages.at(-1).done,true);await (globalThis as any).self.onmessage({data:{requestId:2,manifest:{id:id+'-bad',chunks:[{file:'objects/'+('0'.repeat(64))+'.json.gz',sha256:sha,products:1}]},query:'',group:'all',store:'all',page:0}});assert.match(messages.at(-1).error,/Geçersiz/);await assert.rejects(decodeReadyChunk(bytes,'f'.repeat(64)));}finally{globalThis.fetch=original;(globalThis as any).self=originalSelf;}
});

test('packed catalog limits decoded bytes and product count without losing rows or inventing image counts',()=>{
 const input=Array.from({length:100},(_,i)=>({id:i,name:'x'.repeat(50)})),parts=[...packCatalogProducts([input.slice(0,30),input.slice(30)],500)];assert.deepEqual(parts.flat(),input);assert.ok(parts.every(p=>Buffer.byteLength(JSON.stringify(p))<=500));const m={version:1,id:'00000000-0000-4000-8000-000000000007',cutoff:old,preparedAt:at,products:1,offers:1,candidates:1,priceOnlyOffers:1,imageBytes:0,originalImageBytes:0,chunks:[{file:'objects/'+'a'.repeat(64)+'.json.gz',sha256:'a'.repeat(64),bytes:10,products:1}],stores:[{id:'ulutas',offers:1,fresh:0}]};assert.equal(validateArchiveManifest(m).priceOnlyOffers,1);assert.throws(()=>validateArchiveManifest({...m,priceOnlyOffers:2}));
});

test('unchanged prices reuse compact views, changed prices alone are validated and cached images appear independently',async()=>{
 const db=openPublicationState(':memory:');putObservation(db,row('one',{image:'https://cdn.example.com/one.jpg'}));putObservation(db,row('two'));const first=await preparePriceCatalog(db,at);assert.equal(first.validated,2);const second=await preparePriceCatalog(db,at);assert.equal(second.reused,2);assert.equal(second.validated,0);putObservation(db,row('two',{price:2500}));db.prepare('INSERT INTO images VALUES(?,?,?,?,?)').run('https://cdn.example.com/one.jpg','images/'+'c'.repeat(64)+'.webp',80,160,old);const third=await preparePriceCatalog(db,at);assert.equal(third.reused,1);assert.equal(third.validated,1);assert.equal(entries(db).find(v=>v.source_id==='one').image_key,'images/'+'c'.repeat(64)+'.webp');assert.equal(entries(db).find(v=>v.source_id==='two').preview.price,2500);db.close();
});

test('large catalog search copies only the visible forty previews while counting all matches',()=>{
 let copies=0;const products=Array.from({length:1000},(_,i)=>{const v:any={url:'https://example.com/'+i,key:'k'+i,price:100,checkedAt:old,image:null,imagePending:true};Object.defineProperty(v,'archiveState',{enumerable:true,get(){copies++;return 'fresh';}});return {key:v.key,name:'KBU410 '+i,group:'Diğer',sources:[{url:v.url,storeId:'ulutas',name:'KBU410'}],previews:[v]};});const result=searchReadyProducts(products,{query:'KBU410',group:'all',store:'all',page:2},Date.parse(at));assert.equal(result.count,1000);assert.equal(result.results.length,40);assert.equal(result.results[0].key,'k80');assert.equal(result.hasMore,true);assert.equal(copies,40);
});

test('prepared search retains exact voltage, dimension, package and connector matching semantics',()=>{
 const names=['STM32F103C6T6 Geliştirme Kartı','STM32F103C8T6 Geliştirme Kartı','12V 2A Adaptör','24V 2A Adaptör','10k Ohm 1/4W Direnç','10K 1% Direnç','100nF 50V Kondansatör','0.1uF 50V Kondansatör','40 Pin Erkek Dişi 20cm Jumper Kablo','40 Pin Erkek Erkek 20cm Jumper Kablo','KBU410 4A 1000V Köprü Diyot','5 Metre 0.35mm Kablo'];
 for(const query of ['STM32F103C6T6','12V 2A','10k ohm 0.25w','100nF','40 pin erkek dişi 200mm','KBU410','0.35mm kablo']){const matches=catalogQuery(query);for(const name of names)assert.equal(matches.prepared(prepareCatalogSearchTitle(name)),matches(name),query+' / '+name);}
});

test('catalog worker displays the first verified page before remaining files finish loading',async()=>{
 const id='00000000-0000-4000-8000-000000000008',original=globalThis.fetch,originalSelf=(globalThis as any).self,messages:any[]=[];let release!:()=>void;const blocked=new Promise<void>(resolve=>release=resolve);
 function chunk(n:number){const url='https://example.com/'+n,bytes=gzipSync(JSON.stringify([{key:'key'+n,name:'KBU410',group:'Diğer',sources:[{url,storeId:'ulutas',name:'KBU410'}],previews:[{url,key:'key'+n,price:100,checkedAt:old,image:null,imagePending:true}]}]));return {bytes,sha:hash(bytes)};}
 const a=chunk(1),b=chunk(2);globalThis.fetch=(async(url:any)=>{if(String(url).includes(b.sha))await blocked;return new Response((String(url).includes(b.sha)?b.bytes:a.bytes) as any);}) as typeof fetch;(globalThis as any).self={postMessage:(m:any)=>messages.push(m)};
 try{await import(new URL('../public/catalog/ready-worker.js',import.meta.url).href+'?progress-check');const pending=(globalThis as any).self.onmessage({data:{requestId:1,manifest:{id,chunks:[a,b].map(c=>({file:'objects/'+c.sha+'.json.gz',sha256:c.sha,products:1}))},query:'',store:'all',group:'all',page:0}});for(let i=0;i<100&&!messages.some(m=>m.results?.length);i++)await new Promise(r=>setTimeout(r,2));assert.ok(messages.some(m=>m.done===false&&m.results?.length===1&&m.count===null));assert.ok(!messages.some(m=>m.done));release();await pending;assert.equal(messages.at(-1).done,true);assert.equal(messages.at(-1).count,2);}finally{release();globalThis.fetch=original;(globalThis as any).self=originalSelf;}
});
