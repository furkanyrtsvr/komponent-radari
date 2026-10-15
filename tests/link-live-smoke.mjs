import assert from 'node:assert/strict';
const base=process.env.TEST_BASE_URL || 'http://localhost:5173',jar=new Map();
async function request(path,method='GET',body){
  const response=await fetch(base+'/api/'+path,{method,headers:{Cookie:[...jar].map(([key,value])=>key+'='+value).join('; '),'Content-Type':'application/json'},...(body?{body:JSON.stringify(body)}:{}),signal:AbortSignal.timeout(65000)});
  for(const cookie of response.headers.getSetCookie()){const [key,...value]=cookie.split(';')[0].split('=');jar.set(key,value.join('='));}
  const data=await response.json();assert.equal(response.status,200,JSON.stringify(data));return data;
}
const boot=await request('bootstrap');
const started=performance.now();
const result=await request('url','POST',{url:process.env.TEST_PRODUCT_URL || 'https://www.direnc.net/arduino-ultrasonic-sensor-hc-sr04',cartId:boot.cart.id,quantity:3,shippingEstimate:8000});
assert.ok(result.cart.items.some(item=>item.canonical_product_id===result.product.id && item.quantity===3));
assert.ok(result.quotes.length>=3,'Expected verified counterparts in at least 3 merchants');
assert.ok(result.quotes.every(quote=>quote.total===quote.productTotal+quote.shipping));
assert.ok(result.quotes.every((quote,i,rows)=>i===0 || rows[i-1].total<=quote.total));
const latest=await request(`carts/${boot.cart.id}`);assert.equal(latest.items.length,result.cart.items.length);
console.log(JSON.stringify({passed:true,milliseconds:Math.round(performance.now()-started),product:result.product.name,quantity:3,cartItems:latest.items.length,quotes:result.quotes.map(quote=>({store:quote.store,products:quote.productTotal,shipping:quote.shipping,total:quote.total})),refresh:result.refreshSummary},null,2));
