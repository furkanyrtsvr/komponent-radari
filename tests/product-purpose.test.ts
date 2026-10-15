import test from 'node:test';
import assert from 'node:assert/strict';
import {variantConflict,canMergeCatalogProducts} from '../lib/catalog-identity';
import {productRole} from '../lib/product-role';
import {cartOffers} from '../lib/cart-offers';
import {demoOffers,products} from '../lib/catalog';
import {offerAvailability} from '../lib/offer-availability';
import {parseProduct} from '../stores/base';
const different=[
 ['CH340G USB to TTL UART Modül','CH340G SMD USB Arabirimi, Arayüz Kontrolör'],
 ['CH340G USB to TTL UART Modül','CH340G IC-340 USB INTERFACE SO16'],
 ['CH340G USB to TTL UART Modül','Ch340e Usb Ic Msop10'],
 ['CH340G USB to TTL UART Modül','Arduino Nano Klon CH340'],
 ['CH340G USB to TTL UART Modül','ESP-32S CH340C WiFi Bluetooth Modülü Geliştirme Board'],
 ['CH340G USB to TTL UART Modül',"0.91 LCD Arduino Nano CH340"],
 ['CH340G USB to TTL UART Modül','NodeMCU V3 ESP-12S WiFi Bluetooth Geliştirme Kartı CH340 Dönüştürücü'],
 ['CH340G USB to TTL UART Modül','ESP32 Modül Type C CH340'],
 ['CP2102 USB TTL UART Modül','CP2102 QFN28 USB UART Entegre'],
 ['CP2102 USB TTL UART Modül','ESP32 CP2102 Geliştirme Kartı'],
 ['FT232RL USB Seri Dönüştürücü Modülü','FT232RL SSOP28 USB UART IC'],
 ['NE555 Sinyal Jeneratör Modülü','NE555 DIP8 Zamanlayıcı Entegre'],
 ['L298N Motor Sürücü Modülü','L298N Multiwatt15 Entegre'],
 ['TB6612FNG Motor Sürücü Kartı','TB6612FNG SSOP24 Entegre'],
 ['BMP280 Basınç Sensör Modülü','BMP280 LGA8 Entegre'],
 ['TP4056 Pil Şarj Modülü','TP4056 SOP8 Entegre'],
 ['LM2596 Voltaj Düşürücü Modülü','LM2596S SMD DPAK Entegre'],
 ['USB RS485 CH340 Dönüştürücü Modülü','USB TTL CH340 Dönüştürücü Modülü'],
 ['Arduino Nano Klon CH340','Arduino Uno R3 SMD CH340 Geliştirme Kartı'],
 ['Arduino Nano Klon CH340','ESP32 CH340 Geliştirme Kartı'],
 ['ESP32 CH340 Geliştirme Kartı','ESP8266 CH340 Geliştirme Kartı'],
 ['DS18B20 Sensör Modülü','DS18B20 Su Geçirmez Sıcaklık Sensör Probu'],
 ['Arduino Nano Klon CH340',"0.91 LCD'li Arduino Nano CH340"],
 ['TP4056 Korumalı Pil Şarj Modülü','TP4056 Korumasız Pil Şarj Modülü'],
 ['Arduino Nano CH340 USB Type C Klon','Arduino Nano CH340 Micro USB Klon'],
 ['XL6009 Voltaj Yükseltici Modül','XL6009 Voltaj Düşürücü Modül'],
 ['ADUM1201 Isolated UART Modül','ADUM1201 Non Isolated UART Modül'],
 ['CH340G USB to TTL UART Modül','ESP-01 ESP-01S WIFI modülü programcı adaptörü CH340'],
 ['CH340G USB to TTL UART Modül','CH340C USB to TTL UART Modül'],
 ['CP2102 USB TTL UART Modül','CP2104 USB TTL UART Modül'],
];
test('shared component numbers never equate different products across converters, drivers, sensors, chargers and development boards',()=>{
 for(const [name,other] of different){
  const a={name},b={name:other};assert.ok(variantConflict(a,b),`${name} / ${other}`);assert.ok(variantConflict(b,a));assert.equal(canMergeCatalogProducts(a,b),false);
 }
});
test('compatible merchant naming stays usable across the same product functions',()=>{
 for(const [name,other] of [
  ['CH340G USB to TTL UART Modül','USB to TTL UART CH340G Dönüştürücü Modülü'],
  ['CH340G USB to TTL UART Modül','CH340G USB TTL Seri Haberleşme Dönüştürücü Modül'],
  ['CP2102 USB TTL UART Modül','USB UART CP2102 Kartı'],
  ['LM2596 Voltaj Düşürücü Modülü','Mini Ayarlanabilir 3A LM2596 Voltaj Regülatör Kartı'],
  ['L298N Motor Sürücü Modülü','L298N Çift Motor Sürücü Kartı'],
  ['Arduino Nano Klon CH340','Arduino Nano CH340 Klon Geliştirme Kartı'],
 ])assert.equal(variantConflict({name},{name:other}),'',`${name} / ${other}`);
 assert.equal(productRole({name:'Arduino uyumlu CH340G USB TTL UART Modül'}),'usb-serial');
});
test('previously mislinked live offers are rechecked and cannot show up as a cheapest in-stock product',()=>{
 const product={...products[0],id:'converter',name:'CH340G USB to TTL UART Modül'};
 const wrong={...demoOffers[0],id:'incorrect-old-merge',canonical_product_id:product.id,title:'Arduino Nano Klon CH340',source:'live',last_error:null,last_checked_at:new Date().toISOString(),stock_status:'in_stock'};
 const [offer]=cartOffers([wrong],[product],[product]);assert.ok(offer.variant_conflict);assert.equal(offer.match_type,'different_variant');assert.equal(offerAvailability([offer]).price,null);
});
test('page title overrides an abbreviated URL/metadata name but contradictory product metadata is rejected',()=>{
 const url='https://robiz.net/comm/usbttlch340g',page=(title:string,name:string)=>`<h1>${title}</h1><script type="application/ld+json">${JSON.stringify({'@type':'Product',url,name,offers:{price:85.26,priceCurrency:'TRY',availability:'https://schema.org/InStock'}})}</script>`;
 assert.equal(parseProduct(page('CH340G USB to TTL UART Modül','CH340G UART Modül'),url).name,'CH340G USB to TTL UART Modül');
 assert.throws(()=>parseProduct(page('CH340G USB to TTL UART Modül','CH340G SMD Entegre'),url),/uyuşmuyor/);
});
test('only the declared merchant canonical address can explain an alternate price URL, never an unrelated or foreign offer',()=>{
 const url='https://robiz.net/comm/usbttlch340g',canonical='https://robiz.net/usbttlch340g',name='CH340G USB to TTL UART Modül';
 const html=(declared:string,offerUrl:string)=>`<link rel="canonical" href="${declared}"><h1>${name}</h1><script type="application/ld+json">${JSON.stringify({'@type':'Product',name,offers:{url:offerUrl,price:'85.26',priceCurrency:'TRY'}})}</script>`;
 assert.equal(parseProduct(html(canonical,canonical),url).price,8526);
 assert.equal(parseProduct(html(canonical,'https://robiz.net/another-product'),url).price,null);
 assert.equal(parseProduct(html('https://foreign.test/a','https://foreign.test/a'),url).price,null);
});
