import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {productIdentity,catalogQuery} from '../public/catalog/product-identity.js';
import {matchedCatalogSources} from '../src/lib/catalog-display-sources';

test('a development board never displays loose-chip discovery candidates as its merchant counterparts',()=>{
 const board='STM32F103C6T6A Geliştirme Kartı',key=productIdentity({name:board});
 const sources=[{url:'https://a.test/board',name:board},{url:'https://b.test/chip',name:'STM32F103C6T6A STMicroelectronics Mikrodenetleyici IC'},{url:'https://c.test/chip',name:'STM32F103C6T6A 48 LQFP Mikrodenetleyici ARM'},{url:'https://d.test/other',name:'STM32F103C6T6 Geliştirme Kartı'}];
 assert.deepEqual(matchedCatalogSources(sources,key,{}).map(s=>s.url),['https://a.test/board']);
 const observed={'https://a.test/board':{key:'contradicted'},'https://d.test/other':{key}};
 assert.deepEqual(matchedCatalogSources(sources,key,observed).map(s=>s.url),['https://d.test/other']);
});

test('model family retrieval is broader than identity, while numeric technical values stay exact',()=>{
 for(const [query,name] of [['stm32','STM32F103C6T6A Geliştirme Kartı'],['STM32F103C6T6','STM32F103C6T6A Geliştirme Kartı'],['esp32','ESP32S3 Geliştirme Kartı']])assert.equal(catalogQuery(query)(name),true,query);
 for(const [query,name] of [['12V','120V Adaptör'],['12V','24V Adaptör'],['10ohm','100ohm Direnç'],['10nF','100nF Kondansatör'],['M3','M30 Vida'],['STM32F103C6T6A','STM32F103C6T6 Geliştirme Kartı']])assert.equal(catalogQuery(query)(name),false,query);
 const rows=JSON.parse(readFileSync(new URL('../public/catalog/komponentci-0-0.json',import.meta.url),'utf8')) as string[][];
 const target=rows.find(row=>row[0]==='/stm32f103c6t6a-gelistirme-karti-pmu61492');assert.ok(target);assert.equal(catalogQuery('stm32')(target[1]),true);
 assert.notEqual(productIdentity({name:target[1]}),productIdentity({name:'STM32F103C6T6 Geliştirme Kartı'}));
});

test('multi-store browse pages have stable disjoint positions and model variants remain separate',async()=>{
 const stores=['a','b'].map((id,s)=>({id,base:`https://${id}.test`,chunks:[{key:`${id}.json`,group:'Dirençler'},{key:`${id}-boards.json`,group:'Geliştirme Kartları'}]}));
 const files:Record<string,string[][]>={},index:Record<string,{storeId:string;url:string;name:string;sourceCategory:string}[]>={};
 for(const [s,store] of stores.entries()){
  files[`${store.id}.json`]=Array.from({length:220},(_,i)=>[`/r-${i}`,`${1000+s*1000+i} Ohm 1/4W Direnç`,'Dirençler']);
  files[`${store.id}-boards.json`]=[['/board',`STM32F103C6T6${s?'A':''} Geliştirme Kartı`,'Geliştirme Kartları']];
  for(const chunk of store.chunks)for(const [path,name,sourceCategory] of files[chunk.key]){const key=productIdentity({name,category:sourceCategory});(index[key]??=[]).push({storeId:store.id,url:store.base+path,name,sourceCategory});}
 }
 const scope=globalThis as unknown as {self:unknown},oldSelf=scope.self,oldFetch=globalThis.fetch;
 let complete:(r:Record<string,unknown>)=>void=()=>{};
 const worker={currentRequest:0,onmessage:undefined as unknown as (event:{data:object})=>void,postMessage:(r:Record<string,unknown>)=>{if(r.done)complete(r);}};
 scope.self=worker;globalThis.fetch=(async input=>{const path=String(input),value=path.endsWith('manifest.json')?{stores}:path.includes('/matches/')?index:files[path.replace('/catalog/','')];return new Response(JSON.stringify(value),{status:value?200:404});}) as typeof fetch;
 try{
  await import('../public/catalog/search-worker.js');
  let requestId=0;const run=(data:object)=>new Promise<{key:string;sources:{storeId:string}[]}[]>(resolve=>{complete=r=>{assert.ok(!r.error,String(r.error));resolve(r.results as {key:string;sources:{storeId:string}[]}[]);};worker.onmessage({data:{requestId:++requestId,...data}});});
  const seen=new Set<string>();let first:string[]=[];
  for(let page=0;page<4;page++){const rows=await run({query:'',group:'Dirençler',page});assert.equal(rows.length,40);if(!page)first=rows.map(r=>r.key);for(const row of rows){assert.equal(seen.has(row.key),false,`Repeated key on page ${page}: ${row.key}`);seen.add(row.key);}assert.equal(new Set(rows.flatMap(r=>r.sources.map(s=>s.storeId))).size,2);}
  assert.deepEqual((await run({query:'',group:'Dirençler',page:0})).map(r=>r.key),first);
  const family=await run({query:'stm32',group:'Geliştirme Kartları'});assert.equal(family.length,2);assert.notEqual(family[0].key,family[1].key);
  const exact=await run({query:'stm32f103c6t6a',group:'Geliştirme Kartları'});assert.equal(exact.length,1);assert.equal(exact[0].sources[0].storeId,'b');
 }finally{globalThis.fetch=oldFetch;scope.self=oldSelf;}
});
