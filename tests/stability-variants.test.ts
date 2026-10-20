import test from 'node:test';
import assert from 'node:assert/strict';
import {variantConflict,matchesCatalogRequirement} from '../src/lib/catalog-identity';
import {catalogGroup} from '../public/catalog/product-identity.js';
import {evidenceRatings,evidenceAttributeConflict} from '../public/catalog/product-evidence.js';
import {applyDefaultShipping} from '../src/lib/default-shipping';
import {applyCartShipping} from '../src/lib/cart-shipping';
import {storeCatalog} from '../src/lib/catalog';

test('different voltage, current, dimensions and package variants remain separate across families',()=>{
 for(const [a,b] of [
  ['12V 2A Güç Adaptörü','24V 2A Güç Adaptörü'],
  ['12V 2A Güç Adaptörü','12V 5A Güç Adaptörü'],
  ['5V Röle Modülü','12V Röle Modülü'],
  ['6x6x5mm Buton','6x6x9mm Buton'],
  ['12V 100rpm Motor','24V 100rpm Motor'],
  ['100uF 16V Kondansatör','100uF 50V Kondansatör'],
  ['5mm Kırmızı LED','3mm Kırmızı LED'],
  ['2.54mm Erkek Header 10 Pin','2.00mm Erkek Header 10 Pin'],
  ['1K 1/4W Direnç','1K 1W Direnç'],
 ]){assert.ok(variantConflict({name:a},{name:b}),`${a} vs ${b}`);assert.equal(matchesCatalogRequirement({name:a},{name:b}),false);}
});
test('equivalent units and whole dimension tuples agree with the merchant technical table',()=>{
 assert.deepEqual(evidenceRatings('0.5A'),evidenceRatings('500mA'));
 assert.deepEqual(evidenceRatings('1/4W'),evidenceRatings('0.25W'));
 assert.equal(evidenceAttributeConflict({name:'6x6x5mm Buton'},{name:'0.6 × 0.6 × 0.5 cm Buton'}),'');
 assert.equal(evidenceAttributeConflict({name:'6x6x5mm Buton'},{name:'6x6x5mm Buton',specifications:JSON.stringify({properties:[{name:'Boyutlar',value:'6 × 6 × 5 mm'}]})}),'');
});
test('assembled categories override incidental chips, and all given shipping defaults survive personal edits',()=>{
 for(const [name,group] of [['L298N Motor Sürücü Kartı','Modüller'],['ESP32 DevKit Geliştirme Kartı','Geliştirme Kartları'],['12V Güç Adaptörü','Güç ve Pil'],['2.54mm Erkek Header','Bağlantı Elemanları'],['100uF Kondansatör','Kondansatörler']])assert.equal(catalogGroup(name,'Diğer'),group);
 const stores=storeCatalog.map(applyDefaultShipping);
 assert.equal(stores.filter(s=>s.shipping_known).length,20);
 const own=applyCartShipping(stores,[{id:'x',cart_id:'c',store_id:'direnc',shipping_price:12300,free_shipping_threshold:99900,updated_at:''}]);
 assert.equal(own[0].shipping_base_price,12300);assert.equal(own[1].shipping_base_price,14900);
 assert.equal(applyCartShipping(stores,[])[0].shipping_base_price,14400);
});
