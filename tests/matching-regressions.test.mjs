import test from 'node:test';
import assert from 'node:assert/strict';
import {productIdentity as identity,candidateKey,isAccessory,queryMatchesCatalogTitle as search,searchableText,matchBucket} from '../public/catalog/product-identity.js';
const key=name=>identity({name});
test('A4988 coolers and CNC shields are accessories, not motor drivers',()=>{
 for(const name of ['Mini Soğutucu (A4988 ile Uyumlu)','Arduino Uno CNC Shield A4988 Uyumlu','A4988 heat sink']) {
  assert.ok(isAccessory(name));assert.notEqual(key(name),key('A4988 Step Motor Sürücü'));
 }
 assert.equal(isAccessory('A4988 Step Motor Sürücü Soğutucu Dahil'),false);
});
test('multiple sensor models do not collapse into the first sensor',()=>{
 assert.notEqual(key('MPU6050 HMC5883L BMP180 10DOF Sensör Kartı'),key('MPU6050 İvme ve Gyro Sensör Kartı'));
 assert.notEqual(key('Gravity 10DOF AHRS IMU BNO055 BMP280'),key('BMP280 basınç sensörü'));
 assert.equal(key('MPU6050 HMC5883L BMP180 10DOF Sensör Kartı'),key('BMP180 HMC5883L MPU6050 10DOF Sensör Kartı'));
});
test('DS18B20 bare chip, module, waterproof probe and cable lengths are distinct',()=>{
 const probe=key('DS18B20 Su Geçirmez Isı Sensörü 1 Metre');
 assert.equal(probe,key('1 meter waterproof DS18B20 temperature sensor'));
 for(const name of ['DS18B20 Su Geçirmez Isı Sensörü 3 Metre','DS18B20 Su Geçirmez Isı Sensörü 5 Metre','DS18B20 TO92','DS18B20 sensör modülü','DS18B20 Su Geçirmez Isı Sensörü'])assert.notEqual(key(name),probe,name);
});
test('board maker, ecosystem, WiFi and USB connector survive identity',()=>{
 const generic=key('BME280 I2C SPI sensör');
 for(const name of ['Adafruit BME280 I2C SPI sensör','SparkFun BME280 Breakout','Grove BME280 sensör'])assert.notEqual(key(name),generic);
 assert.notEqual(key('DHT11 ile WiFi Sensör Modülü'),key('DHT11 Sensör Modülü'));
 assert.notEqual(key('ESP32 WROOM CH340 WiFi Modülü Type C'),key('ESP32 WROOM CH340 WiFi Modülü Micro USB'));
 assert.equal(key('ESP32 WROOM CH340 WiFi Modülü Type C'),key('ESP32 WROOM CH340 WiFi Modülü USB C'));
});
test('equivalent original Arduino names merge; revision and clone facts do not',()=>{
 const uno=key('Orjinal Arduino Uno R3');
 for(const name of ['Arduino Uno R3 Orijinal','Orijinal Arduino Uno R 3','Orjinal Arduino Uno R3 Yeni Versiyon'])assert.equal(key(name),uno,name);
 for(const name of ['Arduino Uno R3 Klon','Arduino Uno R4 WiFi Orijinal','Arduino Uno R3 SMD Orijinal','Arduino Uno R3 Orijinal USB Kablo Dahil'])assert.notEqual(key(name),uno,name);
 assert.notEqual(key('Arduino Nano 328 FT232RL Klon'),key('Arduino Nano CH340 Klon'));
 assert.notEqual(key('Arduino Nano Orijinal'),key('Arduino Nano Every Orijinal'));
});
test('query units normalize without matching substrings of other component values',()=>{
 assert.ok(search('1k direnç','1000 ohm direnç'));
 assert.ok(search('100nF kondansatör','0.1uF kondansatör'));
 assert.ok(search('hcsr04','hc sr04 ultrasonik mesafe sensörü'));
 assert.ok(search('HC-SR04','hcsr04'));
 assert.ok(search('ESP32 3.3V','ESP32 3V3 geliştirme kartı'));
 assert.equal(search('1k','51k 14w direnç 10 adet'),false);
 assert.equal(search('1k','1k8 direnç'),false);
 assert.equal(search('ESP32 3.3V','ESP32 33V geliştirme kartı'),false);
 assert.equal(search('ESP32 30 pin','ESP32 130 pin geliştirme kartı'),false);
});
test('jumper pin/adet and length aliases work with an individual-store filter',()=>{
 const query='40pin 20cm erkek erkek jumper kablo';
 assert.ok(search(query,'40 adet erkek erkek jumper 20cm'));
 assert.ok(search(query,'40 Pin Ayrılabilen Erkek-Erkek M-M Jumper Kablo-200 mm'));
 for(const other of ['40 adet erkek dişi jumper 20cm','20 adet erkek erkek jumper 20cm','40 adet erkek erkek jumper 10cm'])assert.equal(search(query,other),false);
 assert.equal(key('40 pin 20 cm erkek erkek jumper kablosu'),key('40 adet erkek erkek jumper 200mm'));
});
test('lossy resistor titles can be discovered but cannot prove equality',()=>{
 assert.ok(search('1k 1/4W direnç','1k 14w direnc'));
 assert.ok(search('1k 1/4W direnç','1k direnc 1 4 w'));
 assert.notEqual(key('1k 1/4W direnç'),key('1k 14w direnc'));
 assert.equal(candidateKey({name:'1k 1/4W direnç'}),candidateKey({name:'1k 14w direnc'}));
});
test('existing servo, camera, HC-SR04 and AMS1117 identity guarantees remain valid',()=>{
 const servo=key('SG90 Mikro Servo Motor');
 assert.equal(servo,key('Tower Pro SG90 RC Mini Servo Motor - 9g'));
 assert.equal(servo,key('SG90 Servo Motor - 180 Derece'));
 for(const name of ['SG90 Servo Motor 360 Derece','SG90 Servo Motor Pan Tilt 2 Eksen','SG90 5 adet'])assert.notEqual(servo,key(name));
 const camera=key('ESP32-CAM WiFi Bluetooth Geliştirme Kartı + OV2640 Kamera Modül');
 assert.equal(camera,key('ESP32 CAM ESP32 bazlı kamera board OV2640 kamera'));
 assert.notEqual(camera,key('ESP32 CAM OV5640 Kamera Modül'));
 assert.equal(key('AMS1117 3.3V SOT223'),key('AMS1117 3V3 SOT-223 voltaj regülatörü'));
 assert.equal(key('1KΩ 1/4W THT Direnç'),key('1000 ohm 0.25W direnç'));
 assert.equal(key('100nF 50V seramik kondansatör'),key('0.1uF 50V seramik kondansatör'));
});
test('worker search enforces numerical boundaries and resolves counterparts',async()=>{
 const names=['40 adet erkek erkek jumper 20cm','51k 14w direnc','ESP32 33V geliştirme kartı','hc sr04 ultrasonik mesafe sensörü','40 pin 200 mm M-M jumper kablo'];
 const sources=names.map((name,i)=>({name,storeId:i===4?'s1':'s0',url:`https://s${i===4?1:0}.test/item/${i}`,sourceCategory:''}));
 const manifest={stores:[{id:'s0',base:'https://s0.test',chunks:[{key:'s0.json',group:'Kablolar'}]},{id:'s1',base:'https://s1.test',chunks:[{key:'s1.json',group:'Diğer'}]}]};
 const index={};
 for(const source of sources){const key=identity(source);(index[key]||=[]).push(source);}
 const originalFetch=globalThis.fetch,originalSelf=globalThis.self;
 let complete;
 const worker={currentRequest:0,postMessage:message=>{if(message.done)complete(message)}};
 globalThis.self=worker;
 globalThis.fetch=async input=>{
  const path=String(input);
  const value=path.endsWith('manifest.json')?manifest:path.includes('/matches/')?index:path.endsWith('s0.json')?names.slice(0,4).map((name,i)=>[`/item/${i}`,name,'']):[['/item/4',names[4],'']];
  return new Response(JSON.stringify(value));
 };
 try {
  await import('../public/catalog/search-worker.js');
  const run=(query,store='all')=>new Promise(resolve=>{complete=resolve;worker.onmessage({data:{requestId:++worker.currentRequest,query,store,group:'all'}})});
  const cable=await run('40pin 20cm erkek erkek jumper kablo');
  assert.equal(cable.results.length,1);assert.equal(cable.results[0].sources.length,2);
  const store=await run('40pin 20cm erkek erkek jumper kablo','s0');
  assert.equal(store.results.length,1);assert.equal(store.results[0].sources.length,1);
  for(const query of ['1k','ESP32 3.3V'])assert.equal((await run(query)).results.length,0);
  assert.equal((await run('hcsr04')).results.length,1);
 } finally{globalThis.fetch=originalFetch;globalThis.self=originalSelf;}
});
