import test from "node:test";
import assert from "node:assert/strict";
import {applyDefaultShipping, defaultShipping} from "../src/lib/default-shipping";
import {applyCartShipping} from "../src/lib/cart-shipping";
import {storeCatalog, demoOffers} from "../src/lib/catalog";
import {linkQuotes} from "../src/lib/link-quotes";

test("all screenshot defaults appear on first use and custom cart values survive reset", () => {
  assert.equal(defaultShipping.length, 20);
  for (const [name, fee, threshold] of defaultShipping) {
    const original = {...storeCatalog[0], name, shipping_known:false};
    const store = applyDefaultShipping(original);
    assert.equal(store.shipping_base_price, fee * 100);
    assert.equal(store.free_shipping_threshold, threshold * 100);
    assert.equal(store.shipping_known, true);
    const rule = {id:"r", cart_id:"c", store_id:store.id,
      shipping_price:0, free_shipping_threshold:null, updated_at:""};
    const own = applyCartShipping([store], [rule])[0];
    assert.equal(own.shipping_base_price, 0);
    assert.equal(own.free_shipping_threshold, null);
    assert.equal(applyCartShipping([store], [])[0].shipping_base_price, fee * 100);
    assert.equal(original.shipping_known, false);
  }
  const unknown = {...storeCatalog[0], name:"Other store", shipping_known:false};
  assert.equal(applyDefaultShipping(unknown), unknown);
});

test("default fee is charged below the threshold and shipping is free at the threshold", () => {
  const store = applyDefaultShipping(storeCatalog[0]);
  const quote = {...demoOffers[0], store_id:store.id, source:"live",
    last_checked_at:new Date().toISOString(), last_error:null,
    package_quantity:1, minimum_order_quantity:1, order_step:1,
    price_tiers:"[]", stock_status:"in_stock", stock_quantity:null,
    price_gross:149999, price_net:149999};
  assert.equal(linkQuotes([quote], [store], 1)[0].shipping, 14400);
  assert.equal(linkQuotes([{...quote, price_gross:150000}], [store], 1)[0].shipping, 0);
});
