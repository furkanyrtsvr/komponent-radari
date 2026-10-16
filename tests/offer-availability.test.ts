import test from 'node:test';
import assert from 'node:assert/strict';
import {offerAvailability} from '../src/lib/offer-availability';
import {demoOffers} from '../src/lib/catalog';
const at=Date.parse('2026-10-03T12:00:00Z');
const offer={...demoOffers[0],source:'live',price_gross:29059,package_quantity:1,minimum_order_quantity:1,order_step:1,price_tiers:'[]',stock_status:'in_stock',stock_quantity:null,last_error:null,last_checked_at:new Date(at-12*3600000).toISOString()};
test('XR2206 with dated stocked offers shows its previous price instead of claiming no offer',()=>{
 const state=offerAvailability([offer],1,{at});
 assert.equal(state.price,null);assert.equal(state.previousPrice,29059);assert.equal(state.label,'Güncelleme gerekli');
});
test('a newly collected B price is usable without retiming a record',()=>{
 const state=offerAvailability([{...offer,last_checked_at:new Date(at-3600000).toISOString(),snapshot_max_age_ms:43200000}],5,{at});
 assert.equal(state.price,145295);assert.equal(state.label,'Stokta');
});
test('future and expired observations never become a current checkout price',()=>{
 assert.equal(offerAvailability([{...offer,last_checked_at:new Date(at+1).toISOString()}],1,{at}).price,null);
 assert.equal(offerAvailability([{...offer,snapshot_max_age_ms:43200000}],1,{at}).price,null);
});
test('minimum sale pack stock is respected and distinguished from out of stock',()=>{
 const fresh={...offer,last_checked_at:new Date(at-1000).toISOString(),stock_quantity:2,minimum_order_quantity:5};
 assert.equal(offerAvailability([fresh],1,{at}).label,'Adet için stok yetersiz');
 assert.equal(offerAvailability([{...fresh,stock_status:'out_of_stock'}],1,{at}).label,'Stokta yok');
 assert.equal(offerAvailability([{...fresh,stock_status:'unknown'}],1,{at}).label,'Stok doğrulanamadı');
});
test('merchant filters and user exclusions are distinguishable from an uncollected product',()=>{
 assert.equal(offerAvailability([offer],1,{at,stores:[]}).label,'Filtre dışında');
 assert.equal(offerAvailability([{...offer,excluded:1}],1,{at}).label,'Filtre dışında');
 assert.equal(offerAvailability([],1,{at,refreshing:true}).label,'Kontrol ediliyor');
});
