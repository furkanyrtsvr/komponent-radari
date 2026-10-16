import test from 'node:test';
import assert from 'node:assert/strict';
import {optimize} from '../src/lib/optimizer';
import {demoOffers,storeCatalog} from '../src/lib/catalog';
import type {CartItem,Offer,Store} from '../src/lib/domain';
const item=(id:string):CartItem=>({id,cart_id:'audit',canonical_product_id:id,quantity:1,added_by:'audit',notes:'',allow_alternative:0,preferred_manufacturer:'',maximum_unit_price:null,created_at:''});
const store=(id:string,shipping=8000,threshold:number|null=null):Store=>({...storeCatalog[0],id,enabled:1,shipping_base_price:shipping,free_shipping_threshold:threshold});
const offer=(product:string,merchant:string,cost:number):Offer=>({...demoOffers[0],id:product+'-'+merchant,canonical_product_id:product,store_id:merchant,price_gross:cost,package_quantity:1,unit_price:cost,stock_quantity:null,product_url:`https://${merchant}.test/${product}`});
test('the screenshot basket independently costs 1893.07 with two stores and 1962.54 with exactly three',()=>{
 const costs:Record<string,Record<string,number>>={
  ams:{robotistan:2090},res:{direnc:1700,robotistan:2400},camera:{direnc:84270,robotistan:93318},xr:{direnc:29059,robiz:41160,motorobit:63000},
  hc:{direnc:17436,robotistan:18807,robo90:15876,robiz:24696,motorobit:20700,robolink:16200},
  mpu:{direnc:25572,robotistan:38210,robo90:35280,robotsepeti:32512,motorobit:48000,robolink:38700},
  cable:{direnc:4940,robotistan:5732,robo90:4116,komponentci:3887,robotsepeti:6021,motorobit:5100,robolink:5550},servo:{robotistan:16240,robo90:17640}};
 const ps=Object.keys(costs),ss=['direnc','robotistan','robo90','robiz','komponentci','robotsepeti','motorobit','robolink'].map(s=>store(s,8000,['direnc','robotistan','robo90'].includes(s)?150000:null));
 const os=ps.flatMap(p=>Object.entries(costs[p]).map(([s,c])=>offer(p,s,c)));
 // Full Cartesian enumeration uses no optimizer functions or quantity helper.
 const exact=new Map<number,number>();
 function enumerate(depth:number,subtotals:Map<string,number>){
  if(depth===ps.length){let total=0;for(const [s,v]of subtotals){const merchant=ss.find(x=>x.id===s)!;total+=v+(merchant.free_shipping_threshold!==null && v>=merchant.free_shipping_threshold?0:merchant.shipping_base_price);}exact.set(subtotals.size,Math.min(exact.get(subtotals.size)??Infinity,total));return;}
  for(const [s,c]of Object.entries(costs[ps[depth]])){const next=new Map(subtotals);next.set(s,(next.get(s)||0)+c);enumerate(depth+1,next);}
 }
 enumerate(0,new Map());
 const r=optimize(ps.map(item),os,ss,{timeLimitMs:10000});
 assert.equal(exact.get(2),189307);assert.equal(exact.get(3),196254);
 for(const scenario of r.exactScenarios!)assert.equal(scenario.total,exact.get(scenario.storeCount));
 assert.equal(r.scenarios.find(s=>s.maxStores===3)!.storeCount,2);
 assert.equal(r.exactScenarios!.find(s=>s.storeCount===3)!.storeCount,3);
});
test('a third store becomes the recommendation when product savings exceed its shipping',()=>{
 const r=optimize(['a','b','c'].map(item),[offer('a','x',10000),offer('b','y',10000),offer('c','x',20000),offer('c','z',1000)],['x','y','z'].map(s=>store(s,1000)));
 assert.equal(r.scenarios.find(s=>s.maxStores===2)!.storeCount,2);
 assert.equal(r.scenarios.find(s=>s.maxStores===3)!.storeCount,3);
 assert.ok(r.scenarios.find(s=>s.maxStores===3)!.total<r.scenarios.find(s=>s.maxStores===2)!.total);
 assert.equal(r.recommendedMax,3);
});
test('identical offers in different orders produce the same chosen plan',()=>{
 const os=[offer('a','x',100),offer('a','y',100),offer('b','x',200),offer('b','y',200)];
 const ss=[store('x',0),store('y',0)];
 const chosen=(rows:Offer[])=>optimize(['b','a'].map(item),rows,ss).scenarios.map(s=>s.groups.map(g=>({store:g.storeId,offers:g.lines.map(l=>l.offerId)})));
 assert.deepEqual(chosen(os),chosen([...os].reverse()));
});
