import index from '../src/lib/generated/catalog-matches';
import test from "node:test";
import assert from "node:assert/strict";
import { catalogIdentity, canMergeCatalogProducts } from "../src/lib/catalog-identity";
import { productIdentity, searchableText, matchBucket } from "../public/catalog/product-identity.js";
import { parseProduct } from "../src/stores/base";
import { readFile } from "node:fs/promises";
const key = (name:string) => catalogIdentity({name});
test("HC-SR04 sensor identity excludes holders, display modules and multi-packs", () => {
 const sensor=key("HC-SR04 Mesafe Sensörü");
 for(const name of ["HC-SR04 Arduino ultrasonik mesafe sensörü","hcsr04","Ultrasonik Sensör HC-SR04","HC-SR04 Sensör Modülü"]) assert.equal(key(name),sensor,name);
 for(const name of ["HC-SR04 ultrasonic mesafe sensörü tutucu şeffaf","HC-SR04 sensör tutucu aparatı","HC-SR04 mesafe sensörü dijital gösterge","HC-SR04 ultrasonik sensör mesafe ölçüm modülü","HC-SR04 5 adet"]) assert.notEqual(key(name),sensor,name);
});
test("server index discovers Robo90 HC-SR04 for a basket without a prior merchant import", async () => {
 const sources=index[key('HC-SR04 Mesafe Sensörü')];
 assert.ok(sources.some((s:{url:string})=>s.url==='https://www.robo90.com/hc-sr04-ultrasonik-mesafe-sensoru'));
 assert.ok(sources.length>=6);
 for(const source of sources) assert.equal(key(source.name),key('HC-SR04 Mesafe Sensörü'));
 assert.ok(!sources.some((s:{url:string})=>/tutucu|gosterge|olcum-modulu/.test(s.url)));
});

test("new stores are discoverable for the same HC-SR04 sensor without confusing holders",async()=>{
 const sources=index[key('HC-SR04 Mesafe Sensörü')];
 for(const storeId of ['robotzade','robitshop','robocombo','robotronik'])assert.ok(sources.some((s:{storeId:string})=>s.storeId===storeId),storeId);
 for(const source of sources)assert.ok(!/tutucu|gosterge|olcum-modulu/.test(source.url),source.url);
});
test("browse and import share identity and preserve cable length, count and connector type", () => {
  const name="40 Pin Ayrılabilen Erkek-Erkek M-M Jumper Kablo-200 mm";
  assert.equal(key(name),productIdentity({name}));
  assert.equal(key(name),key("40pin 20cm erkek erkek jumper kablo"));
  for (const other of ["40pin 10cm erkek erkek jumper kablo","20pin 20cm erkek erkek jumper kablo","40pin 20cm dişi dişi jumper kablo","40pin erkek erkek jumper kablo"])
    assert.notEqual(key(name),key(other));
});
test("model matching preserves board pin count, USB bridge, camera, package and IC footprint", () => {
  const pairs = [
    ["ESP32 30 pin CP2102 geliştirme kartı","ESP32 38 pin CP2102 geliştirme kartı"],
    ["ESP32 30 pin CP2102 geliştirme kartı","ESP32 30 pin CH340 geliştirme kartı"],
    ["ESP32 geliştirme kartı","ESP32 CAM kamera modülü"],
    ["NE555 DIP8 entegre","NE555 SOP8 entegre"],
    ["SG90 servo motor","SG90 servo motor 5 adet"],
    ["ESP32 3.3V geliştirme kartı","ESP32 3V geliştirme kartı"],
    ["XR2206","XR2206 Sinyal Jeneratör DIY Kit"],
  ];
  for (const [a,b] of pairs) assert.notEqual(key(a),key(b),`${a} / ${b}`);
});
test("equivalent cable queries normalize units and naming without demanding added synonyms", () => {
  const name=searchableText("40pin 20cm erkek erkek jumper kablo");
  assert.ok(searchableText("40 pin 200mm M-M jumper").split(" ").every(term=>name.includes(term)));
});
test("an IC with a different known manufacturer cannot be imported as the same exact part", () => {
 assert.equal(canMergeCatalogProducts({name:"NE555 DIP8 entegre",manufacturer:"Texas Instruments"},{name:"NE555 DIP8 entegre",manufacturer:"ST"}),false);
});
test("page photos and prices are selected from the requested product, not related products", () => {
  const item=(name:string,url:string,price:number)=>({"@type":"Product",name,url,image:{"@type":"ImageObject",url:`https://example.com/${name}.jpg`},offers:{price,priceCurrency:"TRY"}});
  const html=`<h1>Target</h1><script type="application/ld+json">${JSON.stringify([item("Related","https://example.com/related",999),item("Target","https://example.com/target",10)])}</script>`;
  const p=parseProduct(html,"https://example.com/target");
  assert.equal(p.name,"Target"); assert.equal(p.price,1000); assert.equal(p.image,"https://example.com/Target.jpg");
  assert.throws(()=>parseProduct(html.replace('<h1>Target</h1>','<h1>Unknown</h1>'),"https://example.com/unknown"));
});
test("published counterpart index includes seven cable stores independently of selected category", async () => {
  const identity=key("40pin 20cm erkek erkek jumper kablo");
  const bucket=JSON.parse(await readFile(new URL(`../public/catalog/matches/${matchBucket(identity)}.json`,import.meta.url),"utf8"));
  const stores=new Set(bucket[identity].map((source:{storeId:string})=>source.storeId));
  for (const store of ["motorobit","direnc","robotistan","robo90","robolink","komponentci","robotsepeti"]) assert.ok(stores.has(store),store);
  for (const source of bucket[identity]) assert.equal(key(source.name),identity);
});
