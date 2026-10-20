import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {load} from 'cheerio';
import {parseMotorobitProduct} from '../src/stores/motorobit';
import {parseRobizProduct} from '../src/stores/robiz';
import {parseRobocomboProduct} from '../src/stores/robocombo';
import {parseOzdisanProduct} from '../src/stores/ozdisan';
import {validateSnapshot} from '../src/lib/catalog-snapshot';
const fixture=(id:string)=>readFileSync(new URL(`./fixtures/merchants/integration-2026-10-20/${id}-fixed.html`,import.meta.url),'utf8');

test('Motorobit compares product titles under the same URL/id instead of the incidental introductory description',()=>{
 const url='https://www.motorobit.com/isikli-2-pin-power-soketi',html=fixture('motorobit'),p=parseMotorobitProduct(html,url);
 assert.equal(p.price,3939);assert.equal(p.quantityVerified,true);assert.equal(p.stockQuantity,178);assert.equal(p.orderStep,1);
 assert.throws(()=>parseMotorobitProduct(html,'https://www.motorobit.com/another-product'),/fiyatı/);
});
test('Robiz keeps a 140-piece cable set as one saleable set and does not divide its price by 140',()=>{
 const p=parseRobizProduct(fixture('robiz'),'https://robiz.net/140pcscableset');assert.equal(p.price,10692);assert.equal(p.priceNet,8910);assert.equal(p.packageQuantity,1);assert.equal(p.minimumOrderQuantity,1);assert.equal(p.quantityVerified,true);
});
test('Robocombo reads exact application/json product data despite malformed merchant markup, with variant validation intact',()=>{
 const html=fixture('robocombo'),url='https://robocombo.com/0r-14w-direnc-5012';assert.equal(load(html)('#__NEXT_DATA__').length,0);
 const p=parseRobocomboProduct(html,url);assert.equal(p.price,50);assert.equal(p.stockQuantity,3812);assert.equal(p.quantityVerified,true);
 assert.throws(()=>parseRobocomboProduct(html,url+'?vid=wrong-variant'),/varyant/);
});
test('Özdisan quote-only pages explicitly explain that the merchant publishes no price',()=>{
 assert.throws(()=>parseOzdisanProduct(fixture('ozdisan'),'https://www.ozdisan.com/p/ag-ve-sira-direncler-196/samsung-rps104pj754cs-1557325'),/fiyat ve stok talebi istiyor/);
});
test('archived hostname aliases normalize without changing the variant or actual price observation time',()=>{
 const checkedAt='2026-10-20T10:00:00.000Z';
 const p=parseRobocomboProduct(fixture('robocombo'),'https://robocombo.com/0r-14w-direnc-5012');p.url+='?vid=actual#section';
 const record=validateSnapshot({storeId:'robocombo',readerRevision:2,checkedAt,product:p},[{id:'robocombo',domain:'www.robocombo.com'}],Date.parse(checkedAt)+1000);
 assert.equal(record.product.url,'https://www.robocombo.com/0r-14w-direnc-5012?vid=actual');assert.equal(record.checkedAt,checkedAt);
});
