import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {load} from 'cheerio';
import {parseEkomponentProduct} from '../src/stores/ekomponent';
import {parseHobidevreProduct,HobidevreAdapter} from '../src/stores/woocommerce';
import {parseKomponentciProduct} from '../src/stores/komponentci';
import {parseRobotronikProduct,robotronikProductUrl} from '../src/stores/robotronik';
import {parseProduct,JsonLdAdapter} from '../src/stores/base';
import {validateCatalogMetadata,mergeCatalogMetadata,enrichCatalogPreview} from '../src/lib/catalog-metadata';
import {archivePreviews} from '../src/lib/archive-preview';
import {archiveProducts} from '../src/lib/archive-discovery';
import {validateSnapshot} from '../src/lib/catalog-snapshot';
import type {CatalogPreview} from '../src/lib/server/catalog-preview';
const fixture=(name:string)=>readFileSync('tests/fixtures/failed19/'+name,'utf8');
const eu='https://www.e-komponent.com/0-1uf-isolated-capacitor-4-array-w3a4yc104kat2a-kyocera',hu='https://www.hobidevre.com/urun/100k-1w-direnc/',ku='https://www.komponentci.net/0412-yuksek-hizli-drone-motoru-pmu61521';
const old='https://www.robotronik.com.tr/-max7219-dot-led-matrix-modul-8x8-kirmizi-a0470',canonical='https://www.robotronik.com.tr/max7219-dot-led-matrix-modul-8x8-kirmizi-a0470';
const at=Date.parse('2026-10-24T12:00:00Z'),observedAt=new Date(at-1000).toISOString();
const api=()=>JSON.parse(fixture('hobidevre-api.json'));
test('failed E komponent capacitor keeps its reconciled22.88TRY price while explicitly sold out',()=>{
 const p=parseEkomponentProduct(fixture('ekomponent.html'),eu);assert.equal(p.price,2288);assert.equal(p.mpn,'W3A4YC104KAT2A');assert.equal(p.stockStatus,'out_of_stock');assert.equal(p.stockQuantity,0);assert.equal(p.quantityVerified,true);assert.equal(p.minimumOrderQuantity,1);assert.ok(p.image?.startsWith('https://'));
});
test('E komponent rejects conflicting stock, altered price or missing quantity evidence',()=>{
 for(const mutate of [(x:ReturnType<typeof load>)=>x('#product-stock-status').attr('value','1'),(x:ReturnType<typeof load>)=>x('.multiple-item[data-stock]').attr('data-stock','4'),(x:ReturnType<typeof load>)=>x('.product-current-price .product-price').text('23,88 TL'),(x:ReturnType<typeof load>)=>x('input[id^="ProductCount"]').removeAttr('step')]){
  const x=load(fixture('ekomponent.html'));mutate(x);assert.throws(()=>parseEkomponentProduct(x.html(),eu));
 }
});
test('Hobi Devre uses2.02TRY only when its own visible price and public product API agree, not stale1.92JSONLD',()=>{
 const h=fixture('hobidevre.html');assert.equal(parseProduct(h,hu).price,192);
 const p=parseHobidevreProduct(h,hu,api());assert.equal(p.price,202);assert.equal(p.stockStatus,'out_of_stock');assert.equal(p.stockQuantity,0);assert.equal(p.minimumOrderQuantity,1);assert.equal(p.orderStep,1);assert.equal(p.quantityVerified,true);assert.ok(p.image?.includes('1_Watt_direnc'));
 assert.throws(()=>parseHobidevreProduct(h,hu));
});
test('Hobi Devre rejects a different API product, foreign permalink, nonTRY price, variants or contradictory stock',()=>{
 const changes=[{id:8181},{sku:'OTHER'},{name:'100K 2W Direnç'},{permalink:'https://foreign.example/urun/100k-1w-direnc/'},{type:'variable'},{has_options:true},{variations:[{id:9}]},{is_in_stock:true},{is_on_backorder:true}];
 for(const change of changes)assert.throws(()=>parseHobidevreProduct(fixture('hobidevre.html'),hu,{...api(),...change}));
 for(const change of [{price:'192'},{currency_code:'USD'},{currency_minor_unit:3}]){const d=api();Object.assign(d.prices,change);assert.throws(()=>parseHobidevreProduct(fixture('hobidevre.html'),hu,d));}
 const d=api();d.add_to_cart.multiple_of=0;assert.throws(()=>parseHobidevreProduct(fixture('hobidevre.html'),hu,d));
});
test('Hobi adapter obtains missing stock-out order steps only through a same-store public GET',async()=>{
 const original=globalThis.fetch,seen:string[]=[];
 globalThis.fetch=async(input,options)=>{const url=new URL(String(input));seen.push(url.pathname);assert.ok(!options?.method||options.method==='GET');if(url.pathname==='/robots.txt')return new Response('User-agent: *\nAllow: /');if(url.pathname==='/urun/100k-1w-direnc/')return new Response(fixture('hobidevre.html'));if(url.pathname==='/wp-json/wc/store/v1/products/8180')return Response.json(api());throw new Error('Unexpected endpoint');};
 try{const p=await new HobidevreAdapter({id:'hobidevre',domain:'www.hobidevre.com'}).getProduct(hu);assert.equal(p.price,202);assert.ok(seen.includes('/wp-json/wc/store/v1/products/8180'));}finally{globalThis.fetch=original;}
});
test('Robotronik repair is limited to the checked A0470 address and preserves archive aliases',async()=>{
 assert.equal(robotronikProductUrl(old),canonical);assert.equal(robotronikProductUrl(canonical),canonical);
 assert.equal(robotronikProductUrl('https://www.robotronik.com.tr/-different-a0469'),'https://www.robotronik.com.tr/-different-a0469');
 assert.throws(()=>robotronikProductUrl('https://foreign.example/-max7219-dot-led-matrix-modul-8x8-kirmizi-a0470'));
 const p=parseRobotronikProduct(fixture('robotronik.html'),canonical);assert.equal(p.price,10924);assert.equal(p.stockQuantity,50);assert.ok(p.image?.endsWith('1-d899b34.jpg'));
 const stores=[{id:'robotronik',domain:'www.robotronik.com.tr',enabled:true}],record=validateSnapshot({readerRevision:2,storeId:'robotronik',requestedUrl:old,checkedAt:observedAt,product:p},stores,at);
 const previews=await archivePreviews([old,canonical],stores,async()=>[{store_id:'robotronik',url:old,checked_at:observedAt,payload:JSON.stringify(record)}],at);
 assert.ok(previews.every(v=>v.price===10924&&v.checkedAt===observedAt&&v.canonicalUrl===canonical));
 const rows=archiveProducts(previews.map(preview=>({storeId:'robotronik',preview})),at);assert.equal(rows.length,1);assert.deepEqual(rows[0].sources.map(s=>s.url),[canonical]);
});
test('Komponentci stock-out still cannot become a purchasable quote when its order controls are absent',()=>{
 const h=fixture('komponentci.html'),p=parseProduct(h,ku);assert.equal(p.price,4337);assert.equal(p.stockStatus,'out_of_stock');assert.ok(p.image);assert.throws(()=>parseKomponentciProduct(h,ku),/satış birimi/);
});
const stores=[{id:'komponentci',domain:'www.komponentci.net'}];
const metadata={storeId:'komponentci',url:ku,name:'0412 Yüksek Hızlı Drone Motoru',image:'https://platincdn.com/3106/pictures/product.jpg',observedAt,reason:'Satış birimi doğrulanamadı.'};
test('image-only metadata cannot contain a price, foreign product URL or future check time',()=>{
 assert.equal(validateCatalogMetadata(metadata,stores,at).name,metadata.name);
 for(const change of [{price:4337},{checkedAt:observedAt},{url:'https://foreign.example/p'},{observedAt:new Date(at+1).toISOString()},{image:'http://cdn.example/p.jpg'}])assert.throws(()=>validateCatalogMetadata({...metadata,...change},stores,at));
});
test('image enrichment preserves old price dates and cannot attach a different product photograph',()=>{
 const raw={name:metadata.name,price:4337,checkedAt:'2026-10-20T12:00:00.000Z',quantityVerified:true},merged=mergeCatalogMetadata(raw,metadata)!;
 assert.equal(merged.price,4337);assert.equal(merged.checkedAt,raw.checkedAt);
 assert.equal(mergeCatalogMetadata({name:'STM32F103C6T6A Entegre'},metadata),undefined);
 const empty:CatalogPreview={url:ku,name:'',image:null,key:'',price:null,stockStatus:'unknown',checkedAt:'',message:'',archiveState:'missing'};
 const enriched=enrichCatalogPreview(empty,metadata,stores,at);assert.equal(enriched.price,null);assert.equal(enriched.checkedAt,'');assert.equal(enriched.image,metadata.image);assert.equal(enriched.metadataOnly,true);
 assert.equal(archiveProducts([{storeId:'komponentci',preview:enriched}],at).length,0);
});
test('plain404 remains a missing product, not an invented access or price success',async()=>{
 const original=globalThis.fetch;globalThis.fetch=async input=>new URL(String(input)).pathname==='/robots.txt'?new Response('User-agent: *\nAllow: /'):new Response('Not found',{status:404});
 try{await assert.rejects(()=>new JsonLdAdapter({id:'missing',domain:'missing.example'}).getProduct('https://missing.example/removed'),/404.*ürün sayfası bulunamadı/);}finally{globalThis.fetch=original;}
});
test('recovery manifest contains exactly the original19 failures, not a broad catalog re-scan',()=>{
 const rows=JSON.parse(readFileSync('scripts/catalog/recovery/failed19-2026-10-24.json','utf8')) as {storeId:string;url:string}[];
 assert.equal(rows.length,19);assert.equal(new Set(rows.map(r=>r.url)).size,19);
 assert.deepEqual(Object.fromEntries([...new Set(rows.map(r=>r.storeId))].sort().map(id=>[id,rows.filter(r=>r.storeId===id).length])),{ekomponent:1,hobidevre:1,komponentci:1,ozdisan:8,robitshop:7,robotronik:1});
});
