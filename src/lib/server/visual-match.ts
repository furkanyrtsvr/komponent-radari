import {fingerprintImage,compareFingerprints,type VisualFingerprint,type VisualMatch} from '../visual-match';
import type {Product,Offer,Store} from '../domain';
const cdnHosts=new Set(['platincdn.com','robotistan.witcdn.net','cdn.myikas.com','static.ticimax.cloud','motorobit.witcdn.net','witcdn.robolinkmarket.com','cdn.ozdisan.com']);
const cache=new Map<string,{at:number;fingerprint:VisualFingerprint|null}>();
export function safeImageUrl(raw:string,stores:Pick<Store,'domain'>[]){
 try{const u=new URL(raw);return u.protocol==='https:'&&!u.username&&!u.password&&(!u.port||u.port==='443')&&(cdnHosts.has(u.hostname)||stores.some(s=>s.domain.replace(/^www\./,'')===u.hostname.replace(/^www\./,'')))?u:null;}catch{return null;}
}
async function imageFingerprint(raw:string|null,stores:Store[],signal:AbortSignal){
 if(!raw)return null;const url=safeImageUrl(raw,stores);if(!url)return null;
 const cached=cache.get(url.href);if(cached&&Date.now()-cached.at<60*60*1000)return cached.fingerprint;
 try{
  let address=url,response:Response|undefined;
  // Validate every catalog/CDN normalization redirect before following it.
  
  for(let hop=0;hop<=3;hop++){
   signal.throwIfAborted();response=await fetch(address,{redirect:'manual',signal,headers:{Accept:'image/jpeg,image/png'}});
   if(response.status<300||response.status>=400)break;
   const location=response.headers.get('location'),next=location?safeImageUrl(new URL(location,address).href,stores):null;
   if(!next||hop===3){await response.body?.cancel();return null;}
   await response.body?.cancel();address=next;
  }
  if(!response)return null;
  if(!response.ok||Number(response.headers.get('content-length'))>1_000_000||!/^image\/(?:jpeg|png)/i.test(response.headers.get('content-type')||'')){console.warn('Product photo request unavailable:',response.status,response.headers.get('content-type'));return null;}
  const reader=response.body?.getReader();if(!reader)return null;
  const chunks:Uint8Array[]=[];let size=0;
  while(true){signal.throwIfAborted();const part=await reader.read();if(part.done)break;size+=part.value.length;if(size>1_000_000){await reader.cancel();return null;}chunks.push(part.value);}
  const bytes=new Uint8Array(size);let offset=0;for(const chunk of chunks){bytes.set(chunk,offset);offset+=chunk.length;}
  signal.throwIfAborted();const fingerprint=fingerprintImage(bytes);
  if(cache.size>=150)cache.delete(cache.keys().next().value!);cache.set(url.href,{at:Date.now(),fingerprint});return fingerprint;
 }catch(error){console.warn('Product photo read unavailable:',error instanceof Error?error.message:'unknown');return null;}
}
export async function visualMatches(product:Product,offers:Offer[],stores:Store[]){
 const signal=AbortSignal.timeout(4000),reference=await imageFingerprint(product.image,stores,signal);
 const rows:Record<string,VisualMatch>={};let next=0;
 await Promise.all(Array.from({length:Math.min(3,offers.length)},async()=>{
  while(next<offers.length){const offer=offers[next++];
   // A copied photograph can never rescue a known wrong type or variant.
   rows[offer.id]=offer.variant_conflict?'unavailable':compareFingerprints(reference,signal.aborted?null:await imageFingerprint(offer.image_url,stores,signal));
  }
 }));return rows;
}

