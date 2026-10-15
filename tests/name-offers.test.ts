import test from 'node:test';
import assert from 'node:assert/strict';
import {nameMatchScore,nameCandidateKeys} from '../public/catalog/product-identity.js';
import {catalogueSources} from '../lib/catalog-sources';
import {cartOffers,type OfferSelection} from '../lib/cart-offers';
import {optimize} from '../lib/optimizer';
import {demoOffers as offers,products,storeCatalog as stores} from '../lib/catalog';
import {variantConflict} from '../lib/catalog-identity';
import {offerAvailability} from '../lib/offer-availability';
test('general name discovery recognizes unlisted models and spelling variants without merging identities',()=>{
 for(const [a,b] of [['TP5000 2A Pil Şarj Modülü','TP5000 4.2V/3.6V 1A LiPo Pil Şarj Modülü'],['TP 5000 pil kartı','TP5000red'],['XL4015 5A voltaj modülü','XL4015 DC DC kart'],['MAX98357 ses kartı','MAX98357A ses modülü'],['830 delikli breadboard beyaz','Beyaz 830 delikli breadboard']]){
  assert.ok(nameMatchScore({name:a},{name:b})>=0.65,`${a} / ${b}`);
 }
 assert.equal(nameMatchScore({name:'TP5000 pil şarj modülü'},{name:'TP4056 pil şarj modülü'}),0);
 assert.equal(nameMatchScore({name:'TP5000 pil şarj modülü'},{name:'L-KLS8-TP5000 PC TEST POINT MINIATURE'}),0);
 assert.ok(nameCandidateKeys({name:'TP5000 2A Pil Şarj Modülü'}).includes('name-model:tp5000'));
});
test('known different voltages, currents and bare ICs remain visible but cannot become a cheaper requested variant',()=>{
 for(const [a,b] of [['AMS1117 3.3V SOT223','AMS1117 5V SOT223'],['TP5000 2A Pil Şarj Modülü','TP5000 4.2V/3.6V 1A LiPo Pil Şarj Modülü'],['XR2206 Sinyal Jeneratör DIY Kit','XR2206 DIP16 Entegre'],['ESP32-CAM WiFi Bluetooth Geliştirme Kartı + OV5640 Kamera Modül','ESP-32S Kablosuz Modül Adaptörü']]){
  assert.ok(variantConflict({name:a},{name:b}),`${a} / ${b}`);
  const product={...products[0],id:'requested',name:a},foreign={...product,id:'foreign',name:b};
  const offer={...offers[0],id:'observed',canonical_product_id:foreign.id,title:b,source:'live',last_checked_at:new Date().toISOString(),last_error:null,stock_status:'in_stock'};
  const found=cartOffers([offer],[product,foreign],[product]);assert.equal(found.length,1);assert.ok(found[0].variant_conflict);assert.equal(found[0].match_type,'different_variant');assert.equal(offerAvailability(found).price,null);
 }
 assert.equal(variantConflict({name:'TP5000 Pil Şarj Modülü'},{name:'TP5000 1A Pil Şarj Modülü'}),'');
});
test('real basket false matches stay visible without becoming a requested fixed regulator or jumper cable',()=>{
 for(const [a,b] of [['AMS1117 3.3V SOT223','AMS1117 ADJ 1A - Ayarlanabilir Lineer Voltaj Regülatör SOT223'],['40 Adet Erkek-Erkek Jumper Kablo 20cm','Flat Kablo 20 Pin 1 Metre'],['LM2596 Ayarlanabilir Voltaj Düşürücü Güç Modülü','DC-DC Voltaj Yükseltici ve Düşürücü LM2577S / LM2596S Regülatör Kartı']]){
  assert.ok(variantConflict({name:a},{name:b}));
  const target={...products[0],id:'basket',name:a},other={...target,id:'merchant',name:b},offer={...offers[0],canonical_product_id:other.id,title:b,source:'live',last_checked_at:new Date().toISOString(),last_error:null,stock_status:'in_stock'};
  const found=cartOffers([offer],[target,other],[target]);
  // A cable length is a physical rating, not a fabricated shared "kablo20"
  // model. An unrelated flat cable need not appear in jumper discovery.
  assert.equal(found.length,b.startsWith('Flat Kablo')?0:1);if(found.length)assert.ok(found[0].variant_conflict);assert.equal(offerAvailability(found).price,null);
 }
});
test('name aliases cannot spend the same physical merchant stock twice',()=>{
 const product={...products[0],id:'p1',name:'TP5000 2A Pil Şarj Modülü'},other={...product,id:'p2',name:'TP5000 1A Pil Şarj Modülü'};
 const offer={...offers[0],id:'physical',canonical_product_id:'p2',title:other.name,stock_quantity:1,stock_status:'in_stock',source:'live',last_checked_at:new Date().toISOString(),last_error:null,price_gross:5000,package_quantity:1,minimum_order_quantity:1,order_step:1,price_tiers:'[]',match_type:'verified'};
 const items=[product,other].map(p=>({id:p.id,cart_id:'cart',canonical_product_id:p.id,quantity:1,added_by:'owner',notes:'',allow_alternative:0,preferred_manufacturer:'',maximum_unit_price:null,created_at:''}));
 assert.equal(optimize(items,cartOffers([offer],[product,other],[product,other]),stores,{exactOnly:false}).scenarios.length,0);
});
test('dated LM2596S/T chips cannot replace the complete regulator board even with a different model suffix',()=>{
 const target={...products[0],id:'module',name:'LM2596 Ayarlanabilir Voltaj Düşürücü Güç Modülü (4-35V Giriş - 1-30V Çıkış)'};
 for(const title of ['LM2596S-ADJ SMD DPAK-2 TO-263-5 Ayarlı Voltaj Regülatörü','LM2596T-12V TO220-5 Voltaj Regülatörü','LM2596S-ADJ (SMD) 3A Ayarlanbilir Voltaj Regülatörü D2PAK']){
  const foreign={...target,id:'ic',name:title},chip={...offers[0],id:'old-chip',canonical_product_id:'ic',title,source:'live',vat_included:1,last_error:null,stock_status:'in_stock',last_checked_at:'2026-10-03T00:00:00Z',price_gross:1800};
  const aliases=cartOffers([chip],[target,foreign],[target]);assert.equal(aliases.length,1);assert.ok(aliases[0].variant_conflict);assert.equal(offerAvailability(aliases,1,{allowLastKnown:true}).price,null);
 }
 assert.equal(variantConflict(target,{name:'Mini Ayarlanabilir 3A Voltaj Regülatör Kartı - LM2596-ADJ'}),'');
});
test('TP5000 discovery reaches the actual Komponentci link from the Robiz title',()=>{
 const sources=catalogueSources({name:'TP5000 2A Pil Şarj Modülü'},true);
 assert.ok(sources.some(source=>source.url==='https://www.komponentci.net/tp5000-42v-36v-1a-lipo-pil-sarj-modulu-pmu12438'));
});
test('offer removal persists per product and cart, changes totals and restores without changing catalog records',()=>{
 const product={...products[0],id:'target',name:'TP5000 2A Pil Şarj Modülü'};
 const foreign={...product,id:'foreign',name:'TP5000 Pil Şarj Modülü'};
 const base=offers[0];
 const rows=[{...base,id:'cheap',canonical_product_id:'foreign',title:foreign.name,source:'live',last_checked_at:new Date().toISOString(),last_error:null,stock_status:'in_stock',price_gross:5000,unit_price:5000,package_quantity:1,minimum_order_quantity:1,order_step:1,price_tiers:'[]',match_type:'verified'}, {...base,id:'expensive',canonical_product_id:'target',title:product.name,source:'live',last_checked_at:new Date().toISOString(),last_error:null,stock_status:'in_stock',price_gross:9000,unit_price:9000,package_quantity:1,minimum_order_quantity:1,order_step:1,price_tiers:'[]',match_type:'verified'}];
 const item={id:'item',cart_id:'cart',canonical_product_id:'target',quantity:2,added_by:'owner',notes:'',allow_alternative:0,preferred_manufacturer:'',maximum_unit_price:null,created_at:''};
 const calculate=(selections:OfferSelection[])=>{const expanded=cartOffers(rows,[product,foreign],[product],selections);return optimize([item],expanded.filter(offer=>!offer.excluded),stores,{exactOnly:false}).scenarios.at(-1)!;};
 const selected:OfferSelection={id:'decision',cart_id:'cart',canonical_product_id:'target',offer_id:'cheap',excluded:1,updated_at:''};
 assert.equal(calculate([]).groups[0].subtotal,10000);
 assert.equal(calculate([selected]).groups[0].subtotal,18000);
 assert.equal(calculate([{...selected,excluded:0}]).groups[0].subtotal,10000);
 assert.equal(rows[0].canonical_product_id,'foreign');assert.equal(rows[0].price_gross,5000);
 const other=cartOffers(rows,[product,foreign],[foreign],[selected]);assert.ok(!other.some(offer=>offer.excluded));
});
