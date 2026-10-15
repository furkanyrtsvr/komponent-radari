import test from "node:test";
import assert from "node:assert/strict";
import {productIdentity,matchBucket} from "../public/catalog/product-identity.js";
test("worker returns full cross-store sources and never admits the opposite cable connector",async()=>{
 const names=["40pin 20cm erkek erkek jumper kablo","40 Pin Ayrılabilen Erkek-Erkek M-M Jumper Kablo-200 mm","40pin 20cm erkek dişi jumper kablo"];
 const key=productIdentity({name:names[0]});
 const manifest={stores:names.map((_,i)=>({id:`s${i}`,base:`https://s${i}.test`,chunks:[{key:`s${i}.json`,group:i===1?'Diğer':'Kablolar'}]}))};
 const sources=names.slice(0,2).map((name,i)=>({name,storeId:`s${i}`,url:`https://s${i}.test/item`,sourceCategory:'Kablo'}));
 const scope=globalThis as unknown as {self:unknown};
 const savedFetch=globalThis.fetch,savedSelf=scope.self;
 let complete:(message:Record<string,unknown>)=>void=()=>{};
 const worker={currentRequest:0,onmessage:undefined as unknown as (event:{data:object})=>void,postMessage:(message:Record<string,unknown>)=>{if(message.done)complete(message)}};
 scope.self=worker;
 globalThis.fetch=(async(input: string|URL|Request)=>{
  const path=String(input);
  const value=path.endsWith('manifest.json')?manifest:path.includes('/matches/')?{[key]:sources}:names.map((name,i)=>[`s${i}.json`,[['/item',name,'Kablo']]]).find(([file])=>path.endsWith(String(file)))?.[1];
  return new Response(JSON.stringify(value),{status:value?200:404});
 }) as typeof fetch;
 try {
  await import('../public/catalog/search-worker.js');
  const run=(data:object)=>new Promise<Record<string,unknown>>(resolve=>{complete=resolve;worker.onmessage({data});});
  const query=await run({requestId:1,query:names[0],group:'all'});
  const rows=query.results as {key:string;sources:unknown[]}[];
  assert.equal(rows.length,1);assert.equal(rows[0].key,key);assert.equal(rows[0].sources.length,2);
  const category=await run({requestId:2,query:'',group:'Kablolar'});
  assert.equal((category.results as typeof rows).find(row=>row.key===key)?.sources.length,2);
  const store=await run({requestId:3,query:names[0],group:'all',store:'s0'});
  assert.equal((store.results as typeof rows)[0].sources.length,1);
 } finally {globalThis.fetch=savedFetch;scope.self=savedSelf;}
});
