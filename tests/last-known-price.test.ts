import test from 'node:test';
import assert from 'node:assert/strict';
import {demoOffers,storeCatalog} from '../lib/catalog';
import {hasObservedPrice} from '../lib/pricing';
import {offerAvailability} from '../lib/offer-availability';
import {optimize} from '../lib/optimizer';
import {linkQuotes} from '../lib/link-quotes';
import {distinctScenarios} from '../lib/scenario-display';
import type {Scenario} from '../lib/domain';
const old={...demoOffers[0],source:'live',vat_included:1,stock_status:'in_stock',stock_quantity:10,price_gross:1000,package_quantity:1,minimum_order_quantity:1,order_step:1,price_tiers:'[]',last_error:null,last_checked_at:new Date(Date.now()-2*3600000).toISOString()};
const item={id:'i',cart_id:'test',canonical_product_id:old.canonical_product_id,quantity:2,added_by:'test',notes:'',allow_alternative:0,preferred_manufacturer:'',maximum_unit_price:null,created_at:''};
test('an expired real stocked price is usable by request without changing its observation date',()=>{
 const state=offerAvailability([old],2,{allowLastKnown:true});
 assert.equal(state.price,2000);assert.equal(state.label,'Son alınan fiyat');assert.equal(state.offer?.last_checked_at,old.last_checked_at);
 assert.equal(offerAvailability([old],2).price,null);
});
test('future, invalid, rejected and different variant observations cannot be historical checkout prices',()=>{
 for(const changes of [{last_checked_at:new Date(Date.now()+60000).toISOString()},{last_checked_at:'invalid'},{last_error:'different model'},{variant_conflict:'different voltage'},{excluded:1},{price_gross:0},{currency:'USD'},{vat_included:0}])assert.equal(hasObservedPrice({...old,...changes}),false);
});
test('historical stock ceilings and out of stock evidence still block purchase',()=>{
 for(const changes of [{stock_quantity:1},{stock_status:'out_of_stock'},{stock_status:'unknown'}])assert.equal(offerAvailability([{...old,...changes}],2,{allowLastKnown:true}).price,null);
});
test('requested historical prices participate in basket shipping math; strict mode still excludes them',()=>{
 const store=storeCatalog.find(s=>s.id===old.store_id)!;
 assert.equal(optimize([item],[old],[store]).scenarios.length,0);
 const result=optimize([item],[old],[store],{allowLastKnown:true});
 assert.equal(result.scenarios[0].productTotal,2000);assert.equal(result.scenarios[0].total,2000+store.shipping_base_price);
 assert.equal(result.eligibleOffers?.[0].last_checked_at,old.last_checked_at);
 assert.equal(optimize([item],[{...old,variant_conflict:'different model',match_type:'different_variant'}],[store],{allowLastKnown:true}).scenarios.length,0);
});
test('link comparisons expose the original checked date for a historical price, including restored exclusions',()=>{
 assert.equal(linkQuotes([old],storeCatalog,2).length,0);
 const quotes=linkQuotes([old],storeCatalog,2,false,true);
 assert.equal(quotes[0].productTotal,2000);assert.equal(quotes[0].checkedAt,old.last_checked_at);assert.equal(quotes[0].lastKnown,true);
 assert.equal(linkQuotes([{...old,excluded:1}],storeCatalog,2,false,true).length,0);
 assert.equal(linkQuotes([{...old,excluded:1}],storeCatalog,2,true,true).length,1);
});
test('four and fourteen merchant caps with equal totals become one card; a cheaper fifth remains',()=>{
 const scenario=(maxStores:number,storeCount:number,total:number)=>({maxStores,storeCount,total,productTotal:total,shippingTotal:0,groups:[],savings:0} as Scenario);
 const plans=[scenario(3,3,3000),scenario(4,4,2500),scenario(5,5,2400),scenario(14,5,2400)];
 assert.deepEqual(distinctScenarios(plans).map(s=>s.maxStores),[3,4,5]);
 assert.deepEqual(distinctScenarios([scenario(14,4,2500),scenario(4,4,2500),scenario(5,5,2500)]).map(s=>s.maxStores),[4]);
});
