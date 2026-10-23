import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {load} from 'cheerio';
import {parseTsoftProduct} from '../src/stores/tsoft';
import {JsonLdAdapter,isRetryableStoreError,canRetainObservedProduct,StoreReadError} from '../src/stores/base';
import {upgradeSnapshotReader} from '../src/lib/catalog-snapshot';
import {ROBOTISTAN_TAX_PROOF} from '../src/lib/merchant-price-proof';
const fixture=(i:number)=>readFileSync(new URL(`./fixtures/merchants/tsoft-2026-10-23/robotsepeti-${i}.html`,import.meta.url),'utf8');
const urls=['https://www.robotsepeti.com/470-uh-direnc-tip-bobin','https://www.robotsepeti.com/1000-uf-35velektrolit-kondansator','https://www.robotsepeti.com/40khz-16mm-ultrasonic-sensor-efc16tr-2'];

test('migrated Robot Sepeti theme proves all three gross prices and sale increments without losing out-of-stock status',()=>{
 for(const [i,price] of [488,792,46875].entries()){
  const p=parseTsoftProduct(fixture(i),urls[i]);assert.equal(p.price,price);assert.equal(p.vatIncluded,true);assert.equal(p.currency,'TRY');assert.equal(p.minimumOrderQuantity,1);assert.equal(p.orderStep,1);assert.equal(p.quantityVerified,true);
  if(i===2)assert.equal(p.stockStatus,'out_of_stock');
 }
});
test('new theme rejects changed, ambiguous or missing gross evidence and foreign currency',()=>{
 const input=fixture(0);
 for(const mode of ['changed','ambiguous','missing','currency']){
  const $=load(input);const gross=$('[data-toggle="price-sell-vat"]').first();
  if(mode==='changed')gross.text('4,89 TL');
  if(mode==='ambiguous')gross.after('<span data-toggle="price-sell-vat">4,89 TL</span>');
  if(mode==='missing')gross.remove();
  if(mode==='currency')$('script[type="application/ld+json"]').each((_,el)=>{$(el).text($(el).text().replaceAll('TRY','USD'));});
  if(mode==='currency')assert.notEqual(parseTsoftProduct($.html(),urls[0]).currency,'TRY');
  else assert.throws(()=>parseTsoftProduct($.html(),urls[0]),/fiyat/);
 }
});
test('recommendation amounts outside the main product never change a proved Robot Sepeti price',()=>{
 const html='<div data-toggle="price-sell-vat">0,01 TL</div>'+fixture(0);
 assert.equal(parseTsoftProduct(html,urls[0]).price,488);
});
test('a denied robots request stays non-retryable and never fetches the product',async()=>{
 const original=globalThis.fetch;const calls:string[]=[];
 globalThis.fetch=async(input)=>{calls.push(String(input));return new Response('Forbidden',{status:403});};
 try{
  const adapter=new JsonLdAdapter({id:'denied',domain:'denied-merchant.example'});
  await assert.rejects(()=>adapter.getProduct('https://denied-merchant.example/item'),error=>error instanceof Error&&!isRetryableStoreError(error)&&/403/.test(error.message));
  assert.equal(calls.length,1);assert.equal(new URL(calls[0]).pathname,'/robots.txt');
 }finally{globalThis.fetch=original;}
});

const robotistanUrls=['https://www.robotistan.com/14w-direnc-kiti-500-adet','https://www.robotistan.com/50v-1-uf-kondansator','https://www.robotistan.com/mini-manyetik-hall-effect-sensor-karti'];
function regionalRobotistan(i:number){
 const html=readFileSync(new URL(`./fixtures/merchants/tsoft-2026-10-23/robotistan-${i}.html`,import.meta.url),'utf8');
 const $=load(html),net=$('.product-price-not-vat').first().text(),netNumber=[126.43,1.41,24.18][i];
 $('.product-current-price').first().html(`<span data-toggle="price-sell-vat">${net}</span> TL <span data-toggle="price-sell">${net}</span> TL + KDV`);
 $('script[type="application/ld+json"]').each((_,el)=>{const data=JSON.parse($(el).text());const node=data['@graph'].find((n:any)=>n['@type']==='Product');node.offers.price=String(netNumber);$(el).text(JSON.stringify(data));});
 return $.html();
}
test('regional Robotistan net-labelled-as-gross widgets use only the merchant proved positive-VAT total',()=>{
 for(const [i,price] of [15172,169,2901].entries()){
  const p=parseTsoftProduct(regionalRobotistan(i),robotistanUrls[i]);assert.equal(p.price,price);assert.equal(p.vatRate,.2);assert.ok(p.warnings.includes(ROBOTISTAN_TAX_PROOF));
 }
});
test('Robotistan classic widgets also require the bound tax total when the regional display collapses to net',()=>{
 const $=load(regionalRobotistan(0));$('[data-toggle="price-sell-vat"]').attr('class','product-price').removeAttr('data-toggle');$('[data-toggle="price-sell"]').attr('class','product-price-not-vat').removeAttr('data-toggle');
 assert.equal(parseTsoftProduct($.html(),robotistanUrls[0]).price,15172);
});
test('regional tax proof rejects missing VAT, inconsistent total, wrong identity or display currency',()=>{
 const html=regionalRobotistan(0);
 for(const [before,after] of [['"vat":20','"vat":0'],['"total_sale_price":151.72','"total_sale_price":126.43'],['"currency_target":"TL"','"currency_target":"EUR"'],['"id":"1000"','"id":"999"'],['"code":"12205"','"code":"999"']]){
  assert.ok(html.includes(before),before);assert.throws(()=>parseTsoftProduct(html.replace(before,after),robotistanUrls[0]),/KDV/);
 }
 const $=load(html);$('script').filter((_,el)=>$(el).text().includes('PRODUCT_DATA')).remove();assert.throws(()=>parseTsoftProduct($.html(),robotistanUrls[0]),/KDV/);
});
test('old Robotistan snapshots require new tax proof; other merchant snapshots retain their original date',()=>{
 const record:any={storeId:'robotistan',checkedAt:'2026-10-23T13:39:21.857Z',product:{warnings:[]}};
 assert.equal(upgradeSnapshotReader(record),undefined);
 const proved={...record,product:{warnings:[ROBOTISTAN_TAX_PROOF]}};assert.equal(upgradeSnapshotReader(proved),proved);
 const other={...record,storeId:'robotsepeti'};assert.equal(upgradeSnapshotReader(other),other);
});
test('access errors may retain a dated record; contradictory money and product evidence may not',()=>{
 for(const e of [new StoreReadError('403',false),new StoreReadError('503'),new DOMException('timeout','TimeoutError')])assert.equal(canRetainObservedProduct(e),true);
 for(const e of [new Error('KDV fiyatları uyuşmuyor'),new Error('Farklı ürün modeli')])assert.equal(canRetainObservedProduct(e),false);
});
