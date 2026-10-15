import assert from 'node:assert/strict';
const base=process.env.TEST_BASE_URL || 'http://localhost:5173';
function client(){const jar=new Map();return async(path,method='GET',body,status=200)=>{const response=await fetch(`${base}/api/${path}`,{method,headers:{'Content-Type':'application/json',Cookie:[...jar].map(([k,v])=>`${k}=${v}`).join('; ')},...(body?{body:JSON.stringify(body)}:{}),signal:AbortSignal.timeout(65000)});for(const cookie of response.headers.getSetCookie()){const [key,...value]=cookie.split(';')[0].split('=');jar.set(key,value.join('='));}const data=await response.json();assert.equal(response.status,status,JSON.stringify(data));return data;};}
const api=client(),outsider=client(),boot=await api('bootstrap');
const url='https://robiz.net/battery/tp5000red',komponentci=process.env.NAME_MATCH_URL || 'https://www.komponentci.net/tp5000-42v-36v-1a-lipo-pil-sarj-modulu-pmu12438';
const started=performance.now(),result=await api('url','POST',{url,cartId:boot.cart.id,quantity:1});
const quote=result.quotes.find(quote=>quote.url===komponentci);
assert.ok(quote,'Komponentci TP5000 must be shown for the Robiz link: '+JSON.stringify({product:result.product.name,quotes:result.quotes,availability:result.availability,summary:result.refreshSummary}));assert.ok(quote.productTotal>0);assert.equal(quote.nameMatch,true);
const path=`carts/${boot.cart.id}/offer-selection`,body={productId:result.product.id,offerId:quote.originalOfferId,excluded:true};
await outsider('bootstrap');await outsider(path,'PUT',body,403);
const share=await api(`carts/${boot.cart.id}/share`,'POST',{role:'viewer'});await outsider('share/'+share.url.split('/').pop(),'POST',{});await outsider(path,'PUT',body,403);
await api(path,'PUT',body);
const persisted=await api(`carts/${boot.cart.id}/offers/${result.product.id}`);assert.ok(persisted.find(offer=>offer.original_offer_id===quote.originalOfferId)?.excluded);
const shared=await outsider(`carts/${boot.cart.id}`);assert.ok(shared.offerSelections.some(row=>row.offer_id===quote.originalOfferId && row.excluded));
const optimization=await api(`carts/${boot.cart.id}/optimize`,'POST',{exactOnly:false});assert.ok(optimization.scenarios.every(s=>s.groups.every(g=>g.lines.every(line=>line.offerId!==quote.offerId))));
await api(path,'PUT',{...body,excluded:false});
const restored=await api(`carts/${boot.cart.id}/offers/${result.product.id}`);assert.ok(!restored.find(offer=>offer.original_offer_id===quote.originalOfferId)?.excluded);
const direct=await api('url','POST',{url:komponentci,cartId:boot.cart.id,quantity:1});assert.notEqual(direct.product.id,result.product.id,'Different ratings keep their own canonical product');
console.log(JSON.stringify({passed:true,milliseconds:Math.round(performance.now()-started),quotes:result.quotes.map(q=>({store:q.store,title:q.title,price:q.productTotal,nameMatch:q.nameMatch})),removedPersistently:true,sharedCart:true,viewerCannotEdit:true,restored:true},null,2));
