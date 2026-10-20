import test from 'node:test';
import assert from 'node:assert/strict';
import {previewWait} from '../src/lib/preview-schedule';
import {api,ApiError} from '../src/lib/client';
test('cached catalogue reads remain below the request budget and a throttle pauses rather than bursts',()=>{
 let at=10000,last=0,count=0;
 while(at<70000){at+=previewWait(last,0,at);if(at>=70000)break;count++;last=at;at++;}
 assert.equal(count,24);assert.equal(previewWait(10000,80000,20000),60000);assert.equal(previewWait(10000,80000,80000),0);
});
test('the API client preserves 429 status so catalogue scheduling can retry without marking a merchant unreadable',async()=>{
 const original=globalThis.fetch;globalThis.fetch=async()=>Response.json({error:'İstek sınırı'},{status:429});
 try{await assert.rejects(()=>api('catalog/preview','POST',{urls:['https://example.com/product']}),e=>e instanceof ApiError&&e.status===429&&e.message==='İstek sınırı');}finally{globalThis.fetch=original;}
});
