import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {parseHobidevreProduct} from '../src/stores/woocommerce';
const html=readFileSync('tests/fixtures/failed19/hobidevre-max7219.html','utf8'),api=JSON.parse(readFileSync('tests/fixtures/failed19/hobidevre-max7219-api.json','utf8'));
const url='https://www.hobidevre.com/urun/8x8-dotmatrix-modulu-max7219/';
test('same MAX7219 SKU may use an encoded dimensional multiplication sign without losing price or stock validation',()=>{
 for(const sku of ['MOD-MAX7219-8&#215;8','MOD-MAX7219-8×8','MOD-MAX7219-8&times;8','MOD-MAX7219-8&#xD7;8','MOD-MAX7219-8x8']){
  const p=parseHobidevreProduct(html,url,{...api,sku});assert.equal(p.price,9792);assert.equal(p.stockStatus,'out_of_stock');assert.equal(p.quantityVerified,true);assert.equal(p.orderStep,1);assert.ok(p.image);
 }
});
test('SKU encoding correction still rejects different dimensions, another chip, mismatched ID and altered visible/API price',()=>{
 for(const change of [{sku:'MOD-MAX7219-8&#215;9'},{sku:'MOD-MAX7221-8&#215;8'},{sku:'MOD-MAX7219-88'},{id:6744},{prices:{...api.prices,price:'9692'}}])assert.throws(()=>parseHobidevreProduct(html,url,{...api,...change}));
});
