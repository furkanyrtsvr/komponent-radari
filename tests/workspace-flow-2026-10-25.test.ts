import test from 'node:test';
import assert from 'node:assert/strict';
import {safeAuthReturn,chatgptLoginHref} from '../src/lib/auth-return';
import {refreshArchivePreviews} from '../src/lib/archive-refresh';
import type {CatalogPreview} from '../src/lib/server/catalog-preview';
const stores=[{id:'robo90',domain:'www.robo90.com',enabled:true}];
const empty:CatalogPreview={url:'https://www.robo90.com/8x8-dot-matrix-display-modulu-max7219',name:'',image:null,key:'',price:null,checkedAt:'',stockStatus:'unknown',archiveState:'missing',message:'Arşivde kayıt yok'};
test('ChatGPT return is verified on its own completion page and cannot redirect to an external site or auth loop',()=>{
 const signin=new URL(chatgptLoginHref('/?cart=one'),'https://site.local');
 assert.equal(signin.pathname,'/signin-with-chatgpt');
 const complete=new URL(signin.searchParams.get('return_to')!,'https://site.local');
 assert.equal(complete.pathname,'/auth/complete');assert.equal(complete.searchParams.get('provider'),'chatgpt');assert.equal(complete.searchParams.get('return_to'),'/?cart=one');
 for(const bad of ['//evil.example','https://evil.example','/\\evil.example','/callback','/auth/complete?provider=chatgpt','/signin-with-chatgpt'])assert.equal(safeAuthReturn(bad),'/');
});
test('B archive refresh queues missing merchant URLs without creating price, image or check date',async()=>{
 const seen:string[]=[];const [result]=await refreshArchivePreviews([empty],stores,async(store,url)=>{assert.equal(store.id,'robo90');seen.push(url);return {status:'collector_pending'};});
 assert.deepEqual(seen,[empty.url]);assert.equal(result.price,null);assert.equal(result.checkedAt,'');assert.equal(result.image,null);assert.equal(result.collectorPending,true);assert.match(result.message,/öncelikli/);
});
test('An old archive price remains dated; a fresh price is not enqueued again',async()=>{
 const old={...empty,price:10924,checkedAt:'2026-10-24T20:30:50.415Z',archiveState:'expired' as const};
 const fresh={...old,url:'https://www.robo90.com/fresh',archiveState:'fresh' as const};
 let calls=0;const result=await refreshArchivePreviews([old,fresh],stores,async()=>{calls++;return {status:'collector_pending'};});
 assert.equal(calls,1);assert.equal(result[0].price,10924);assert.equal(result[0].checkedAt,old.checkedAt);assert.equal(result[1],fresh);
});
test('Queue failures and foreign or disabled sources cannot become pending or successful price observations',async()=>{
 const failed=await refreshArchivePreviews([empty],stores,async()=>{throw new Error('temporary');});assert.equal(failed[0].collectorPending,undefined);assert.equal(failed[0].checkedAt,'');assert.match(failed[0].message,/kaydedilemedi/);
 let calls=0;await refreshArchivePreviews([{...empty,url:'https://evil.example/product'}],stores,async()=>{calls++;return {status:'collector_pending'};});
 await refreshArchivePreviews([empty],[{...stores[0],enabled:false}],async()=>{calls++;return {status:'collector_pending'};});assert.equal(calls,0);
});
test('Archive refresh is bounded and de-duplicates identical URLs',async()=>{
 let calls=0;await refreshArchivePreviews(Array(100).fill(empty),stores,async()=>{calls++;return {status:'collector_pending'};});assert.equal(calls,1);
 calls=0;await refreshArchivePreviews(Array.from({length:100},(_,i)=>({...empty,url:`https://www.robo90.com/p${i}`})),stores,async()=>{calls++;return {status:'collector_pending'};});assert.equal(calls,20);
});
