import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {parseIdeasoftProduct,IdeasoftAdapter} from '../stores/ideasoft';
import {parseRobocomboProduct} from '../stores/robocombo';
import {parseRobotronikProduct} from '../stores/robotronik';
import {inlineObject} from '../stores/inline-data';
import {storeCatalog,demoOffers} from '../lib/catalog';
import {quoteOffer} from '../lib/pricing';
const fixture=(id:string)=>readFileSync(new URL(`./fixtures/merchants/${id}.html`,import.meta.url),'utf8');
const urls={robotzade:'https://www.robotzade.com/urun/sg90-2-eksen-mikro-pan-tilt-unitesi',robitshop:'https://www.robitshop.com/urun/ultrasonik-mesafe-sensoru-hc-sr04',robocombo:'https://www.robocombo.com/Ultrasonik-Mesafe-Sensoru-HC-SR04,PR-1041.html',robotronik:'https://www.robotronik.com.tr/tp5000-42-v---36-v-1a-lityum-pil-sarj-modulu-a0993'};

test('requested four stores are registered without invented shipping thresholds',()=>{
 assert.equal(storeCatalog.length,20);
 for(const id of Object.keys(urls)){
  const s=storeCatalog.find(s=>s.id===id)!;assert.ok(s);assert.equal(s.domain,new URL(urls[id as keyof typeof urls]).hostname);assert.equal(s.free_shipping_threshold,null);
 }
});
test('IdeaSoft reads each merchant own gross price, not USD net or recommendations',()=>{
 const a=parseIdeasoftProduct('<div class="product-price">1,00 ₺</div>'+fixture('robotzade'),urls.robotzade),b=parseIdeasoftProduct('<div class="product-price">1,00 ₺</div>'+fixture('robitshop'),urls.robitshop);
 assert.equal(a.price,9000);assert.equal(a.priceNet,7500);assert.equal(a.vatIncluded,true);assert.equal(a.stockStatus,'in_stock');assert.equal(a.stockQuantity,1);
 assert.equal(b.price,4029);assert.equal(b.currency,'TRY');assert.equal(b.stockStatus,'out_of_stock');assert.equal(a.minimumOrderQuantity,1);assert.equal(b.quantityVerified,true);
});
test('IdeaSoft rejects altered gross metadata, names, variants and fractional sale units',()=>{
 const h=fixture('robotzade');
 assert.throws(()=>parseIdeasoftProduct(h.replace('"salePrice":90','"salePrice":91'),urls.robotzade),/fiyatı/);
 assert.throws(()=>parseIdeasoftProduct(h.replace('"fullName":"SG90','"fullName":"SG91'),urls.robotzade),/adı/);
 assert.throws(()=>parseIdeasoftProduct(h.replace('"parentId":"0"','"parentId":"25"'),urls.robotzade),/varyantı/);
 assert.throws(()=>parseIdeasoftProduct(h.replace('data-stocktype="Piece"','data-stocktype="metre"'),urls.robotzade),/Satış birimi/);
});
test('Ticimax verifies discounted gross against JSON-LD, visible price and main model',()=>{
 const p=parseRobocomboProduct('<div id="unrelated"><span class="spanFiyat">1,00 ₺</span></div>'+fixture('robocombo'),urls.robocombo);
 assert.equal(p.price,4446);assert.equal(p.priceNet,3705);assert.equal(p.stockQuantity,1583);assert.equal(p.quantityVerified,true);assert.equal(p.orderStep,1);
 const o={...demoOffers[0],price_gross:p.price!,package_quantity:p.packageQuantity!,minimum_order_quantity:p.minimumOrderQuantity!,order_step:p.orderStep!};assert.equal(quoteOffer(o,3).cost,13338);
 assert.throws(()=>parseRobocomboProduct(fixture('robocombo').replace('"productPriceKDVIncluded":44.459999999999994','"productPriceKDVIncluded":45'),urls.robocombo),/fiyatı/);
 assert.throws(()=>parseRobocomboProduct(fixture('robocombo').replace('"totalStockAmount":1583','"totalStockAmount":0'),urls.robocombo),/stok bilgisi/);
});
test('Robotronik scopes its title, gross price, stock and sale controls to main product',()=>{
 const h=fixture('robotronik'),p=parseRobotronikProduct('<span class="urun-fiyat">₺1.00</span>'+h,urls.robotronik);
 assert.equal(p.price,5004);assert.equal(p.stockQuantity,114);assert.equal(p.vatIncluded,true);assert.equal(p.minimumOrderQuantity,1);
 assert.throws(()=>parseRobotronikProduct(h.replace('"price": "50.04"','"price": "51.04"'),urls.robotronik),/fiyatı/);
 assert.throws(()=>parseRobotronikProduct(h.replace('min="1"','min="0"'),urls.robotronik),/satış adımı/);
});
test('remote inline data is parsed safely with escaped braces and never executed',()=>{
 assert.deepEqual(inlineObject('var data = {name: "a } \\"x\\"", nested: {quantity: 2}}; doSomething();',/var data = \{/),{name:'a } "x"',nested:{quantity:2}});
 assert.throws(()=>inlineObject('var data = {name: (() => process.exit())()};',/var data = \{/));
});

test('Robitshop missing whitespace in metadata still verifies the actual in-stock LM2577/LM2596 title',()=>{
 const p=parseIdeasoftProduct(fixture('robitshop-lm2577'),'https://www.robitshop.com/urun/dc-dc-voltaj-yukseltici-ve-dusurucu-regulator-karti-lm2577s-lm2596s');
 assert.equal(p.price,14445);assert.equal(p.stockStatus,'in_stock');assert.equal(p.quantityVerified,true);assert.match(p.name,/Düşürücü LM2577S/);
 assert.equal(p.minimumOrderQuantity,1);assert.equal(p.orderStep,1);assert.equal(p.stockQuantity,545);
 const offer={...demoOffers[0],price_gross:p.price!,package_quantity:p.packageQuantity!,minimum_order_quantity:p.minimumOrderQuantity!,order_step:p.orderStep!};
 assert.equal(quoteOffer(offer,1).cost,14445);assert.equal(quoteOffer(offer,1).purchasedQuantity,1);
});
test('Robotronik 10-piece pack rounds 11 required pieces up to two complete packs',()=>{
 const p=parseRobotronikProduct(fixture('robotronik-lm2596-pack'),'https://www.robotronik.com.tr/lm2596-ayarlanabilir-dc-dc-voltaj-dusurucu-step-down---10-adet-a0149-1');
 assert.equal(p.price,42681);assert.equal(p.packageQuantity,10);assert.equal(p.minimumOrderQuantity,10);assert.equal(p.orderStep,10);assert.equal(p.stockQuantity,240);
 const o={...demoOffers[0],price_gross:p.price!,package_quantity:p.packageQuantity!,minimum_order_quantity:p.minimumOrderQuantity!,order_step:p.orderStep!};
 assert.equal(quoteOffer(o,11).cost,85362);assert.equal(quoteOffer(o,11).purchasedQuantity,20);
});

test('IdeaSoft blocked-page catalog fallback creates a requirement with no invented quote',async()=>{
 for(const[id,domain,url]of [['robotzade','www.robotzade.com','https://www.robotzade.com/urun/hc-sr04-ultrasonik-sensor'],['robitshop','www.robitshop.com',urls.robitshop]]){
  const adapter=new IdeasoftAdapter({id,domain});const p=await adapter.getCatalogProduct(url);
  assert.match(p.name,/hc sr04/i);assert.equal(p.price,null);assert.equal(p.quantityVerified,false);assert.equal(p.stockStatus,'unknown');assert.match(p.warnings.join(' '),/canlı fiyatı şu anda alınamadı/);
  await assert.rejects(adapter.getCatalogProduct('https://evil.example'+new URL(url).pathname),/HTTPS/);
 }
});
