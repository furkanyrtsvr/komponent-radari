import test from 'node:test';
import assert from 'node:assert/strict';
import {demoOffers,storeCatalog} from '../src/lib/catalog';
import type {Offer,CartItem,Store} from '../src/lib/domain';
import {quoteOffer} from '../src/lib/pricing';
import {offerAvailability} from '../src/lib/offer-availability';
import {linkQuotes} from '../src/lib/link-quotes';
import {optimize} from '../src/lib/optimizer';

const offer=(changes:Partial<Offer>={}):Offer=>({...demoOffers[0],source:'live',price_gross:1000,vat_included:1,currency:'TRY',package_quantity:1,minimum_order_quantity:1,order_step:1,price_tiers:'[]',stock_status:'in_stock',stock_quantity:10000,last_error:null,last_checked_at:new Date().toISOString(),...changes});
const item=(id:string,quantity=1):CartItem=>({id,cart_id:'oracle',canonical_product_id:id,quantity,added_by:'test',notes:'',allow_alternative:0,preferred_manufacturer:'',maximum_unit_price:null,created_at:''});
function random(seed:number){return (limit:number)=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed%limit;};}

test('recent invalid money evidence cannot enter availability, historical labels, link totals or optimization',()=>{
 const base=offer(),need={...item(base.canonical_product_id),quantity:2};
 for(const changes of [{currency:'USD'},{vat_included:0},{price_gross:1.5},{price_gross:Number.MAX_SAFE_INTEGER+1},{price_gross:-1000},{price_gross:0},{price_gross:NaN},{price_gross:Infinity}]){
  const bad={...base,...changes};
  for(const allowLastKnown of [false,true]){
   const state=offerAvailability([bad],2,{allowLastKnown});
   assert.equal(state.price,null,JSON.stringify(changes));assert.equal(state.previousPrice,undefined);
   assert.equal(linkQuotes([bad],storeCatalog,2,false,allowLastKnown).length,0);
   assert.equal(optimize([need],[bad],storeCatalog,{allowLastKnown}).scenarios.length,0);
  }
 }
});

test('excluded or conflicting exact-match records cannot become basket candidates',()=>{
 const base=offer(),need=item(base.canonical_product_id);
 for(const changes of [{excluded:1},{variant_conflict:'5V yerine 12V'}])for(const allowLastKnown of [false,true]){
  assert.equal(optimize([need],[{...base,...changes}],storeCatalog,{allowLastKnown}).scenarios.length,0);
  assert.equal(offerAvailability([{...base,...changes}],1,{allowLastKnown}).price,null);
 }
});

test('2500 package, metre and MOQ calculations agree with a separately enumerated purchase oracle',()=>{
 const next=random(731);
 for(let i=0;i<2500;i++){
  const pack=next(12)+1,step=next(12)+1,min=next(80)+1,requested=next(100)+1,price=next(20000)+1;
  let units=Math.max(min,requested);while(units%pack||units%step)units++;
  const row=offer({package_quantity:pack,order_step:step,minimum_order_quantity:min,price_gross:price,unit_type:i%2?'metre':'adet'});
  assert.deepEqual(quoteOffer(row,requested),{packages:units/pack,purchasedQuantity:units,cost:units/pack*price});
 }
});

test('1500 VAT subtotal rounding calculations agree with integer arithmetic',()=>{
 const next=random(921);
 for(let i=0;i<1500;i++){
  const count=next(200)+1,micros=next(100000000)+1,rate=[0,100,1000,2000][next(4)];
  const net=(BigInt(micros)*BigInt(count)+BigInt(5000))/BigInt(10000);
  const gross=(net*BigInt(10000+rate)+BigInt(5000))/BigInt(10000);
  const row=offer({price_tiers:JSON.stringify([{minimum:1,maximum:null,price:100,rounding:'net-subtotal',netUnitPriceMicros:micros,vatBasisPoints:rate}])});
  assert.equal(quoteOffer(row,count).cost,Number(gross));
 }
});

test('180 small baskets match exhaustive independent shipping and stock enumeration',()=>{
 const next=random(538);
 for(let trial=0;trial<180;trial++){
  const stores:Store[]=Array.from({length:3},(_,i)=>({...storeCatalog[0],id:'s'+i,shipping_base_price:next(5000),free_shipping_threshold:next(2)?next(12000):null}));
  const needs=Array.from({length:4},(_,i)=>item('p'+i,next(5)+1));
  const rows=needs.flatMap(n=>stores.map(s=>offer({id:n.id+s.id,canonical_product_id:n.id,store_id:s.id,price_gross:next(2000)+1,package_quantity:next(4)+1,order_step:1,stock_quantity:next(12)})));
  const best=[Infinity,Infinity,Infinity,Infinity];
  function enumerate(depth:number,sums:number[]){
   if(depth===needs.length){const used=sums.filter(Boolean).length;const total=sums.reduce((n,sum,i)=>n+sum+(sum&&(stores[i].free_shipping_threshold===null||sum<stores[i].free_shipping_threshold!)?stores[i].shipping_base_price:0),0);for(let cap=used;cap<=3;cap++)best[cap]=Math.min(best[cap],total);return;}
   const need=needs[depth];for(let si=0;si<3;si++){
    const row=rows.find(o=>o.canonical_product_id===need.id&&o.store_id===stores[si].id)!;
    let units=need.quantity;while(units%row.package_quantity)units++;
    if(units>row.stock_quantity!)continue;
    const copy=[...sums];copy[si]+=units/row.package_quantity*row.price_gross;enumerate(depth+1,copy);
   }
  }
  enumerate(0,[0,0,0]);const result=optimize(needs,rows,stores);assert.equal(result.optimal,true);
  for(let cap=1;cap<=3;cap++){const actual=result.scenarios.find(s=>s.maxStores===cap);assert.equal(actual?.total??Infinity,best[cap],`trial ${trial}, cap ${cap}`);if(actual){assert.equal(actual.productTotal+actual.shippingTotal,actual.total);assert.equal(actual.groups.reduce((n,g)=>n+g.lines.reduce((m,l)=>m+l.total,0),0),actual.productTotal);}}
 }
});

test('stock boundaries apply after complete package rounding for every consumer',()=>{
 const base=offer({package_quantity:10,minimum_order_quantity:10,order_step:10});
 for(const stock of [19,20]){
  const row={...base,stock_quantity:stock},expected=stock===20;
  assert.equal(offerAvailability([row],11).price!==null,expected);
  assert.equal(linkQuotes([row],storeCatalog,11).length>0,expected);
  assert.equal(optimize([{...item(row.canonical_product_id),quantity:11}],[row],storeCatalog).scenarios.length>0,expected);
 }
});
