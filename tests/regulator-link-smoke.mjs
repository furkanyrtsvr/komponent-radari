import assert from 'node:assert/strict';
const base=process.env.TEST_BASE_URL || 'http://localhost:5173',jar=new Map();
async function api(path,body){
 const response=await fetch(`${base}/api/${path}`,{method:body?'POST':'GET',headers:{'Content-Type':'application/json',Cookie:[...jar].map(([key,value])=>`${key}=${value}`).join('; ')},...(body?{body:JSON.stringify(body)}:{}),signal:AbortSignal.timeout(65000)});
 for(const cookie of response.headers.getSetCookie()){const [key,...value]=cookie.split(';')[0].split('=');jar.set(key,value.join('='));}
 const data=await response.json();assert.equal(response.status,200,JSON.stringify(data));return data;
}
const boot=await api('bootstrap');
const direnc='https://www.direnc.net/lm2596-power-suplay-modul-1',robotistan='https://www.robotistan.com/mini-ayarlanabilir-3a-voltaj-regulator-karti-lm2596-adj';
const started=performance.now();
const result=await api('url',{url:direnc,cartId:boot.cart.id,quantity:1,shippingEstimate:8000});
const mini=result.quotes.find(quote=>quote.url===robotistan);
assert.ok(mini,'The real Robotistan Mini board must appear in name-based results');
assert.equal(mini.nameMatch,true,'Different Mini version must be labeled as a name match');
assert.ok(result.quotes.filter(quote=>/cok-cikis|klemen|kleme|lm2577|segmentli|kablolu|5v-3a/.test(quote.url)).every(quote=>quote.nameMatch),'Different boards must retain a visible name-match label');
assert.ok(result.availability.some(offer=>offer.url===direnc && offer.status==='out_of_stock'));
assert.equal(result.cart.items.length,1,'Alternative versions are not automatically added');
const direct=await api('url',{url:robotistan,cartId:boot.cart.id,quantity:1,shippingEstimate:8000});
assert.notEqual(direct.product.id,result.product.id,'Name matches never merge catalog products');
assert.ok(direct.quotes.some(quote=>quote.url===robotistan && quote.productTotal>0));
const repeated=await api('url',{url:direnc,cartId:boot.cart.id,quantity:1,shippingEstimate:8000});
assert.ok(repeated.quotes.some(quote=>quote.url===robotistan && quote.nameMatch),'Cached alternate version remains visible');
console.log(JSON.stringify({passed:true,milliseconds:Math.round(performance.now()-started),source:{name:result.product.name,availability:result.availability},mini,originalQuotes:result.quotes.length,directQuotes:direct.quotes.length,cachedVariantVisible:true},null,2));
