import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {parseRobocomboProduct} from '../src/stores/robocombo';
import {parseSammProduct} from '../src/stores/samm';
const fixture=(name:string)=>readFileSync(new URL(`./fixtures/merchants/${name}.html`,import.meta.url),'utf8');
test('current Robocombo storefront reconciles its own selected variant rather than obsolete Ticimax markup',()=>{
 const html=fixture('robocombo-2026-10-20'),url='https://robocombo.com/ultrasonik-mesafe-sensoru-hc-sr04';
 const p=parseRobocomboProduct(html,url);assert.equal(p.price,4500);assert.equal(p.stockQuantity,994);assert.equal(p.quantityVerified,true);assert.equal(p.vatIncluded,true);
 assert.throws(()=>parseRobocomboProduct(html,url+'?vid=another-variant'),/varyant/);
 assert.throws(()=>parseRobocomboProduct(html.replace('Fiyatlarımıza KDV dahildir','Fiyat'),url),/KDV/);
});
test('SAMM quantity controls outside the title wrapper and out-of-stock items remain readable',()=>{
 const p=parseSammProduct(fixture('samm-2026-10-20'),'https://market.samm.com/220-ohm-direnc');
 assert.equal(p.price,198);assert.equal(p.quantityVerified,true);assert.equal(p.orderStep,1);
});
