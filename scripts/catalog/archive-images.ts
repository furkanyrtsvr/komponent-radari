import sharp from 'sharp';
import {createHash} from 'node:crypto';
import {isIP} from 'node:net';
import {lookup} from 'node:dns/promises';
import {robotsAllowed} from '../../src/stores/base';
export const digest=(bytes:Uint8Array|string)=>createHash('sha256').update(bytes).digest('hex');
export function safeImageUrl(raw:string){const u=new URL(raw);if(u.protocol!=='https:'||u.username||u.password||u.port||isIP(u.hostname.replace(/^\[|\]$/g,''))||!u.hostname.includes('.')||/\.(?:localhost|local|internal|test)$/.test(u.hostname)||/ozdisan-share-default|no[-_]?image|placeholder|\/logo[.\-_]/i.test(u.pathname))throw new Error('Ürünün gerçek, herkese açık görseli gerekli.');u.hash='';return u;}
export async function compactProductImage(bytes:Uint8Array){
 if(!bytes.length||bytes.length>8_000_000)throw new Error('Görsel dosyası çok büyük.');
 const input=sharp(bytes,{limitInputPixels:36_000_000,failOn:'error'}),meta=await input.metadata();
 if(!['jpeg','png','webp','avif'].includes(meta.format||'')||!meta.width||!meta.height)throw new Error('Görsel biçimi desteklenmiyor.');
 const result=await input.rotate().resize({width:800,height:800,fit:'inside',withoutEnlargement:true}).webp({quality:84,effort:5,smartSubsample:true}).toBuffer({resolveWithObject:true});
 if(result.data.length>500000)throw new Error('Hazır görsel boyut sınırını aşıyor.');
 return {bytes:result.data,width:result.info.width,height:result.info.height,key:'images/'+digest(result.data)+'.webp',originalBytes:bytes.length};
}
type Policy={text:string;delay:number;next:number};
const policies=new Map<string,Promise<Policy>>(),tails=new Map<string,Promise<void>>();
const headers={'User-Agent':'EUB-PriceComparison/1.0 (+public product images; no authentication)'};
async function publicAddress(host:string){const addresses=await lookup(host,{all:true});if(!addresses.length||addresses.some(({address:a})=>/^(?:127\.|10\.|192\.168\.|169\.254\.|0\.|172\.(?:1[6-9]|2\d|3[01])\.|::1$|fc|fd|fe80:|::ffff:)/i.test(a)))throw new Error('Özel ağ adresi okunamaz.');}
async function policy(u:URL){let value=policies.get(u.origin);if(!value){value=(async()=>{await publicAddress(u.hostname);const r=await fetch(u.origin+'/robots.txt',{headers,redirect:'error',signal:AbortSignal.timeout(15000)});if(!r.ok&&r.status!==404)throw new Error('Görsel robots kuralları okunamadı: '+r.status);const text=r.status===404?'':await r.text();return {text,delay:Math.max(1000,...[...text.matchAll(/^\s*Crawl-delay:\s*([\d.]+)/gim)].map(m=>Number(m[1])*1000)),next:Date.now()};})();policies.set(u.origin,value);}return value;}
export async function downloadProductImage(raw:string,deadline:number){
 let u=safeImageUrl(raw);
 for(let n=0;n<4;n++){
  const p=await policy(u);if(!robotsAllowed(p.text,u.pathname+u.search))throw new Error('Görsel robots kurallarıyla kapalı.');
  const previous=tails.get(u.origin)||Promise.resolve();let release!:()=>void;const gate=new Promise<void>(r=>{release=r;});tails.set(u.origin,previous.then(()=>gate));
  await previous;
  let response:Response;
  try{const delay=Math.max(0,p.next-Date.now());if(Date.now()+delay+16000>deadline)throw new Error('Görsel hazırlama süresi doldu.');if(delay)await new Promise(r=>setTimeout(r,delay));await publicAddress(u.hostname);p.next=Date.now()+p.delay;response=await fetch(u.href,{headers,redirect:'manual',signal:AbortSignal.timeout(15000)});}finally{release();}
  if(response.status>=300&&response.status<400){const target=response.headers.get('location');if(!target)throw new Error('Geçersiz görsel yönlendirmesi.');u=safeImageUrl(new URL(target,u).href);continue;}
  if(!response.ok)throw new Error('Görsel HTTP '+response.status);if(Number(response.headers.get('content-length'))>8_000_000)throw new Error('Görsel çok büyük.');
  const reader=response.body?.getReader();if(!reader)throw new Error('Görsel gövdesi yok.');const chunks:Uint8Array[]=[];let size=0;
  for(;;){const {done,value}=await reader.read();if(done)break;size+=value.length;if(size>8_000_000){await reader.cancel();throw new Error('Görsel çok büyük.');}chunks.push(value);}
  return Buffer.concat(chunks);
 }
 throw new Error('Çok fazla görsel yönlendirmesi.');
}
