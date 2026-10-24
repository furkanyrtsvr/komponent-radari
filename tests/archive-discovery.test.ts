import test from 'node:test';
import assert from 'node:assert/strict';
import {archiveProducts,archivePage,displayablePreview,oldArchivePrice} from '../src/lib/archive-discovery';
import {catalogIdentity} from '../src/lib/catalog-identity';
import {SNAPSHOT_TTL_MS} from '../src/lib/catalog-snapshot';
import {productImage} from '../src/stores/product-image';
import {isFresh} from '../src/lib/pricing';
import {demoOffers} from '../src/lib/catalog';
import type {CatalogPreview} from '../src/lib/server/catalog-preview';
const at=Date.parse('2026-10-24T18:00:00Z');
function preview(name='STM32F103C6T6A Geliştirme Kartı',url='https://www.robotistan.com/a'):CatalogPreview{return {url,name,key:catalogIdentity({name}),image:'https://cdn.example/product.jpg',price:12900,stockStatus:'in_stock',checkedAt:new Date(at-SNAPSHOT_TTL_MS-1000).toISOString(),message:'Eski fiyat',archiveState:'expired'};}
test('dated archive prices display without making expired offers valid for basket optimization',()=>{
 const p=preview();assert.equal(displayablePreview(p,at),true);assert.equal(oldArchivePrice(p,at),true);
 assert.equal(isFresh({...demoOffers[0],source:'live',last_checked_at:p.checkedAt,snapshot_max_age_ms:SNAPSHOT_TTL_MS,last_error:null},at),false);
 for(const archiveState of ['invalid','missing'] as const)assert.equal(displayablePreview({...p,archiveState},at),false);
 assert.equal(displayablePreview({...p,checkedAt:new Date(at+1000).toISOString()},at),false);
 assert.equal(displayablePreview({...p,archiveState:undefined,maxAgeMs:1200000},at),false);
});
test('archive discovery separates board variants and bare chips, and requires an actual image in the selected store',()=>{
 const p=preview(),second={...p,url:'https://www.komponentci.net/a',image:null};
 const items=[{storeId:'robotistan',preview:p},{storeId:'komponentci',preview:second},{storeId:'s',preview:preview('STM32F103C6T6 Geliştirme Kartı','https://example.com/c6')},{storeId:'s',preview:preview('STM32F103C6T6A Entegre LQFP48','https://example.com/ic')},{storeId:'s',preview:{...preview('Görselsiz ürün','https://example.com/no'),image:null}}];
 const groups=archiveProducts(items,at);assert.equal(groups.length,4);
 const page=archivePage(groups,{query:'STM32F103C6T6',group:'all',store:'all',page:0});assert.equal(page.results.length,3);
 assert.equal(page.results.find(g=>g.key===p.key)?.sources.length,2);
 assert.equal(archivePage(groups,{query:'',group:'Geliştirme Kartları',store:'all',page:0}).results.length,2);
 assert.equal(archivePage(groups,{query:'',group:'all',store:'komponentci',page:0}).results.length,0);
});
test('archive pages are stable and nonoverlapping and include only verified observations',()=>{
 const groups=archiveProducts(Array.from({length:85},(_,i)=>({storeId:'s',preview:preview('Unique component '+i,'https://example.com/p'+i)})),at);
 const options={query:'',group:'all',store:'all'};
 const a=archivePage(groups,{...options,page:0}),b=archivePage(groups,{...options,page:1}),c=archivePage(groups,{...options,page:2});
 assert.equal(a.results.length,40);assert.equal(b.results.length,40);assert.equal(c.results.length,5);assert.equal(c.hasMore,false);
 assert.equal(new Set([...a.results,...b.results,...c.results].map(p=>p.key)).size,85);
});
test('image normalization accepts merchant product metadata but never substitutes placeholders or insecure addresses',()=>{
 assert.equal(productImage('/uploads/board.jpg','https://merchant.example/a'),'https://merchant.example/uploads/board.jpg');
 assert.equal(productImage({contentUrl:'//cdn.example/board.jpg'},'https://merchant.example/a'),'https://cdn.example/board.jpg');
 assert.equal(productImage(null,'https://merchant.example/a','https://cdn.example/board.jpg'),'https://cdn.example/board.jpg');
 for(const raw of ['http://merchant.example/p.jpg','https://user:pass@merchant.example/p.jpg','data:image/png;base64,abc','/placeholder.jpg','/no-image.png'])assert.equal(productImage(raw,'https://merchant.example/a'),null);
});
