import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {parseTsoftProduct} from '../src/stores/tsoft';
import {catalogIdentity,canMergeCatalogProducts,relatedRegulatorModule} from '../src/lib/catalog-identity';
import {catalogueSources} from '../src/lib/catalog-sources';
import {validateRegulatorOffers} from '../src/lib/regulator-offers';
import {demoOffers,products} from '../src/lib/catalog';
const direnc={name:'LM2596 Ayarlanabilir Voltaj Düşürücü Güç Modülü (4-35V Giriş - 1-30V Çıkış)'};
const mini={name:'LM2596 Mini Ayarlanabilir Voltaj Düşürücü Regülatör Kartı 3A (4-35V ile 1.25-30V)'};
test('a fresh old multi-output quote cannot leak through after the identity rule changes',()=>{
 const product={...products[0],id:'reg',...direnc};
 const offers=['LM2596 Ayarlanabilir Güç Modülü','LM2596 Çok Çıkışlı Güç Modülü 3.3V-5V-12V ADJ',mini.name].map((title,i)=>({...demoOffers[0],id:`reg-${i}`,canonical_product_id:product.id,title,source:'live',last_error:null,last_checked_at:new Date().toISOString()}));
 const checked=validateRegulatorOffers(offers,[product]);
 assert.equal(checked[0].last_error,null);assert.ok(checked[1].last_error);assert.ok(checked[2].last_error);
 assert.ok(offers.every(offer=>offer.last_error===null),'The cache guard does not mutate caller data');
});
test('LM2596 discovery reaches the real Mini listing within the merchant candidate bound',()=>{
 const sources=catalogueSources(direnc).filter(source=>source.storeId==='robotistan');
 assert.ok(sources.length<=4);
 assert.ok(sources.some(source=>source.url.endsWith('/mini-ayarlanabilir-3a-voltaj-regulator-karti-lm2596-adj')));
 assert.ok(sources.every(source=>!source.url.includes('segmentli') && !source.url.includes('5v') && !source.url.includes('kablolu')));
});
test('regulator naming differences do not hide equivalent standard boards, different versions remain separate',()=>{
 assert.ok(canMergeCatalogProducts(direnc,{name:'Ayarlanabilir 3A Voltaj Regülatör Kartı LM2596 ADJ'}));
 assert.notEqual(catalogIdentity(direnc),catalogIdentity(mini));
 assert.ok(relatedRegulatorModule(direnc,mini));
 for(const name of ['5V 3A Voltaj Regülatör Kartı LM2596-5V','7 Segmentli Ayarlanabilir 3A Voltaj Regülatör Kartı LM2596 ADJ','Ayarlanabilir 3A Regülatör Kartı Kablolu LM2596 ADJ','LM2596 ADJ TO-263 entegre','LM2596 Ayarlanabilir 3A Klemensli Voltaj Regülatör Kartı','Ayarlanabilir DC-DC Alçaltıcı/Yükseltici Regülatör LM2596 LM2577','LM2596 Ayarlanabilir 5A Regülatör Kartı','LM2596 Çok Çıkışlı Güç Kaynağı Modülü 3.3V-5V-12V-ADJ','LM2596 Ayarlanabilir USB Güç Modülü']){
  assert.ok(!canMergeCatalogProducts(direnc,{name}),name);
  assert.ok(!relatedRegulatorModule(direnc,{name}),name);
 }
});
test('recorded real LM2596 pages preserve independent VAT prices and opposite stock states',()=>{
 const a=parseTsoftProduct(readFileSync(new URL('./fixtures/merchants/lm2596-direnc.html',import.meta.url),'utf8'),'https://www.direnc.net/lm2596-power-suplay-modul-1');
 const b=parseTsoftProduct(readFileSync(new URL('./fixtures/merchants/lm2596-robotistan.html',import.meta.url),'utf8'),'https://www.robotistan.com/mini-ayarlanabilir-3a-voltaj-regulator-karti-lm2596-adj');
 assert.equal(a.price,5521);assert.equal(a.stockStatus,'out_of_stock');
 assert.equal(b.price,6812);assert.equal(b.stockStatus,'in_stock');
 assert.ok(a.quantityVerified && b.quantityVerified);assert.notEqual(catalogIdentity(a),catalogIdentity(b));
});
