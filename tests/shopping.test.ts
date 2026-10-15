import test from "node:test";
import assert from "node:assert/strict";
import {accountId} from "../lib/account";
import {applyCartShipping,type ShippingSetting} from "../lib/cart-shipping";
import {linkQuotes} from "../lib/link-quotes";
import {demoOffers,storeCatalog} from "../lib/catalog";
test("the same platform member has the same portable UUID, different members remain separate",async()=>{
  const a=await accountId("member-a"),b=await accountId("member-b");
  assert.equal(await accountId("member-a"),a);
  assert.notEqual(a,b);assert.match(a,/^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/);
});
test("cart shipping overrides honor zero fees, removed thresholds and preserve other carts and stores",()=>{
  const stores=storeCatalog.map(store=>({...store,shipping_known:false}));
  const rule:ShippingSetting={id:"r",cart_id:"cart-a",store_id:stores[0].id,shipping_price:0,free_shipping_threshold:null,updated_at:new Date().toISOString()};
  const own=applyCartShipping(stores,[rule],1234),other=applyCartShipping(stores,[],1234);
  assert.equal(own[0].shipping_base_price,0);assert.equal(own[0].free_shipping_threshold,null);assert.equal(own[0].shipping_known,true);
  assert.equal(own[1].shipping_base_price,1234);assert.equal(other[0].shipping_base_price,1234);assert.notEqual(stores[0].shipping_base_price,0);
});
test("link comparison selects the cheapest quantity and shipping total, excludes stale or insufficient stock",()=>{
  const offers=[0,1,2,3].map((i)=>({...demoOffers[0],id:`o${i}`,store_id:storeCatalog[i].id,source:"live",last_error:null,last_checked_at:new Date().toISOString(),price_gross:(i+1)*1000,price_net:(i+1)*1000,package_quantity:1,minimum_order_quantity:1,order_step:1,price_tiers:"[]",stock_status:"in_stock",stock_quantity:i===2?1:null}));
  offers[3].last_checked_at="2020-01-01T00:00:00Z";
  const stores=storeCatalog.map((store,i)=>({...store,shipping_base_price:i===0?9000:0,free_shipping_threshold:null,shipping_known:true}));
  const quotes=linkQuotes(offers,stores,2);
  assert.deepEqual(quotes.map(quote=>quote.offerId),["o1","o0"]);
  assert.equal(quotes[0].total,4000);assert.equal(quotes[1].total,11000);
  const free=linkQuotes(offers,stores.map((store,i)=>i===0?{...store,free_shipping_threshold:2000}:store),2);
  assert.equal(free[0].offerId,"o0");assert.equal(free[0].shipping,0);
});
