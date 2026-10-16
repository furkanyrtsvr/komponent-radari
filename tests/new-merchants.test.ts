import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {parseSammProduct} from '../src/stores/samm';
import {parseKomponentciProduct} from '../src/stores/komponentci';
import {parseOzdisanProduct} from '../src/stores/ozdisan';
import {quoteOffer} from '../src/lib/pricing';
import {demoOffers} from '../src/lib/catalog';
import {parseTsoftProduct} from '../src/stores/tsoft';
const fixture=(name:string)=>readFileSync(new URL(`./fixtures/merchants/${name}.html`,import.meta.url),'utf8');
const sammUrl='https://market.samm.com/40-li-erkek-erkek-jumper-seti';
const komUrls={hcsr04:'https://www.komponentci.net/hc-sr04-arduino-ultrasonik-mesafe-sensoru-pmu245',sg90:'https://www.komponentci.net/sg90-rc-mini-servo-motor-micro-servo-motor-sg90-9g-180-pmu232',res10:'https://www.komponentci.net/1k-1-4w-direnc-10-adet-pmu7633',res5000:'https://www.komponentci.net/1k-1-4w-direnc-5000-adet-pmu12'};
const ozUrl='https://www.ozdisan.com/p/programlanabilir-zamanlayici-ve-osilator-entegreleri-211/texas-ne555p-14278';
const ozAms='https://www.ozdisan.com/p/lineer-voltaj-regulatorleri-279/ams-ams1117-3-3-348307';
test('captured T-Soft pages use each merchant own price and ignore a preceding recommendation',()=>{
 const prices=[['direnc',4940,'https://www.direnc.net/40-adet-erkek-erkek-jumper-20cm'],['robotistan',5734,'https://www.robotistan.com/40-pin-ayrilabilen-erkek-erkek-m-m-jumper-kablo-200-mm'],['robo90',4116,'https://www.robo90.com/40li-ayrilabilen-erkek-erkek-jumper-kablo-20cm-arduino-uyumlu'],['robolink',5550,'https://www.robolinkmarket.com/40-pin-ayrilabilen-erkek-erkek-jumper-kablo-200mm']] as const;
 for(const [file,price,url] of prices) assert.equal(parseTsoftProduct('<div class="product-price">1,00 TL</div>'+fixture(file),url).price,price);
});
test('contradictory20cm title and30cm description cannot enter a cable plan',()=>{
 assert.throws(()=>parseTsoftProduct(fixture('robotsepeti'),'https://www.robotsepeti.com/40-pin-erkek-erkek-jumper-kablo-20cm'),/uzunluk çelişiyor/);
});
test('SAMM takes actual42.66TRY variant price instead of mislabeledUSDbase0.87 and confirms20cm ribbon',()=>{const p=parseSammProduct(fixture('samm'),sammUrl);assert.equal(p.price,4266);assert.equal(p.priceNet,3555);assert.equal(p.vatIncluded,true);assert.equal(p.packageQuantity,1);assert.equal(p.stockQuantity,60);assert.equal(p.quantityVerified,true);assert.match(p.name,/20cm/);});
test('SAMM excludes a stale or unrelated selected price',()=>{const h=fixture('samm').replace('42.659672661177','43.659672661177');assert.throws(()=>parseSammProduct(h,sammUrl),/ödenecek fiyatı/);});
test('Komponentci reads actual main sensor and positional servo after Turkish decoding',()=>{const a=parseKomponentciProduct(fixture('komponentci-hcsr04'),komUrls.hcsr04),b=parseKomponentciProduct(fixture('komponentci-sg90'),komUrls.sg90);assert.equal(a.price,4844);assert.equal(b.price,7220);assert.match(a.name,/Sensörü/);assert.match(b.name,/180°/);assert.equal(a.minimumOrderQuantity,1);});
test('Komponentci converts sale-pack controls to piece quantities for10and5000packs',()=>{for(const[key,pack,price]of [['res10',10,295],['res5000',5000,69658]] as const){const p=parseKomponentciProduct(fixture(`komponentci-${key}`),komUrls[key]);assert.equal(p.price,price);assert.equal(p.packageQuantity,pack);assert.equal(p.minimumOrderQuantity,pack);assert.equal(p.orderStep,pack);const o={...demoOffers[0],price_gross:p.price!,package_quantity:pack,minimum_order_quantity:p.minimumOrderQuantity!,order_step:p.orderStep!};assert.equal(quoteOffer(o,pack+1).cost,price*2);}});
test('Komponentci ignores a related-product price preceding the main product scope',()=>{const h='<div class="urun_kdvdahil_fiyati">1,00TL</div>'+fixture('komponentci-hcsr04');assert.equal(parseKomponentciProduct(h,komUrls.hcsr04).price,4844);});
test('Özdisan adds VAT from actual total column and leavesMPQ50separate fromMOQ1',()=>{const p=parseOzdisanProduct(fixture('ozdisan-ne555'),ozUrl);assert.equal(p.price,1496);assert.equal(p.minimumOrderQuantity,1);assert.equal(p.orderStep,1);assert.equal(p.stockQuantity,3038);assert.match(p.name,/DIP8/);const o={...demoOffers[0],price_gross:p.price!,package_quantity:1,minimum_order_quantity:1,order_step:1,price_tiers:JSON.stringify(p.priceTiers)};for(const[q,total]of [[1,1496],[25,34651],[50,63758],[250,318486]])assert.equal(quoteOffer(o,q).cost,total);});
test('Özdisan precise tiers preserve sub-kuruş prices until subtotal rounds',()=>{const p=parseOzdisanProduct(fixture('ozdisan-ams'),ozAms),o={...demoOffers[0],price_gross:p.price!,package_quantity:1,minimum_order_quantity:1,order_step:1,price_tiers:JSON.stringify(p.priceTiers)};for(const[q,total]of [[1,876],[100,82003],[500,381739],[1000,706925]])assert.equal(quoteOffer(o,q).cost,total);});
test('Özdisan rejects discrepant payable total or alteredMOQ',()=>{assert.throws(()=>parseOzdisanProduct(fixture('ozdisan-ne555').replace('14.9600 TRY','15.9600 TRY'),ozUrl),/toplam fiyatı/);assert.throws(()=>parseOzdisanProduct(fixture('ozdisan-ne555').replace('MOQ:1','MOQ:50'),ozUrl),/MOQ/);});
