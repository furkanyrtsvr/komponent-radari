import index from '../src/lib/generated/catalog-matches';
import test from 'node:test';
import assert from 'node:assert/strict';
import {productIdentity as identity,candidateKey,isAccessory} from '../public/catalog/product-identity.js';
import {isRetryableStoreError,StoreReadError} from '../src/stores/base';
import {readFile} from 'node:fs/promises';
import {matchesCatalogRequirement,canMergeCatalogProducts} from '../src/lib/catalog-identity';
const key=(name:string)=>identity({name});
test('accessory guard applies to sensors, servos, modules, boards and cables',()=>{
 for(const [product,accessory] of [
  ['SG90 servo motor','SG90 servo motor tutucu'],['MG90S servo motor','MG90S servo motor dişli seti'],
  ['MG996R servo motor','MG996R robot kol aparatı'],['DHT11 sensör modülü','DHT11 için bağlantı kablosu'],
  ['DS18B20 sıcaklık sensörü','DS18B20 sensör tutucu'],['L298N motor sürücü modülü','L298N modül için kutu'],
  ['Arduino Uno R3','Arduino Uno R3 muhafazası'],['40pin 20cm erkek erkek jumper kablo','40pin 20cm erkek erkek jumper kablo tutucu']]) {
  assert.ok(isAccessory(accessory),accessory);assert.notEqual(key(product),key(accessory));
 }
});
test('servo rotation and gearbox replacement cannot enter the positional motor group',()=>{
 const standard=key('SG90 Mikro Servo Motor');
 for(const name of ['Tower Pro SG90 RC Mini Servo Motor - 9g','SG90 Servo Motor - 180 Derece'])assert.equal(key(name),standard);
 for(const name of ['SG90 Servo Motor - 360 Derece','Micro Servo 9g SG90 - Sürekli Dönebilen','SG90 Servo Motor Pan Tilt 2 Eksen'])assert.notEqual(key(name),standard);
 assert.notEqual(key('MG996R Servo 180 derece'),key('MG996R Servo 360 derece'));
 assert.notEqual(key('MG996R Servo 180 derece'),key('MG996R Servo 270 derece'));
 assert.notEqual(key('MG90S Servo Motor'),key('SG90 Servo Motor'));
 assert.notEqual(key('Littelfuse SG90'),standard);
});
test('camera sensor, board version and included programmer remain distinct',()=>{
 const basic=key('ESP32-CAM WiFi Bluetooth Geliştirme Kartı + OV2640 Kamera Modül');
 assert.equal(basic,key('ESP32 CAM ESP32 bazlı kamera board OV2640 kamera'));
 for(const name of ['ESP32-CAM WiFi Bluetooth Geliştirme Kartı + OV5640 Kamera Modül','ESP32-CAM kartı OV3660 kamera','ESP32 CAM OV2640 kamera ve ESP-CAM-MB adaptor dahil','ESP32 CAM MB USB Modülü CH340C','ESP32 S3 OV2640 kamera geliştirme kartı'])assert.notEqual(key(name),basic,name);
});
test('regulator voltage, IC versus module and footprint are preserved across naming',()=>{
 const ic=key('AMS1117 3.3V SOT223');
 assert.equal(ic,key('AMS1117 3V3 SOT-223 voltaj regülatörü'));
 for(const other of ['AMS1117 5V SOT223','AMS1117 3.3V SOT89','AMS1117 3.3V Regülatör Modülü','AMS1117ADJ SOT223'])assert.notEqual(key(other),ic);
 assert.equal(candidateKey({name:'AMS1117 3.3V SOT223'}),candidateKey({name:'AMS1117 33V SMD voltaj regülatörü'}));
});
test('passives normalize electrical units while retaining power, tolerance, mounting and dielectric',()=>{
 const resistor=key('1KΩ 1/4W THT Direnç · tolerans belirtilmemiş');
 assert.equal(resistor,key('1000 ohm 0.25W direnç'));
 for(const other of ['1K 1/2W direnç','1K 1/4W %1 direnç','1K 1/4W 0805 SMD direnç','10K 1/4W direnç'])assert.notEqual(resistor,key(other));
 assert.equal(key('100nF 50V seramik kondansatör'),key('0.1uF 50V seramik kondansatör'));
 assert.notEqual(key('100nF 50V seramik kondansatör'),key('100nF 25V seramik kondansatör'));
});
test('new sensor and driver families preserve model variants',()=>{
 assert.equal(key('DHT11 dijital sıcaklık ve nem sensör modülü'),key('DHT11 Sensör Modülü'));
 for(const [a,b] of [['DHT11 Sensör Modülü','DHT22 Sensör Modülü'],['DS3231 RTC Modülü','DS1307 RTC Modülü'],['L298N Motor Sürücü Modülü','L293D Motor Sürücü Modülü'],['BME280 sensör','BMP280 sensör']])assert.notEqual(key(a),key(b));
});

test('generic IC requirements accept extra ratings without discarding specified voltage or footprint',()=>{
 const generic={name:'AMS1117 3.3V SOT223'};
 const rated={name:'AMS1117 3.3V 1A SOT223'};
 assert.ok(matchesCatalogRequirement(generic,rated));
 assert.equal(matchesCatalogRequirement(rated,generic),false);
 assert.equal(canMergeCatalogProducts(generic,rated),false);
 for(const name of ['AMS1117 5V 1A SOT223','AMS1117 3.3V 1A SOT89','AMS1117 3.3V 1A','AMS1117 3.3V Regülatör Modülü'])
  assert.equal(matchesCatalogRequirement(generic,{name}),false,name);
 assert.equal(matchesCatalogRequirement({...generic,manufacturer:'TI'},{...rated,manufacturer:'ST'}),false);
});
test('transient network failures differ from price, identity and permission failures',()=>{
 assert.ok(isRetryableStoreError(new StoreReadError('HTTP 503')));
 assert.ok(isRetryableStoreError(new DOMException('timeout','TimeoutError')));
 for(const error of [new Error('Fiyatlar uyuşmuyor'),new Error('Ürün modeli eşleşmiyor'),new StoreReadError('HTTP 403',false)])assert.equal(isRetryableStoreError(error),false);
});
test('rebuilt servo index never contains 360-degree products, pan tilt or unrelated components',async()=>{
 const entries=index[key('SG90 Mikro Servo Motor')];
 assert.ok(entries.length>=5);
 for(const source of entries)assert.equal(key(source.name),key('SG90 Mikro Servo Motor'),source.url);
 assert.ok(!entries.some((s:{name:string})=>/360|pan tilt|littelfuse/i.test(s.name)));
});
