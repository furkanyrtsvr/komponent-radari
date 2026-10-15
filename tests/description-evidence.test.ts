import test from 'node:test';
import assert from 'node:assert/strict';
import {productEvidence,matchingName,nameMatchScore,nameCandidateKeys} from '../public/catalog/product-identity.js';
import {variantConflict,matchesCatalogRequirement,catalogIdentity} from '../lib/catalog-identity';
import {productRole} from '../lib/product-role';
import {cartOffers} from '../lib/cart-offers';
import {products,demoOffers} from '../lib/catalog';
import {offerAvailability} from '../lib/offer-availability';
import {validateProductFacts} from '../stores/validate-product-facts';
import {parseProduct} from '../stores/base';
const facts=(name:string,description:string,properties:object[]=[])=>({name,specifications:JSON.stringify({description,properties})});
const examples=[
 ['LM2596 Reg.','LM2596 Ayarlanabilir Voltaj Regülatör Modülü','regulator'],
 ['HC-SR04 Mesafe Sensr','HC-SR04 Ultrasonik Mesafe Sensörü Modülü','sensor'],
 ['TP4056 Şarj Mdl.','TP4056 Pil Şarj Modülü','charger'],
 ['L298N Motor Sür.','L298N Motor Sürücü Modülü','motor-driver'],
 ['NE555 Zamanlayıc Enteg.','NE555 DIP8 Zamanlayıcı Entegre','bare-component'],
 ['100nF Ser. Kond.','100nF 50V Seramik Kondansatör','capacitor'],
 ['1K Rezist.','1K 1/4W THT Metal Film Direnç','resistor'],
 ['10K Termisör','10K NTC Termistör','thermistor'],
 ['10uH İndük.','10uH Inductor Bobin','inductor'],
 ['5mm Kırmzi LED','5mm Kırmızı LED','led'],
 ['2.54mm Konn.','2.54mm 3 Pin Erkek Konnektör','connector'],
 ['16MHz Kristl','16MHz Kristal','crystal'],
 ['250mA Sigrt.','250mA Cam Sigorta','fuse'],
 ['DS18B20 Su Geçirmez Sensr','DS18B20 Su Geçirmez Sıcaklık Sensörü Probu','sensor-probe'],
 ['2N3904 Transist.','2N3904 NPN Transistör TO92','transistor'],
 ['1N4148 Diyot.','1N4148 Sinyal Diyot','diode'],
] as const;
test('own descriptions recover abbreviated and misspelled names across sixteen different electronic product types',()=>{
 for(const [title,reference,role] of examples){
  const a=facts(title,`<h2>${reference}</h2><p>Bu ürün farklı projelerde kullanılabilir.</p>`),b=facts(reference,reference);
  const evidence=productEvidence(a);assert.ok(evidence.descriptionConfirmed,title);assert.equal(evidence.descriptionName,reference,title);
  assert.equal(productRole(a),role,title);assert.ok(nameMatchScore(a,b)>=.65,title);assert.equal(variantConflict(a,b),'',title);
  assert.ok(nameCandidateKeys(a).some(key=>nameCandidateKeys(b).includes(key)),title);
 }
});
test('missing titles may be completed from plain introductory names as well as genuine scoped headings',()=>{
 for(const [title,reference] of examples){const p=facts(title,reference+'. Ürünün teknik detayları aşağıdadır.');assert.ok(productEvidence(p).descriptionConfirmed,title);assert.ok(nameMatchScore(p,{name:reference})>=.65,title);}
});
test('model and numeric anchors are exact; prose, accessories and recommended products cannot repair a different model',()=>{
 assert.ok(nameCandidateKeys(facts('TSOP2238 Sensr','TSOP2238 Kızılötesi Sensör Modülü')).includes('name-model:tsop2238'));
 for(const [title,desc] of [
  ['LM2595 Reg.','LM2596 Voltaj Regülatör Modülü'],
  ['100nF Ser. Kond.','10nF Seramik Kondansatör'],
  ['1K Rezist.','10K 1/4W Direnç'],
  ['CH340G','Arduino Nano CH340G geliştirme kartında kullanılan bir entegredir.'],
  ['HC-SR04','Benzer Ürünler: HC-SR04 Mesafe Sensörü Modülü'],
  ['LM2596 SMD Entegre','LM2596 Modüllerde kullanılan entegredir.'],
  ['1K Direnç','1K Potansiyometre'],
  ['2N3904 Transist.','2N3906 NPN Transistör'],
  ['1N4148 Diyot','1N4007 Diyot'],
  ['LM2596 Reg.','LM2596 NE555 Regülatör Modülü'],
 ])assert.equal(matchingName(facts(title,desc)),title,`${title} / ${desc}`);
});
test('merchant technical tables protect electrical values, packages, mounting and connectors across categories',()=>{
 for(const [name,label,a,b] of [
  ['100nF Seramik Kondansatör','Capacitance','100nF','10nF'],
  ['10uH Bobin','Inductance','10uH','100uH'],
  ['1K Direnç','Resistance','1K','10K'],
  ['LM2596 Regülatör Modülü','Output Voltage','5V','12V'],
  ['NE555 Entegre','Package / Case','DIP8','SOIC8'],
  ['2.54mm Konnektör','Pin Count','3','6'],
  ['2.54mm Konnektör','Mounting Type','THT','SMD'],
  ['CH340G USB UART Modülü','Connector Type','USB Type C','Micro USB'],
 ])assert.ok(variantConflict(facts(name,name,[{name:label,value:a}]),facts(name,name,[{name:label,value:b}])),label);
 const same=variantConflict(facts('100nF Kondansatör','100nF Kondansatör',[{name:'Capacitance',value:'100nF'}]),facts('100nF Kondansatör','100nF Kondansatör',[{name:'Capacitance',value:'0.1uF'}]));assert.equal(same,'');
});
test('the same rating does not admit another LED color, connector gender, size, voltage or electrical construction',()=>{
 for(const [a,b] of [
  ['5mm Kırmızı LED','5mm Mavi LED'],['5mm Kırmızı LED','3mm Kırmızı LED'],
  ['2.54mm 3 Pin Erkek Konnektör','2.54mm 3 Pin Dişi Konnektör'],
  ['2.54mm 3 Pin Erkek Konnektör','2.54mm 6 Pin Erkek Konnektör'],
  ['1K 1/4W Direnç','1K 1/2W Direnç'],['100nF 50V Seramik Kondansatör','100nF 100V Seramik Kondansatör'],
 ])assert.ok(variantConflict({name:a},{name:b}),`${a} / ${b}`);
 assert.equal(nameMatchScore({name:'2N3904 NPN Transistör'},{name:'2N3906 NPN Transistör'}),0);
 assert.ok(variantConflict({name:'2N3904 NPN Transistör'},{name:'2N3906 NPN Transistör'}));
});
test('product reading uses the own description for abbreviated page titles and rejects conflicting merchant tables',()=>{
 const url='https://www.direnc.net/short-product';
 for(const [title,reference] of examples){
  const html=`<h1>${title}</h1><script type="application/ld+json">${JSON.stringify({'@type':'Product',url,name:reference,description:`<h2>${reference}</h2>`,offers:{price:19.99,priceCurrency:'TRY'}})}</script>`;
  assert.equal(parseProduct(html,url).name,title,title);
 }
 for(const [name,label,value] of [['100nF Kondansatör','Capacitance','10nF'],['1K Direnç','Resistance','10K'],['10uH Bobin','Inductance','100uH'],['5mm Kırmızı LED','Color','Blue'],['2.54mm 3 Pin Konnektör','Pin Count','6']])assert.throws(()=>validateProductFacts(name,name,[{name:label,value}]),/çelişiyor/,name);
});
test('basket uses every merchant own description and blocks a shared-title component with different authoritative metadata',()=>{
 const target={...products[0],id:'description-target',...facts('CH340G','CH340G USB to TTL UART Modülü.')};
 const quote={...demoOffers[0],source:'live',last_checked_at:new Date().toISOString(),last_error:null,stock_status:'in_stock',canonical_product_id:'foreign',title:'CH340G',specifications:facts('CH340G','CH340G USB to TTL UART Modülü.').specifications,price_gross:8500,unit_price:8500,minimum_order_quantity:1,order_step:1,package_quantity:1};
 const bad={...quote,id:'wrong',specifications:facts('CH340G','CH340G SMD SO16 Entegre.').specifications,price_gross:100};
 const rows=cartOffers([quote,bad],[target],[target]);assert.equal(rows.length,2);assert.ok(rows.find(row=>row.id.startsWith('wrong'))?.variant_conflict);assert.equal(offerAvailability(rows).price,8500);
 const cap=facts('100nF Ser. Kond.','100nF 50V Seramik Kondansatör.');assert.equal(catalogIdentity(cap),catalogIdentity({name:'100nF 50V Seramik Kondansatör'}));assert.ok(matchesCatalogRequirement(cap,{name:'100nF 50V Seramik Kondansatör'}));
});
test('a shared controller does not turn dedicated relay, driver or charger boards into development boards',()=>{
 for(const [name,role] of [['ESP32 WiFi Bluetooth 2 Kanal Röle Kartı','relay-module'],['STM32 4 Kanal Motor Sürücü Kartı','motor-driver'],['RP2040 Pil Şarj Modülü','charger']]){
  assert.equal(productRole({name}),role);assert.ok(variantConflict({name},{name:name.split(' ')[0]+' Geliştirme Kartı'}),name);
 }
 assert.ok(variantConflict({name:'ESP32 2 Kanal Röle Kartı'},{name:'ESP32 1 Kanal Röle Kartı'}));
 assert.equal(variantConflict({name:'ESP32 2 Kanal Röle Kartı'},{name:'ESP32 2 Kanal Relay Board'}),'');
});
