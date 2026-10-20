import index from '../src/lib/generated/catalog-matches';
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {catalogIdentity,matchesCatalogRequirement,variantConflict} from '../src/lib/catalog-identity';
import {potentiometerDetails,nameMatchScore,nameCandidateKeys,queryMatchesCatalogTitle,matchingName} from '../public/catalog/product-identity.js';
import {productRole} from '../src/lib/product-role';
import {catalogueSources} from '../src/lib/catalog-sources';
import {cartOffers} from '../src/lib/cart-offers';
import {products,demoOffers} from '../src/lib/catalog';
import {offerAvailability} from '../src/lib/offer-availability';
import {parseProduct} from '../src/stores/base';
import {validateProductFacts} from '../src/stores/validate-product-facts';
const facts=(name:string,description='')=>({name,specifications:JSON.stringify({description})});
const source=facts('1K Potans',"1K Potansiyomtre1K Potans, üzerindeki mili çevirdikçe değeri değişen ayarlı direnç çeşitlerindendir. Orta bacak ile herhangi bir bacağın arasındaki direnç 0 Ohm'ken diğer bacakla arasındaki direnç maksimum seviyededir.");

test('potentiometer abbreviations, misspellings and resistance units discover the same physical family at every value',()=>{
 for(const rating of ['1K','5K','10K','100K','500K'])for(const word of ['Potans','Pot','Potansiyomtre','Potansiyometrte','Potansiyometr','Potentiometer','Potansiyometre']){
  const a=facts(`${rating} ${word}`),b=facts(`${rating} Potansiyometre`);
  assert.equal(catalogIdentity(a),catalogIdentity(b));assert.equal(variantConflict(a,b),'');assert.ok(nameMatchScore(a,b)>=.65);
  assert.deepEqual(nameCandidateKeys(a),nameCandidateKeys(b));assert.ok(queryMatchesCatalogTitle(a.name,b.name));
 }
 for(const name of ['1000 Ohm Potentiometer','1kΩ Potansiyometre','1K0 Potansiyometre','1K Potansiyometre - WH148']){
  assert.ok(matchesCatalogRequirement(source,facts(name)),name);assert.ok(queryMatchesCatalogTitle(name,'1K Potansiyometre - WH148'),name);
 }
 assert.equal(potentiometerDetails(source)?.resistance,1000);assert.equal(potentiometerDetails(source)?.corroborated,true);
});

test('same resistance never equates trimpots, fixed resistors, knobs, modules or industrial/mechanically different pots',()=>{
 for(const name of ['10K Potans','100K Potansiyometre','1K Trimpot','1K Trimmer','1K Direnç','1K Potansiyometre düğmesi','1K Anahtarlı Potansiyometre','1K Stereo Potansiyometre 6 Pin','1K Sürgülü Potansiyometre','1K Dijital Potansiyometre','1K Çok Turlu Potansiyometre','1K 3W Potans','1K 50W Reosta Direnç Potansiyometre','1K Potansiyometre Modülü','B102 1K 12x2mm Lineer Potansiyometre']){
  const other=facts(name);assert.equal(matchesCatalogRequirement(source,other),false,name);
  assert.ok(variantConflict(source,other),name);
 }
 assert.ok(variantConflict(facts('A1K Potansiyometre'),facts('B1K Potansiyometre')));
 assert.ok(variantConflict(facts('1K Potansiyometre 15x6mm'),facts('1K Potansiyometre 20x6mm')));
 assert.ok(variantConflict(facts('1K Potansiyometre WH148'),facts('1K Potansiyometre WX118')));
 assert.equal(matchesCatalogRequirement(facts('B1K Potansiyometre'),source),false,'specified taper cannot be inferred from an unspecified title');
});

test('scoped introductory descriptions expand names without adopting mentioned components, reviews or related products',()=>{
 assert.equal(productRole(facts('1K Ayarlı Direnç','1K Potansiyometre: Mil çevrildikçe direnç değişir.')),'potentiometer-rotary');
 assert.equal(productRole(facts('1K Ayarlı Direnç','1K Trimpot: Tornavida ile ayarlanır.')),'potentiometer-trimpot');
 assert.equal(productRole(facts('1K Ayarlı Direnç','Benzer ürünler: 1K Potansiyometre')),'unknown');
 assert.equal(productRole(facts('1K Ayarlı Direnç','10K Potansiyometre: Mil çevrildikçe direnç değişir.')),'unknown');
 assert.ok(nameMatchScore(source,{name:'1K Ayarlı Direnç'})>=.65,'unread abbreviated sitemap item remains a discovery hint');
 assert.equal(matchesCatalogRequirement(source,{name:'1K Ayarlı Direnç'}),false,'a hint cannot prove the physical construction');
 assert.ok(!matchingName(facts('1K Direnç','1K Potansiyometre: Benzer üründür.')).includes('Potansiyometre'));
 assert.equal(productRole(facts('CH340G','CH340G USB to TTL UART Modülü. Seri iletişim için kullanılır.')),'usb-serial');
 assert.equal(productRole(facts('CH340G','CH340G Entegre. USB modüllerinde kullanılır.')),'bare-component');
 assert.equal(productRole(facts('CH340G','Arduino Nano CH340G geliştirme kartında kullanılan bir entegredir.')),'unknown');
 assert.equal(productRole(facts('LM2596','LM2596 Voltaj Regülatör Modülü: Ayarlanabilir güç devresi.')),'regulator');
 assert.equal(productRole(facts('LM2596 SMD Entegre','LM2596 Modül içinde kullanılan bileşendir.')),'bare-component');
 assert.equal(productRole(facts('CH340G','Benzer ürünler: CH340G USB TTL Modülü')),'unknown');
});

test('actual abbreviated source and expanded merchant titles share basket prices; incompatible old records never win',()=>{
 const target={...products[0],...source,id:'pot'};
 const offer={...demoOffers[0],canonical_product_id:target.id,source:'live',last_checked_at:new Date().toISOString(),last_error:null,stock_status:'in_stock',price_gross:780,unit_price:780,package_quantity:1,minimum_order_quantity:1,order_step:1};
 const valid={...offer,id:'motorobit',canonical_product_id:'other',title:'1K Potansiyometre',store_id:'motorobit'};
 const wrong={...offer,id:'bad',title:'1K Direnç',price_gross:1};
 const found=cartOffers([valid,wrong],[target],[target]);assert.equal(found.length,2);assert.ok(found.find(o=>o.id==='bad')?.variant_conflict);
 assert.equal(offerAvailability(found).price,780);
 const unconfirmed={...offer,id:'ambiguous',title:'1K Ayarlı Direnç',price_gross:1,specifications:'{}'};
 assert.ok(cartOffers([unconfirmed],[target],[target])[0].variant_conflict);
 assert.equal(offerAvailability(cartOffers([unconfirmed],[target],[target])).price,null);
 const namedOnly={...products[0],id:'converter',name:'CH340G',specifications:facts('CH340G','CH340G USB to TTL UART Modül.').specifications};
 const live={...offer,id:'intro',canonical_product_id:'foreign',title:'CH340G',specifications:facts('CH340G','CH340G USB to TTL UART Modül.').specifications};
 assert.equal(cartOffers([live],[namedOnly],[namedOnly])[0].variant_conflict,'');
});

test('source discovery reaches real cross-store 1K pages without fixed resistors or trimpots',()=>{
 const sources=catalogueSources(source,true);
 for(const store of ['direnc','motorobit','robotistan','robo90','komponentci','robotsepeti','robolink','robocombo','robotronik'])assert.ok(sources.some(row=>row.storeId===store),store);
 assert.ok(!sources.some(row=>/trimpot|10k|100k/.test(row.url)));
 assert.ok(index['candidate:potentiometer:1000:rotary'].length>=9);
});

test('product metadata can spell out abbreviated headings but never substitute another resistance value',()=>{
 const url='https://www.direnc.net/1k-potans';
 const page=(title:string)=>`<h1>1K Potans</h1><script type="application/ld+json">${JSON.stringify({'@type':'Product',url,name:title,description:'1K Potansiyomtre: Ayarlı direnç',offers:{price:6.97,priceCurrency:'TRY'}})}</script>`;
 assert.equal(parseProduct(page('1K Potansiyometre'),url).name,'1K Potans');
 assert.throws(()=>parseProduct(page('10K Potansiyometre'),url),/uyuşmuyor/);
 assert.doesNotThrow(()=>validateProductFacts(source.name,JSON.parse(source.specifications).description));
 assert.throws(()=>validateProductFacts('1K Potans','10K Potansiyometre: Ayarlı direnç'),/çelişiyor/);
 assert.throws(()=>validateProductFacts('1K Potans','1K Trimpot: Tornavida ile ayarlanır.'),/çelişiyor/);
 assert.throws(()=>validateProductFacts('1K Potans','1K Potansiyometre',[{name:'Direnç Değeri',value:'10K Ohm'}]),/çelişiyor/);
});
