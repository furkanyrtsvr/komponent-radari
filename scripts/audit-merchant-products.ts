/** Real, distinct merchant pages; preserves evidence and failures without invented prices. */
import {DatabaseSync} from 'node:sqlite';
import {mkdirSync,writeFileSync,readFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {AsyncLocalStorage} from 'node:async_hooks';
import {storeCatalog} from '../lib/catalog';
import {adapterFor} from '../stores/registry';
import {validateSnapshot} from '../lib/catalog-snapshot';
import {matchesCatalogRequirement,catalogIdentity} from '../lib/catalog-identity';
import {nameMatchScore} from '../public/catalog/product-identity.js';
const expanded=process.argv.includes('--expanded');
const out=resolve(expanded?'outputs/product-audit-1500':'outputs/product-audit');mkdirSync(out,{recursive:true});
const evidence=resolve(expanded?'work/product-audit-1500':'work/product-audit');mkdirSync(evidence,{recursive:true});
const prior:any[]=expanded?JSON.parse(readFileSync(resolve('outputs/product-audit/final-results.json'),'utf8')).results:[];
const existing=new Map(prior.filter(r=>r.snapshot && Date.now()-Date.parse(r.snapshot.checkedAt)<43200000).map(r=>[r.url,r]));
const db=new DatabaseSync(resolve('work/catalogue-b/catalogue.sqlite'));
const context=new AsyncLocalStorage<{key:string;pages:{status:number;url:string}[]}>();
const originalFetch=globalThis.fetch;
globalThis.fetch=async(...args:Parameters<typeof fetch>)=>{
 const response=await originalFetch(...args),ctx=context.getStore();
 if(ctx && !response.url.endsWith('/robots.txt')){
  ctx.pages.push({status:response.status,url:response.url});
  if(response.headers.get('content-type')?.includes('text/html'))writeFileSync(resolve(evidence,`${ctx.key}.html`),Buffer.from(await response.clone().arrayBuffer()));
 }
 return response;
};
const families=['xr2206','ams1117','tp5000','lm2596','xl4015','hc-sr04','mpu6050','esp32','dht11','dht22','ne555','sg90','mg996','rc522','l298n','a4988','ds18b20','bmp280','arduino','jumper','1k','10k','kondansator','mosfet'];
const selected=storeCatalog.flatMap(store=>{
 const target=expanded?(['robotzade','robitshop'].includes(store.id)?60:160):40;
 const chosen=new Map<string,{url:string;name:string;category:string;family:string}>();
 if(expanded)for(const row of prior.filter(r=>r.storeId===store.id))chosen.set(row.url,{url:row.url,name:row.name,category:row.category,family:row.family||''});
 for(const family of families){const row=db.prepare('SELECT url,name,category FROM products WHERE active=1 AND store_id=? AND lower(url) LIKE ? ORDER BY length(url),url LIMIT 1').get(store.id,`%${family}%`) as {url:string;name:string;category:string}|undefined;if(row)chosen.set(row.url,{...row,family});}
 const categories=db.prepare('SELECT DISTINCT category FROM products WHERE active=1 AND store_id=? ORDER BY category').all(store.id) as {category:string}[];
 for(let offset=0;chosen.size<target && offset<200;offset+=expanded?10:5)for(const {category} of categories){const rows=db.prepare('SELECT url,name,category FROM products WHERE active=1 AND store_id=? AND category=? ORDER BY length(url),url LIMIT ? OFFSET ?').all(store.id,category,expanded?10:5,offset) as {url:string;name:string;category:string}[];for(const row of rows){if(chosen.size>=target)break;chosen.set(row.url,{...row,family:''});}}
 if(chosen.size<target)for(const row of db.prepare('SELECT url,name,category FROM products WHERE active=1 AND store_id=? ORDER BY length(url),url LIMIT 1000').all(store.id) as {url:string;name:string;category:string}[]){if(chosen.size>=target)break;chosen.set(row.url,{...row,family:''});}
 return [...chosen.values()].slice(0,target).map(row=>({...row,storeId:store.id}));
});db.close();
writeFileSync(resolve(out,'selected.json'),JSON.stringify(selected,null,2));
const results:any[]=[],startedAt=new Date().toISOString();
await Promise.all(storeCatalog.map(async store=>{
 let delay=3000;
 try{const r=await originalFetch(`https://${store.domain}/robots.txt`,{signal:AbortSignal.timeout(15000)});if(!r.ok)throw new Error(`robots HTTP ${r.status}`);const robots=await r.text();delay=Math.max(delay,...[...robots.matchAll(/^\s*Crawl-delay:\s*([\d.]+)/gim)].map(m=>Number(m[1])*1000));}catch(error){console.error(store.id,String(error));}
 let index=0;
 for(const row of selected.filter(row=>row.storeId===store.id)){
  const saved=existing.get(row.url);
  if(saved){results.push({...saved,...row,reused:true});index++;continue;}
  if(index)await new Promise(r=>setTimeout(r,delay));
  const key=`${store.id}-${++index}`,pages:{status:number;url:string}[]=[],at=new Date().toISOString();
  let result:any={...row,at,key,pages};
  try{
   const p=await context.run({key,pages},()=>adapterFor({...store,requestSignal:AbortSignal.timeout(25000)}).getProduct(row.url));
   const pack=p.packageQuantity||1;
   result={...result,product:p,identity:catalogIdentity(p),strictNameMatch:matchesCatalogRequirement({name:row.name},p),nameScore:nameMatchScore({name:row.name},p)};
   try{result.snapshot=validateSnapshot({storeId:store.id,readerRevision:2,checkedAt:new Date().toISOString(),product:{...p,packageQuantity:pack,minimumOrderQuantity:p.minimumOrderQuantity||pack,orderStep:p.orderStep||pack,image:p.image?.startsWith('https://')?p.image:null}},storeCatalog);result.status='verified';}catch(error){result.status='unverified';result.error=String(error);}
  }catch(error){result.status='failed';result.error=error instanceof Error?error.message:String(error);}
  results.push(result);if(results.length%5===0)writeFileSync(resolve(out,'results.json'),JSON.stringify({startedAt,selected:selected.length,completed:results.length,results},null,2));
  console.log(JSON.stringify({store:store.id,index,status:result.status,price:result.product?.price,error:result.error}));
 }
}));
const verified=results.filter(row=>row.snapshot);
writeFileSync(resolve(out,'verified.jsonl'),verified.map(row=>JSON.stringify(row.snapshot)).join('\n')+'\n');
writeFileSync(resolve(out,'results.json'),JSON.stringify({startedAt,finishedAt:new Date().toISOString(),selected:selected.length,completed:results.length,verified:verified.length,results},null,2));
console.log(JSON.stringify({selected:selected.length,completed:results.length,verified:verified.length,failed:results.filter(row=>row.status==='failed').length}));
