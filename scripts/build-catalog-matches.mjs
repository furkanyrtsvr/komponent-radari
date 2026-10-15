import fs from 'node:fs/promises';
import { productIdentity, matchBucket, candidateKey, catalogGroup, nameCandidateKeys } from '../public/catalog/product-identity.js';
import { liveSources, liveProducts } from '../stores/live-catalog.ts';
import { products } from '../lib/catalog.ts';
const root = new URL('../public/catalog/', import.meta.url);
const manifest = JSON.parse(await fs.readFile(new URL('manifest.json',root),'utf8'));
const records = new Map();
const candidates = new Map();
const candidateUrls=new Map();
const ideaCatalog={};
for (const store of manifest.stores) {
 const movedGroups=new Map();
 for(const chunk of [...store.chunks]) {
  const rows=JSON.parse(await fs.readFile(new URL(chunk.key,root),'utf8'));
  const retained=[];
  for(const row of rows) {
   const desired=catalogGroup(row[1],chunk.group);
   if(desired===chunk.group) retained.push(row);
   else {const moved=movedGroups.get(desired)||[];moved.push(row);movedGroups.set(desired,moved);}
  }
  if(retained.length!==rows.length) {
   chunk.count=retained.length;
   await fs.writeFile(new URL(chunk.key,root),JSON.stringify(retained));
  }
 }
 for(const [group,moved] of movedGroups) {
  let destination=store.chunks.find(c=>c.group===group);
  if(!destination) {destination={key:`${store.id}-group-${manifest.groups.indexOf(group)}-corrected.json`,group,count:0};store.chunks.push(destination);}
  const previous=destination.count?JSON.parse(await fs.readFile(new URL(destination.key,root),'utf8')):[];
  previous.push(...moved);destination.count=previous.length;
  await fs.writeFile(new URL(destination.key,root),JSON.stringify(previous));
 }
 for (const chunk of store.chunks) {
  const rows = JSON.parse(await fs.readFile(new URL(chunk.key,root),'utf8'));
  for (const [path,name,sourceCategory] of rows) {
   if(['robotzade','robitshop'].includes(store.id))ideaCatalog[store.id+':'+new URL(path,store.base).pathname]={storeId:store.id,name};
   const key = productIdentity({name,category:sourceCategory});
   const source = {storeId:store.id,url:store.base+path,sourceCategory,name};
   const sources = records.get(key);
   if (!sources) records.set(key,[source]);
   else if (!sources.some(s=>s.url===source.url)) sources.push(source);
   const candidate=candidateKey({name});
   for(const candidateName of [...(candidate?[candidate]:[]),...nameCandidateKeys({name})]){
    const entries=candidates.get(candidateName)||[],urls=candidateUrls.get(candidateName)||new Set();
    if(!urls.has(source.url)){entries.push(source);urls.add(source.url);}
    candidates.set(candidateName,entries);candidateUrls.set(candidateName,urls);
   }
  }
 }
}
const buckets = Array.from({length:64},()=>({}));
// Reviewed product URLs supplement incomplete merchant sitemaps.
for(const source of liveSources) {
 const product=[...products,...liveProducts].find(p=>p.id===source.productId);
 const store=manifest.stores.find(s=>s.id===source.storeId);
 if(!product||!store) continue;
 const key=productIdentity(product),url=new URL(source.path,store.base).href;
 const previous=records.get(key)||[];
 records.set(key,[{storeId:source.storeId,url,name:product.name,sourceCategory:product.category},...previous.filter(s=>s.url!==url)]);
}
let count = 0;
for (const [key,sources] of records) {
 if (sources.length < 2) continue;
 buckets[matchBucket(key)][key] = sources;
 count++;
}
await fs.mkdir(new URL('matches/',root),{recursive:true});
await fs.writeFile(new URL('manifest.json',root),JSON.stringify(manifest));
await Promise.all(buckets.map((bucket,i)=>fs.writeFile(new URL(`matches/${i}.json`,root),JSON.stringify(bucket))));
console.log(`Catalogue counterparts: ${count} identities, ${manifest.stores.length} stores.`);
// Server and discovery share the exact same identity index.
// Broad discovery only needs cross-store names; cap repeated variants per
// merchant so generic words cannot inflate the worker or starve other stores.
for(const [key,rows] of candidates){
 if(!key.startsWith('name-'))continue;
 if(new Set(rows.map(row=>row.storeId)).size<2){candidates.delete(key);continue;}
 const counts=new Map();
 candidates.set(key,rows.filter(row=>{const count=counts.get(row.storeId)||0;counts.set(row.storeId,count+1);return count<8;}));
}
await fs.mkdir(new URL('../lib/generated/',import.meta.url),{recursive:true});
await fs.writeFile(new URL('../lib/generated/ideasoft-catalog.json',import.meta.url),JSON.stringify(ideaCatalog));
await fs.writeFile(new URL('../lib/generated/catalog-matches.json',import.meta.url),JSON.stringify(Object.assign({},...buckets,Object.fromEntries(candidates))));
