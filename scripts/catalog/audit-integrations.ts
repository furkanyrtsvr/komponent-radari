/** Re-read dated integration examples through real merchant adapters, without a browser or user cart. */
import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';
import {storeCatalog} from '../../src/lib/catalog';
import {adapterFor} from '../../src/stores/registry';
import {validateSnapshot} from '../../src/lib/catalog-snapshot';
const selected=process.argv.find(a=>a.startsWith('--stores='))?.slice(9).split(',');
const fixtures=JSON.parse(readFileSync('tests/fixtures/merchants/integration-2026-10-20/index.json','utf8')) as {store:string;url:string;file:string}[];
const examples=[...fixtures,
 {store:'motorobit',url:'https://www.motorobit.com/isikli-2-pin-power-soketi',file:'motorobit-fixed'},
 {store:'robiz',url:'https://robiz.net/140pcscableset',file:'robiz-fixed'},
 {store:'robocombo',url:'https://robocombo.com/0r-14w-direnc-5012',file:'robocombo-fixed'},
 {store:'ozdisan',url:'https://www.ozdisan.com/p/ag-ve-sira-direncler-196/samsung-rps104pj754cs-1557325',file:'ozdisan-quote'}];
const dir=process.argv.find(a=>a.startsWith('--out='))?.slice(6)||'outputs/integration-live-2026-10-20';mkdirSync(dir,{recursive:true});
const results:any[]=[];let cursor=0;
const stores=storeCatalog.filter(s=>examples.some(e=>e.store===s.id)&&(!selected||selected.includes(s.id)));
await Promise.all(Array.from({length:Math.min(4,stores.length)},async()=>{
 while(cursor<stores.length){const store=stores[cursor++];let count=0;
  for(const e of examples.filter(e=>e.store===store.id)){
   if(count++)await new Promise(r=>setTimeout(r,3100));const result:any={store:store.id,url:e.url,file:e.file};
   try{const product=await adapterFor({...store,requestSignal:AbortSignal.timeout(60000)}).getProduct(e.url),checkedAt=new Date().toISOString();result.snapshot=validateSnapshot({storeId:store.id,readerRevision:2,checkedAt,product:{...product,packageQuantity:product.packageQuantity||1}},storeCatalog);result.status='verified';}
   catch(error){result.status='unverified';result.message=error instanceof Error?error.message:String(error);}
   results.push(result);writeFileSync(`${dir}/results.json`,JSON.stringify(results,null,2));console.log(JSON.stringify({store:store.id,file:e.file,status:result.status,error:result.message}));
  }
 }
}));
writeFileSync(`${dir}/verified.jsonl`,results.filter(r=>r.snapshot).map(r=>JSON.stringify(r.snapshot)).join('\n'));
console.log(JSON.stringify({pages:results.length,verified:results.filter(r=>r.snapshot).length}));
