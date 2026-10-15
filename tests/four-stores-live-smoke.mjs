import assert from 'node:assert/strict';
const base=process.env.TEST_BASE_URL || 'http://localhost:5173';
const jar=new Map();
async function api(path,method='GET',body){
 const response=await fetch(`${base}/api/${path}`,{method,headers:{'Content-Type':'application/json',Cookie:[...jar].map(([k,v])=>`${k}=${v}`).join('; ')},...(body?{body:JSON.stringify(body)}:{}),signal:AbortSignal.timeout(65000)});
 for(const cookie of response.headers.getSetCookie()){const[k,...v]=cookie.split(';')[0].split('=');jar.set(k,v.join('='));}
 const data=await response.json();assert.equal(response.status,200,JSON.stringify(data));return data;
}
const urls={robotzade:'https://www.robotzade.com/urun/hc-sr04-ultrasonik-sensor',robitshop:'https://www.robitshop.com/urun/ultrasonik-mesafe-sensoru-hc-sr04',robocombo:'https://www.robocombo.com/Ultrasonik-Mesafe-Sensoru-HC-SR04,PR-1041.html',robotronik:'https://www.robotronik.com.tr/ultrasonik-sensor-hc-sr04-a0170'};
const started=performance.now(),boot=await api('bootstrap');
assert.equal(boot.stores.length,14);
for(const id of Object.keys(urls))assert.ok(boot.stores.some(s=>s.id===id && s.enabled),id);
const result=await api('url','POST',{url:urls.robotzade,cartId:boot.cart.id,quantity:2});
if(!result.verified)assert.match(result.message,/canlı fiyatı şu anda alınamadı/);
const offers=await api(`carts/${boot.cart.id}/offers/${result.product.id}`);
const summary=[];
for(const[id,url]of Object.entries(urls)){
 const offer=offers.find(o=>o.store_id===id && o.product_url===url);
 if(!offer && ['robotzade','robitshop'].includes(id)){summary.push({store:id,price:null,stock:'unavailable'});continue;}
 assert.ok(offer,`${id}: ${JSON.stringify({availability:result.availability,refresh:result.refreshSummary})}`);
 assert.ok(offer.price_gross>0);assert.equal(offer.vat_included,1);assert.equal(offer.source,'live');assert.equal(offer.last_error,null);
 if(offer.stock_status==='in_stock')assert.ok(result.quotes.some(q=>q.url===url && q.productTotal===offer.price_gross*2),id);
 else assert.ok(!result.quotes.some(q=>q.url===url),`${id}: unavailable products cannot be purchased`);
 summary.push({store:id,price:offer.price_gross/100,stock:offer.stock_status});
}
assert.ok(new Set(summary.filter(s=>s.price!==null).map(s=>s.price)).size>=2,'available merchant prices must remain independent');
const robit=await api('url','POST',{url:urls.robitshop,cartId:boot.cart.id,quantity:1});
assert.ok(robit.cart.items.length>=2);assert.ok(robit.quotes.some(q=>q.storeId==='robocombo'));if(!robit.verified)assert.match(robit.message,/canlı fiyatı şu anda alınamadı/);
// New stores use the same cart shipping panel and unrestricted 14-store filter.
await api(`carts/${boot.cart.id}/shipping`,'PUT',{storeId:'robotzade',shippingPrice:2300,freeShippingThreshold:10000});
const optimization=await api(`carts/${boot.cart.id}/optimize`,'POST',{selectedStores:boot.stores.map(s=>s.id),maxStores:14,exactOnly:false});
assert.ok(optimization.scenarios.length);
const cart=await api(`carts/${boot.cart.id}`);assert.ok(cart.shippingSettings.some(s=>s.store_id==='robotzade'));
console.log(JSON.stringify({passed:true,milliseconds:Math.round(performance.now()-started),stores:boot.stores.length,compared:summary,cartAndShipping:true},null,2));
