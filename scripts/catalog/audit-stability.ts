/** Bounded, reproducible live audit across merchants and catalogue categories. */
import {readFileSync,mkdirSync,writeFileSync} from 'node:fs';
import {AsyncLocalStorage} from 'node:async_hooks';
import {storeCatalog} from '../../src/lib/catalog';
import {adapterFor} from '../../src/stores/registry';
import {catalogIdentity,variantConflict} from '../../src/lib/catalog-identity';
import {validateSnapshot} from '../../src/lib/catalog-snapshot';
const manifest=JSON.parse(readFileSync('public/catalog/manifest.json','utf8'));
const selection=process.argv.find(a=>a.startsWith('--stores='))?.slice(9).split(',');
const merchants=selection?storeCatalog.filter(s=>selection.includes(s.id)):storeCatalog;
const out=selection?'outputs/stability-2026-10-20-followup':'outputs/stability-2026-10-20';mkdirSync(out,{recursive:true});
const context=new AsyncLocalStorage<{key:string}>(),originalFetch=globalThis.fetch;
globalThis.fetch=async(...args:Parameters<typeof fetch>)=>{
 const r=await originalFetch(...args),ctx=context.getStore();
 if(ctx&&!String(args[0]).endsWith('/robots.txt')&&r.headers.get('content-type')?.includes('text/html')){
  const html=await r.clone().text();writeFileSync(`${out}/${ctx.key}.html`,html);
 }
 return r;
};
const results:any[]=[],startedAt=new Date().toISOString();
const groups=['Dirençler','Kondansatörler','Sensörler','Güç ve Pil','Kablolar','Geliştirme Kartları'];
let cursor=0;
await Promise.all(Array.from({length:4},async()=>{
 while(cursor<merchants.length){const store=merchants[cursor++];
  const entry=manifest.stores.find((s:any)=>s.id===store.id);
  if(!entry){results.push({storeId:store.id,store:store.name,status:'no_catalog',message:'Mağaza kayıtlı; ürün adres dizini ve özel okuyucu entegrasyonu yok.'});continue;}
  let delay=3000;
  try{const r=await originalFetch(`https://${store.domain}/robots.txt`,{signal:AbortSignal.timeout(12000)});if(!r.ok)throw new Error(`robots HTTP ${r.status}`);delay=Math.max(delay,...[...(await r.text()).matchAll(/^\s*Crawl-delay:\s*([\d.]+)/gim)].map(m=>Number(m[1])*1000));}
  catch(e){results.push({storeId:store.id,store:store.name,status:'robots_failed',message:String(e)});continue;}
  let count=0;
  for(const group of groups){const chunk=entry.chunks.find((c:any)=>c.group===group);if(!chunk)continue;
   const rows=JSON.parse(readFileSync('public/catalog/'+chunk.key,'utf8'));
   const row=rows.find((r:any)=>r[1].length>8&&!/yedek|seti|paketi|aksesuar/i.test(r[1]))||rows[0];if(!row)continue;
   if(count)await new Promise(r=>setTimeout(r,delay));
   const key=`${store.id}-${++count}`,url=new URL(row[0],entry.base).href;
   const result:any={storeId:store.id,store:store.name,group,name:row[1],url};
   try{const p=await context.run({key},()=>adapterFor({...store,requestSignal:AbortSignal.timeout(25000)}).getProduct(url));result.product=p;result.key=catalogIdentity(p);result.conflict=variantConflict({name:row[1]},p);
    try{result.snapshot=validateSnapshot({storeId:store.id,readerRevision:2,checkedAt:p.checkedAt||new Date().toISOString(),product:{...p,packageQuantity:p.packageQuantity||1}},storeCatalog);result.status='verified';}catch(e){result.status='unverified';result.message=String(e);}
   }catch(e){result.status='failed';result.message=String(e);}
   results.push(result);writeFileSync(`${out}/results.json`,JSON.stringify({startedAt,results},null,2));console.log(JSON.stringify({store:store.id,group,status:result.status,message:result.message}));
  }
 }
}));
writeFileSync(`${out}/results.json`,JSON.stringify({startedAt,finishedAt:new Date().toISOString(),results},null,2));
writeFileSync(`${out}/verified.jsonl`,results.filter(r=>r.snapshot).map(r=>JSON.stringify(r.snapshot)).join('\n'));
console.log(JSON.stringify({tested:results.length,verified:results.filter(r=>r.status==='verified').length}));
