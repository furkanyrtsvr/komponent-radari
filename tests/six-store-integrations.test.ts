import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {parsePilpaketiProduct} from '../src/stores/qukasoft';
import {parsePilsitesiProduct} from '../src/stores/ticimax';
import {parseEkomponentProduct} from '../src/stores/ekomponent';
import {parseHobidevreProduct} from '../src/stores/woocommerce';
import {parseIdeasoftProduct} from '../src/stores/ideasoft';
import {validateSnapshot} from '../src/lib/catalog-snapshot';
import {quoteOffer} from '../src/lib/pricing';
import {demoOffers,storeCatalog} from '../src/lib/catalog';
const root=new URL('./fixtures/merchants/integration-2026-10-20/',import.meta.url);
const cases=JSON.parse(readFileSync(new URL('index.json',root),'utf8')) as {store:string;file:string;url:string;observedAt:string}[];
const read=(file:string)=>readFileSync(new URL(file+'.html',root),'utf8');
const entry=(name:string)=>cases.find(c=>c.file===name+'.html')!;
const parse=(name:string,fn:(html:string,url:string)=>any)=>fn(read(name),entry(name).url);

test('Pil Paketi scopes the public TRY/VAT price and simple quantity independently of recommendations and payment discount',()=>{
 for(const [file,price,stock] of [['pilpaketi-0',9682,'out_of_stock'],['pilpaketi-1',148762,'out_of_stock'],['pilpaketi-2',1667,'out_of_stock'],['pilpaketi-3-instock',13406,'in_stock']] as const){const p=parse(file,parsePilpaketiProduct);assert.equal(p.price,price);assert.equal(p.stockStatus,stock);assert.equal(p.quantityVerified,true);assert.equal(p.minimumOrderQuantity,1);}
 const e=entry('pilpaketi-3-instock'),html=read('pilpaketi-3-instock');
 assert.equal(parsePilpaketiProduct('<div class="sale-variant-price">0,01 TL</div>'+html,e.url).price,13406);
 assert.throws(()=>parsePilpaketiProduct(html.replace('134,06 TL','135,06 TL'),e.url),/fiyatı/);
 assert.throws(()=>parsePilpaketiProduct(html.replace('data-increase="1"','data-increase="0"'),e.url),/satış birimi/);
});

test('Pil Sitesi reconciles its own Ticimax data, discounted VAT prices and physical two-cell packs',()=>{
 for(const [file,price,pack] of [['pilsitesi-0',35700,2],['pilsitesi-1',32100,1],['pilsitesi-2',9900,1],['pilsitesi-3',281200,1],['pilsitesi-4',1600,1],['pilsitesi-discount-0',12780,1],['pilsitesi-discount-1',11000,1]] as const){const p=parse(file,parsePilsitesiProduct);assert.equal(p.price,price);assert.equal(p.packageQuantity,pack);assert.equal(p.minimumOrderQuantity,pack);assert.equal(p.orderStep,pack);assert.equal(p.quantityVerified,true);}
 const e=entry('pilsitesi-2'),html=read('pilsitesi-2');
 assert.throws(()=>parsePilsitesiProduct(html.replace('<span class="spanFiyat">99,00 TL','<span class="spanFiyat">98,00 TL'),e.url),/fiyatı/);
 assert.throws(()=>parsePilsitesiProduct(html.replace('"productVariantData":null','"productVariantData":{"required":true}'),e.url),/varyantı/);
});

test('E komponent treats supplier h1 as MPN and verifies product-local TRY gross prices and tiers',()=>{
 const a=parse('ekomponent-product-0',parseEkomponentProduct),b=parse('ekomponent-product-1',parseEkomponentProduct);
 assert.equal(a.price,2826);assert.equal(a.mpn,'3520100KJT');assert.equal(a.stockQuantity,20);assert.equal(a.minimumOrderQuantity,1);assert.equal(a.priceTiers[1].price,1539);
 assert.equal(b.price,193896);assert.equal(b.quantityVerified,true);assert.equal(b.stockQuantity,14586);
 assert.throws(()=>parse('ekomponent-product-2',parseEkomponentProduct),/fiyat yayımlamıyor/);
 const e=entry('ekomponent-product-0'),html=read('ekomponent-product-0');assert.throws(()=>parseEkomponentProduct(html.replace('value="28,26"','value="29,26"'),e.url),/fiyatı/);
});

test('Ulutaş uses precise TRY net-plus-VAT and preserves five-piece bundle cost and stock units',()=>{
 for(const[file,price]of [['ulutas-product-0',38671],['ulutas-product-1',5949],['ulutas-product-2',62468]] as const)assert.equal(parse(file,parseIdeasoftProduct).price,price);
 const p=parse('ulutas-product-2',parseIdeasoftProduct);assert.equal(p.packageQuantity,5);assert.equal(p.minimumOrderQuantity,5);assert.equal(p.orderStep,5);assert.equal(p.stockQuantity,270);
 const offer={...demoOffers[0],price_gross:p.price,package_quantity:5,minimum_order_quantity:5,order_step:5};assert.equal(quoteOffer(offer,6).cost,124936);
});

test('F1 Depo reads discounted net rather than the old net price, and reconciles its VAT-inclusive cart price',()=>{
 const p=parse('f1depo-sample',parseIdeasoftProduct);assert.equal(p.price,4020);assert.equal(p.priceNet,3350);assert.equal(p.quantityVerified,true);assert.equal(p.stockQuantity,321);
 for(const [file,price,pack] of [['f1depo-extra-1',5520,1],['f1depo-extra-2',1050000,4]] as const){const out=parse(file,parseIdeasoftProduct);assert.equal(out.price,price);assert.equal(out.packageQuantity,pack);assert.equal(out.stockStatus,'out_of_stock');assert.equal(out.stockQuantity,0);assert.equal(out.orderStep,pack);}
 const e=entry('f1depo-sample');assert.throws(()=>parseIdeasoftProduct(read('f1depo-sample').replace('33,50 TL','34,50 TL'),e.url),/fiyatı/);
});

test('Hobi Devre reconciles current visible price with the ID-bound cart data even when JSON-LD is stale',()=>{
 for(const[file,price,pack]of [['hobidevre-sample',51840,1],['hobidevre-extra-1',35,1],['hobidevre-extra-2',2880,10]] as const){const p=parse(file,parseHobidevreProduct);assert.equal(p.price,price);assert.equal(p.packageQuantity,pack);assert.equal(p.minimumOrderQuantity,pack);assert.equal(p.orderStep,pack);}
 const e=entry('hobidevre-sample'),html=read('hobidevre-sample');
 assert.throws(()=>parseHobidevreProduct(html.replace('518,40','519,40'),e.url),/fiyatı/);
 assert.throws(()=>parseHobidevreProduct(html.replace('postid-5613','postid-9999'),e.url),/fiyatı|satış adımı/);
 assert.throws(()=>parseHobidevreProduct(html.replace('hd-cartform cart','hd-cartform cart variations_form'),e.url),/varyantı/);
});

test('six integrations produce validated archive records with canonical www addresses and the real observation time',()=>{
 const readers:Record<string,(html:string,url:string)=>any>={pilpaketi:parsePilpaketiProduct,pilsitesi:parsePilsitesiProduct,ekomponent:parseEkomponentProduct,ulutas:parseIdeasoftProduct,hobidevre:parseHobidevreProduct,f1depo:parseIdeasoftProduct};
 for(const e of cases.filter(c=>c.file!=='ekomponent-product-2.html')){
  const p=readers[e.store](readFileSync(new URL(e.file,root),'utf8'),e.url),r=validateSnapshot({readerRevision:2,storeId:e.store,checkedAt:e.observedAt,product:p},storeCatalog,Date.parse(e.observedAt)+1000);
  assert.equal(r.checkedAt,e.observedAt);assert.equal(new URL(r.product.url).hostname,storeCatalog.find(s=>s.id===e.store)!.domain);assert.equal(r.product.vatIncluded,true);
 }
});
