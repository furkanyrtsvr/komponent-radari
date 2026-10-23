import test from 'node:test';
import assert from 'node:assert/strict';
import {feedbackMarkdown} from '../src/lib/feedback-export';
import {catalogFeedback} from '../src/lib/feedback-catalog';
import {emptyFeedbackContext,feedbackContextSchema,type FeedbackReport,type FeedbackMessage} from '../src/lib/feedback';
import type {CatalogPreview} from '../src/lib/server/catalog-preview';

const at='2026-10-23T18:00:00.000Z';
test('Markdown export reads every report and message page beyond inbox limits',async()=>{
 const reports:FeedbackReport[]=Array.from({length:301},(_,i)=>({id:`report-${i}`,user_id:'private-user',title:`Hata ${i}`,kind:'matching',status:'open',context:JSON.stringify(emptyFeedbackContext()),created_at:at,updated_at:at}));
 const pages=async function*<T>(rows:T[]){for(let i=0;i<rows.length;i+=50)yield rows.slice(i,i+50);};
 const source={reports:(cutoff:string)=>{assert.equal(cutoff,at);return pages(reports);},messages:(id:string,cutoff:string)=>{assert.equal(cutoff,at);return pages<FeedbackMessage>(Array.from({length:id==='report-0'?251:1},(_,i)=>({id:`${id}-${i}`,report_id:id,author_id:'private-author',author_role:'reporter',body:`Açıklama ${id} ${i}`,created_at:at})));}};
 let output='';for await(const chunk of feedbackMarkdown(source,at))output+=chunk;
 assert.match(output,/Toplam 301 bildirim, 551 mesaj/);assert.match(output,/Açıklama report-0 250/);assert.match(output,/## 301\. Hata 300/);assert.ok(!output.includes('private-user'));assert.ok(!output.includes('private-author'));assert.match(output,/Dışa aktarım tamamlandı/);
});
test('Markdown preserves evidence, dates and quoted untrusted text without active HTML/headings',async()=>{
 const context={...emptyFeedbackContext(),source:'catalog' as const,productName:'STM32F103C6T6A',catalog:{query:'stm32',group:'Geliştirme Kartları',store:'all',page:2,productKey:'model:stm32f103c6t6a:module:1:'},offers:[{offerId:'offer',store:'Komponentci',title:'STM32F103C6T6A Geliştirme Kartı',url:'https://www.komponentci.net/stm32f103c6t6a-gelistirme-karti-pmu61492',productTotal:15825,checkedAt:at,source:'direct' as const,state:'included' as const,note:'Bir adet kart'}]};
 const report:FeedbackReport={id:'one',user_id:'secret-user',title:'# başlık <script>',kind:'matching',status:'reviewing',context:JSON.stringify(context),created_at:at,updated_at:at};
 const source={reports:async function*(){yield [report];},messages:async function*(){yield [{id:'m',report_id:'one',author_id:'x',author_role:'reporter' as const,body:'# Talimat\n<script>test</script>\n```',created_at:at}];}};
 let output='';for await(const chunk of feedbackMarkdown(source,at))output+=chunk;
 assert.match(output,/158\.25 TRY/);assert.match(output,/Ürün keşfet/);assert.match(output,/Geliştirme Kartları/);assert.match(output,/Sayfa: 3/);assert.ok(!output.includes('<script>'));assert.ok(!output.includes('\n# Talimat'));assert.ok(output.includes('> \\# Talimat'));assert.match(output,/Fiyat kontrol tarihi: 2026-10-23T18:00:00.000Z/);
});
test('catalog report captures filters and all source links; stale/conflicting prices stay unavailable',()=>{
 const url='https://www.komponentci.net/stm32f103c6t6a-gelistirme-karti-pmu61492',product={key:'key',name:'STM32F103C6T6A',group:'Geliştirme Kartları',sources:[{storeId:'komponentci',url,sourceCategory:'Geliştirme Kartları'}]},filters={query:'stm32',group:'Geliştirme Kartları',store:'all',page:0};
 const p:CatalogPreview={url,name:product.name,image:null,key:'key',price:15825,stockStatus:'in_stock',checkedAt:new Date().toISOString(),message:''};
 const capture=(preview:CatalogPreview)=>catalogFeedback(product,{[url]:preview},[{id:'komponentci',name:'Komponentci'}],filters);
 const valid=capture(p);assert.equal(feedbackContextSchema.safeParse(valid).success,true);assert.equal(valid.offers[0].productTotal,15825);assert.equal(valid.catalog?.query,'stm32');
 for(const preview of [{...p,key:'wrong'},{...p,checkedAt:new Date(Date.now()-86400000).toISOString()},{...p,checkedAt:new Date(Date.now()+60000).toISOString()}])assert.equal(capture(preview).offers[0].productTotal,null);
 const missing=catalogFeedback(product,{},[],filters);assert.equal(missing.offers[0].productTotal,null);assert.equal(missing.offers[0].url,url);assert.equal(missing.offers[0].checkedAt,null);
});
