import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {parseTsoftProduct} from '../stores/tsoft';
import {parseRobocomboProduct} from '../stores/robocombo';
import {parseOzdisanProduct} from '../stores/ozdisan';
import {validateSnapshot} from '../lib/catalog-snapshot';
import {storeCatalog,demoOffers} from '../lib/catalog';
import {quoteOffer} from '../lib/pricing';
import {load} from 'cheerio';
const fixture=(name:string)=>readFileSync(`tests/fixtures/merchants/${name}.html`,'utf8');
test('a zero-based merchant discount range does not discard the observed XR2206 price',()=>{
 const p=parseTsoftProduct(fixture('direnc-xr2206-zero-tier'),'https://www.direnc.net/xr2206-tssop-16-zamanlayici-entegre');
 assert.equal(p.price,11624);assert.equal(p.stockStatus,'out_of_stock');assert.ok(p.priceTiers?.every(t=>t.minimum>=1));
 assert.ok(validateSnapshot({storeId:'direnc',checkedAt:new Date().toISOString(),product:{...p,packageQuantity:p.packageQuantity||1}},storeCatalog));
});
test('Robocombo alternate fiyat2 control yields actual stocked XL4015 price rather than a related item',()=>{
 const html=fixture('robocombo-xl4015'),url='https://www.robocombo.com/xl4015-5a-dcdc-cift-ekranli-voltaj-dusurucu-2872';
 const p=parseRobocomboProduct(html,url);assert.equal(p.price,39520);assert.equal(p.stockQuantity,154);assert.equal(p.stockStatus,'in_stock');
 const altered=load(html);altered('#fiyat2 .spanFiyat').text('396,20 ₺');
 assert.throws(()=>parseRobocomboProduct(altered.html(),url),/fiyatı/);
});
test('Özdisan fixed-price Offer without priceSpecification reconciles with its visible VAT total',()=>{
 const p=parseOzdisanProduct(fixture('ozdisan-fixed-price-hcsr04'),'https://www.ozdisan.com/p/arduino-sensorleri-ve-modulleri-613/ozd-arduino-hc-sr04-ultras-rang-mod-951892');
 assert.equal(p.stockQuantity,36);assert.equal(p.stockStatus,'in_stock');assert.equal(p.price,19844);
 assert.equal(quoteOffer({...demoOffers[0],price_gross:p.price!,package_quantity:1,minimum_order_quantity:1,order_step:1,price_tiers:JSON.stringify(p.priceTiers)},1).cost,19844);
});
