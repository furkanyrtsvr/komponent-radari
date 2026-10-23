import{parseProduct}from'../src/stores/base';
import{load}from'cheerio';
import{OzdisanAdapter}from'../src/stores/ozdisan';
import{merchantDisplayPreferences}from'../src/stores/request-preferences';
import test from 'node:test';import assert from 'node:assert/strict';import{readFileSync}from'node:fs';
import{parsePilpaketiProduct}from'../src/stores/qukasoft';import{parseRobizProduct}from'../src/stores/robiz';import{parseOzdisanProduct}from'../src/stores/ozdisan';import{quoteOffer}from'../src/lib/pricing';import{demoOffers,storeCatalog}from'../src/lib/catalog';import{validateSnapshot,snapshotProduct}from'../src/lib/catalog-snapshot';import{variantConflict,canMergeCatalogProducts}from'../src/lib/catalog-identity';import{cartOffers}from'../src/lib/cart-offers';
const fixture=(id:string)=>readFileSync(new URL(`./fixtures/merchants/units-2026-10-23/${id}.html`,import.meta.url),'utf8');
const cable='https://www.pilpaketi.com/10-awg-tam-silikon-kablo-kirmizi',needle='https://www.robiz.net/0.4mmnozzleneedle',oz='https://www.ozdisan.com/p/3d-yazici-aksesuarlari-904/anycubic-extruder-1598304';
test('metre-priced cable preserves the merchant base unit through its archive and quotes three metres, not one piece',()=>{
 const p=parsePilpaketiProduct(fixture('pilpaketi'),cable);assert.equal(p.unitType,'metre');assert.equal(p.price,21857);assert.equal(p.packageQuantity,1);assert.equal(p.minimumOrderQuantity,1);assert.equal(p.orderStep,1);
 const checkedAt=new Date().toISOString();const snapshot=validateSnapshot({storeId:'pilpaketi',checkedAt,readerRevision:2,product:p},storeCatalog);assert.equal(snapshotProduct(snapshot).unitType,'metre');
 const offer={...demoOffers[0],unit_type:'metre' as const,price_gross:p.price!,package_quantity:1,minimum_order_quantity:p.minimumOrderQuantity,order_step:p.orderStep};assert.deepEqual(quoteOffer(offer,3),{packages:3,purchasedQuantity:3,cost:65571});
 // A fractional metre requirement rounds up to the merchant's whole-metre increment.
 assert.equal(quoteOffer(offer,2.5).purchasedQuantity,3);
 assert.throws(()=>parsePilpaketiProduct(fixture('pilpaketi').replace('Metre</','Kilogram</'),cable),/satış birimi/);
});
test('ten physical needles are bought as whole packs and bulk thresholds remain pack-aware',()=>{
 const p=parseRobizProduct(fixture('robiz'),needle);assert.equal(p.price,8910);assert.equal(p.packageQuantity,10);assert.equal(p.minimumOrderQuantity,10);assert.equal(p.orderStep,10);assert.equal(p.quantityVerified,true);
 const offer={...demoOffers[0],price_gross:p.price!,package_quantity:10,minimum_order_quantity:p.minimumOrderQuantity,order_step:p.orderStep};assert.deepEqual(quoteOffer(offer,11),{packages:2,purchasedQuantity:20,cost:17820});assert.equal(quoteOffer(offer,10).cost,8910);
 assert.notEqual(parseRobizProduct(fixture('robiz')+'<select name="option[1]"><option>Size</option></select>',needle).quantityVerified,true);
});
test('a metre quote cannot merge with or undercut the same name sold per piece',()=>{
 const a={name:'10 AWG Tam Silikon Kablo - Kırmızı',unit_type:'metre'},b={name:a.name,unit_type:'adet'};assert.match(variantConflict(a,b),/Satış birimi/);assert.equal(canMergeCatalogProducts(a,b),false);
});
test('Ozdisan accepts current hashed table classes and still rejects VAT and row tampering',()=>{
 const html=fixture('ozdisan'),p=parseOzdisanProduct(html,oz);assert.equal(p.price,279846);assert.equal(p.minimumOrderQuantity,1);assert.equal(p.stockQuantity,5);
 const offer={...demoOffers[0],price_gross:p.price!,package_quantity:1,minimum_order_quantity:1,order_step:1,price_tiers:JSON.stringify(p.priceTiers)};assert.equal(quoteOffer(offer,5).cost,1343256);
 assert.throws(()=>parseOzdisanProduct(html.replace('Toplam Fiyat','Toplam'),oz),/toplam fiyat tablosu/);
 assert.throws(()=>parseOzdisanProduct(html.replace('2,798.46','2,798.45'),oz),/KDV dahil toplam/);
});

test('Ozdisan anonymous reader explicitly requests Turkish TRY/VAT view instead of regional USD defaults',async()=>{
 const original=globalThis.fetch;const headers:Record<string,string>[]=[];
 globalThis.fetch=(async(input:any,init:any)=>{const url=String(input);const h=Object.fromEntries(new Headers(init?.headers).entries());headers.push(h);if(url.endsWith('/robots.txt'))return new Response('User-agent: *\nAllow: /');const setting=decodeURIComponent((h.cookie||'').replace(/^user-settings=/,''));const pref=JSON.parse(setting);assert.deepEqual({...pref,timestamp:0},{languageCode:'tr',currencyCode:'TRY',countryCode:'TR',timestamp:0,isAuthenticated:false});assert.ok(Math.abs(Date.now()-pref.timestamp)<10000);return new Response(fixture('ozdisan'));}) as typeof fetch;
 try{const p=await new OzdisanAdapter({id:'ozdisan',domain:'www.ozdisan.com'}).getProduct(oz);assert.equal(p.price,279846);assert.ok(headers.every(h=>!h.authorization));assert.deepEqual(merchantDisplayPreferences('ozdisan.com.example.org'),{});assert.deepEqual(merchantDisplayPreferences('www.robiz.net'),{});}finally{globalThis.fetch=original;}
});

test('exact numeric merchant part numbers do not fail fuzzy discovery scoring, while different part numbers still fail',()=>{
 const html=fixture('ozdisan-numeric'),url='https://www.ozdisan.com/p/DIN41612-711/harting-09032967825-1068011';
 assert.equal(parseProduct(html,url).name,'09032967825');assert.throws(()=>parseOzdisanProduct(html,url),/fiyat ve stok talebi/);
 const $=load(html);$('h1').text('09032967845');assert.throws(()=>parseProduct($.html(),url),/Product JSON-LD/);
});

test('a foreign server TRY view labelled VAT-included is rejected when its totals still equal net prices',()=>{
 assert.throws(()=>parseOzdisanProduct(fixture('ozdisan-region-vat-conflict'),oz),/KDV dahil toplam fiyatı doğrulanamadı/);
});
