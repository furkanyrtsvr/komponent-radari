import test from "node:test";
import assert from "node:assert/strict";
import {decodeHtml,parsePrice,parseProduct} from "../stores/base";
import {verifiedShippingRule,SHIPPING_TTL_MS} from "../lib/shipping";
import {optimize} from "../lib/optimizer";
import {storeCatalog,demoOffers} from "../lib/catalog";
import type {CartItem} from "../lib/domain";
import {catalogueSources} from "../lib/catalog-sources";
import {matchesCatalogRequirement} from "../lib/catalog-identity";
import {isFresh} from "../lib/pricing";

test("merchant money formats preserve English and Turkish decimals and reject placeholders",()=>{
  for(const input of ["1.234,56 TL","1,234.56 TRY",1234.56,"₺ 1 234,56"]) assert.equal(parsePrice(input),123456);
  assert.equal(parsePrice("1.234 TL"),123400);
  assert.equal(parsePrice("12.4744"),1247);
  for(const input of ["TL","{{ P.price_sell_with_vat }}","12 TL / 20 TL",-1]) assert.equal(parsePrice(input),null);
});
test("Turkish single-byte pages decode titles without corrupting matching",()=>{
  const bytes=new Uint8Array([0x44,0x69,0xfe,0x69,0x20,0xd6,0x6c,0xe7,0xfc]);
  assert.equal(decodeHtml(bytes,"text/html; Charset=ISO-8859-9"),"Dişi Ölçü");
  assert.equal(decodeHtml(new TextEncoder().encode("Erkek-Dişi"),"text/html; charset=utf-8"),"Erkek-Dişi");
});
test("ambiguous multi-offer JSON-LD never chooses an unrelated cheap price",()=>{
  const node={"@type":"Product",name:"HC-SR04 Mesafe Sensörü",url:"/sensor",offers:[{url:"/accessory",price:1,priceCurrency:"TRY"},{url:"/sensor",price:52.92,priceCurrency:"TRY"}]};
  const html=`<h1>${node.name}</h1><script type="application/ld+json">${JSON.stringify(node)}</script>`;
  assert.equal(parseProduct(html,"https://www.direnc.net/sensor").price,5292);
  delete (node.offers[1] as {url?:string}).url;
  assert.equal(parseProduct(`<h1>${node.name}</h1><script type="application/ld+json">${JSON.stringify(node)}</script>`,"https://www.direnc.net/sensor").price,null);
});
test("shipping thresholds expire and malformed or foreign rules stay unknown",()=>{
  const at=Date.now(),row={last_updated:new Date(at-1000).toISOString(),rules:JSON.stringify({source:"live",source_url:"https://www.direnc.net/odeme-ve-teslimat",free_shipping_threshold:150000})};
  assert.equal(verifiedShippingRule(row,"www.direnc.net",at)?.free_shipping_threshold,150000);
  assert.equal(verifiedShippingRule(row,"www.direnc.net",at+SHIPPING_TTL_MS),null);
  assert.equal(verifiedShippingRule({...row,rules:"broken"},"www.direnc.net",at),null);
  assert.equal(verifiedShippingRule(row,"www.robotistan.com",at),null);
  assert.equal(verifiedShippingRule({...row,last_updated:new Date(at+1000).toISOString()},"www.direnc.net",at),null);
});
test("passive discovery reaches the matching voltage before the merchant candidate cap",()=>{
  const product={name:"100uF 25V elektrolitik kondansatör"};
  const sources=catalogueSources(product);
  for(const storeId of ["komponentci","motorobit"]){
    const candidates=sources.filter(source=>source.storeId===storeId);
    assert.ok(candidates.length<=4);
    assert.ok(candidates.some(source=>matchesCatalogRequirement(product,{name:source.name})),storeId);
    assert.ok(matchesCatalogRequirement(product,{name:candidates[0].name}),storeId);
  }
});
test("future or invalid price timestamps cannot be treated as freshly verified",()=>{
  const offer={...demoOffers[0],source:"live" as const,last_error:"",last_checked_at:new Date(Date.now()+60000).toISOString()};
  assert.equal(isFresh(offer),false);
  assert.equal(isFresh({...offer,last_checked_at:"invalid"}),false);
  assert.equal(isFresh({...offer,last_checked_at:new Date().toISOString()}),true);
});
test("selected offer remains available when the shipping threshold favors a higher price",()=>{
  const item:CartItem={id:"item",cart_id:"cart",canonical_product_id:"sensor",quantity:1,added_by:"a",notes:"",allow_alternative:0,preferred_manufacturer:"",maximum_unit_price:null,created_at:""};
  const store={...storeCatalog[0],id:"store",shipping_base_price:3000,free_shipping_threshold:10000};
  const offers=[8000,10000].map(price=>({...demoOffers[0],id:String(price),canonical_product_id:"sensor",store_id:"store",price_gross:price,package_quantity:1,minimum_order_quantity:1,order_step:1,stock_quantity:null,product_url:`https://www.direnc.net/${price}`}));
  const result=optimize([item],offers,[store]);
  assert.equal(result.scenarios[0].total,10000);
  assert.equal(result.scenarios[0].groups[0].lines[0].offerId,"10000");
  assert.equal(result.eligibleOffers?.find(offer=>offer.id==="10000")?.product_url,"https://www.direnc.net/10000");
});
