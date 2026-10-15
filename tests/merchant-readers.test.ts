import test from "node:test";
import assert from "node:assert/strict";
import {parseRobizProduct} from "../stores/robiz";
import {parseTsoftProduct as parseScopedTsoftProduct} from "../stores/tsoft";
const parseTsoftProduct=(html:string,url:string)=>parseScopedTsoftProduct(`<div id="product-right">${html}</div>`,url);
import {parseKomponentciProduct} from "../stores/komponentci";
import {parseMotorobitProduct} from "../stores/motorobit";
const cable="40 Pin Erkek-Erkek Jumper Kablo 20cm";
const ld=(name:string,price:string)=>`<h1>${name}</h1><script type="application/ld+json">${JSON.stringify({'@type':'Product',name,offers:{price,priceCurrency:'TRY',availability:'https://schema.org/InStock'}})}</script>`;
test("Robiz gross price survives unrelated net VAT labels, with its explicit volume tier",()=>{
 const p=parseRobizProduct(ld('XR2206 Sinyal Jeneratör DIY Kit','411.60')+'<div class="product-price">411,60TL</div><div class="product-tax">343,00TL + KDV</div><div class="product-discount">10 adet ve üzeri 349,86TL</div><input id="product-quantity" data-minimum="1"><p>Related item KDV Hariç</p>','https://robiz.net/xr2206');
 assert.equal(p.vatIncluded,true); assert.equal(p.priceNet,34300); assert.equal(p.quantityVerified,true);
 assert.deepEqual(p.priceTiers,[{minimum:10,maximum:null,price:34986}]);
});
test("T-Soft excludes a template placeholder and reconciles the main gross and net amounts",()=>{
 const p=parseTsoftProduct(ld(cable,'55.50')+'<div class="product-price">{{ P.price_sell_with_vat }} TL</div><span>46.25 TL + KDV</span><div class="mainPrices"><span class="product-price">55,50</span></div><input id="ProductCount1" type="number" min="1" step="1">','https://www.robolinkmarket.com/cable');
 assert.equal(p.price,5550);assert.equal(p.priceNet,4625);assert.equal(p.quantityVerified,true);
});
test("Robot Sepeti uses payable VAT-inclusive 60.21 instead of net JSON-LD 50.17",()=>{
 const p=parseTsoftProduct(ld(cable,'50.17')+'<div class="mainPrices"><span class="product-price-not-vat">50,17</span> + KDV <span class="product-price">60,21</span> (KDV Dahil)</div><input type="number" id="Adet2770" min="1">','https://www.robotsepeti.com/cable');
 assert.equal(p.price,6021);assert.equal(p.packageQuantity,1);assert.equal(p.orderStep,1);
});
test("Komponentci validates its cable set controls and fails on an inconsistent gross price",()=>{
 const fixture='<div id="PM_urun_detayi">'+ld(cable,'38.87')+'<table><tr><td>KDV Dahil</td><td><div class="urun_kdvdahil_fiyati">38,87 TL</div></td></tr></table><input id="urun_min_miktar" value="1"><label for="urun_miktar_secenekleri">Adet</label><input id="urun_miktar_secenekleri" value="1"></div>';
 assert.equal(parseKomponentciProduct(fixture,'https://www.komponentci.net/cable').packageQuantity,1);
 assert.throws(()=>parseKomponentciProduct(fixture.replace('38,87 TL','39,87 TL'),'https://www.komponentci.net/cable'));
});
test("Motorobit never takes a related product price or controls",()=>{
 const payload={id:'2',name:cable,url:'/different',currency_target:'TL',sale_price:1,total_sale_price:1.2,vat:20,available:true,quantity:10};
 const escaped=JSON.stringify(payload).replaceAll('"','\\"');
 const fixture=ld(cable,'1')+`<script>PRODUCT_DATA.push(JSON.parse('${escaped}'));</script><script>console.log({"P":{"ID":"2","URL":"/different","STOCK_INCREMENT":1,"MIN_SALE_COUNT":"1"}})</script>`;
 assert.throws(()=>parseMotorobitProduct(fixture,'https://www.motorobit.com/cable'),/doğrulanamadı/);
});
