import test from 'node:test';
import assert from 'node:assert/strict';
import {archivePreviews,ARCHIVE_PREVIEW_BATCH} from '../src/lib/archive-preview';
import {previewBatch} from '../src/lib/preview-schedule';
import {SNAPSHOT_TTL_MS} from '../src/lib/catalog-snapshot';
import {ROBOTISTAN_TAX_PROOF} from '../src/lib/merchant-price-proof';
const at=Date.parse('2026-10-24T10:00:00.000Z');
const stores=[{id:'robotistan',domain:'www.robotistan.com',enabled:true}];
const product={url:'https://www.robotistan.com/p',name:'HC-SR04 Ultrasonik Sensör',mpn:'HC-SR04',manufacturer:'',model:'HC-SR04',image:null,price:12900,currency:'TRY',vatIncluded:true,vatRate:20,packageQuantity:5,stockStatus:'in_stock',stockQuantity:20,specifications:'{}',warnings:[ROBOTISTAN_TAX_PROOF],quantityVerified:true,minimumOrderQuantity:5,orderStep:5};
function row(path='p',age=1000,changes:object={}){
 const checked_at=new Date(at-age).toISOString(),url='https://www.robotistan.com/'+path;
 return {store_id:'robotistan',url,checked_at,payload:JSON.stringify({readerRevision:2,storeId:'robotistan',checkedAt:checked_at,product:{...product,url,...changes}})};
}
test('B reads a same-merchant page in one batch, including misses, without any external request',async()=>{
 const urls=Array.from({length:120},(_,i)=>'https://www.robotistan.com/p'+i);
 let reads=0;const fetchBefore=globalThis.fetch;
 globalThis.fetch=async()=>{throw new Error('Archive browsing must never fetch a merchant');};
 try{
  const values=await archivePreviews(urls,stores,async requested=>{reads++;assert.deepEqual(requested,urls);return urls.slice(0,100).map((_,i)=>row('p'+i));},at);
  assert.equal(reads,1);assert.equal(values.length,120);assert.equal(values.filter(p=>p.price===12900).length,100);
  assert.equal(values[0].packageQuantity,5);assert.equal(values[0].checkedAt,new Date(at-1000).toISOString());
  assert.equal(values[119].archiveState,'missing');assert.equal(values[119].price,null);assert.equal(values[119].checkedAt,'');
 }finally{globalThis.fetch=fetchBefore;}
});
test('old verified prices retain their value and date; future or contradictory observations stay hidden',async()=>{
 const stale=row('p',SNAPSHOT_TTL_MS),[old]=await archivePreviews([stale.url],stores,async()=>[stale],at);
 assert.equal(old.price,12900);assert.equal(old.archiveState,'expired');assert.equal(old.checkedAt,stale.checked_at);assert.match(old.message,/Eski arşiv fiyatı/);
 for(const [age,changes,state] of [[-1000,{},'invalid'],[1000,{vatIncluded:false},'invalid'],[1000,{quantityVerified:false},'invalid'],[1000,{warnings:[]},'invalid'],[1000,{vatRate:0},'invalid'],[1000,{currency:'USD'},'invalid']] as const){
  const original=row('p',age,changes),[p]=await archivePreviews([original.url],stores,async()=>[original],at);
  assert.equal(p.archiveState,state);assert.equal(p.price,null);assert.equal(p.checkedAt,original.checked_at);
 }
});
test('newest canonical URL wins; malformed or mismatched stored observations fail closed',async()=>{
 const newest=row('p',500,{price:15500});
 const [p]=await archivePreviews(['https://robotistan.com/p#details'],stores,async()=>[newest,row('p',1000)],at);
 assert.equal(p.price,15500);assert.equal(p.url,'https://robotistan.com/p#details');
 for(const invalid of [{...newest,payload:'{'},{...newest,checked_at:new Date(at-10).toISOString()},{...newest,payload:newest.payload.replace('"storeId":"robotistan"','"storeId":"other"')},row('p',500,{url:'https://foreign.example/p'})]){
  const [failed]=await archivePreviews([newest.url],stores,async()=>[invalid],at);assert.equal(failed.price,null);assert.equal(failed.archiveState,'invalid');
 }
});
test('invalid request addresses never reach database; the archive batch is bounded',async()=>{
 let reads=0;
 for(const url of ['http://www.robotistan.com/p','https://user:password@www.robotistan.com/p','https://www.robotistan.com:8443/p','https://foreign.example/p'])await assert.rejects(()=>archivePreviews([url],stores,async()=>{reads++;return [];},at));
 assert.equal(reads,0);
 const p=await archivePreviews(Array.from({length:130},(_,i)=>'https://robotistan.com/p'+i),stores,async()=>[],at);assert.equal(p.length,ARCHIVE_PREVIEW_BATCH);
});
test('B schedules all same-host products together, while A keeps its merchant pacing',()=>{
 const urls=Array.from({length:140},(_,i)=>'https://robotistan.com/p'+i),attempted=new Set([urls[0]]);
 assert.equal(previewBatch(urls,attempted,'B').length,ARCHIVE_PREVIEW_BATCH);
 assert.equal(previewBatch(urls,attempted,'B')[0],urls[1]);
 assert.deepEqual(previewBatch(urls,attempted,'A'),[urls[1]]);
});
