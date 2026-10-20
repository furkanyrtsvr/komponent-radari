import {jumperDetails} from '../lib/catalog-identity';
/** Count physical units only when the product title actually describes a sale pack. */
export function salePack(name:string){
 if(jumperDetails(name)||/\bkablo\s+seti\b/i.test(name))return 1;
 const count=name.match(/\b(\d+)\s*(?:adet|pcs)\b/i)||name.match(/\b(\d+)\s*['’\s-]*(?:li|lı|lu|lü)\s+paket\b/i);
 const n=count?Number(count[1]):1;
 if(!Number.isSafeInteger(n)||n<1)throw new Error('Satış paketi doğrulanamadı.');
 return n;
}
export function sameProductPath(left:string,right:string){if(!left)return false;const a=new URL(left,right),b=new URL(right);return a.protocol==='https:'&&a.hostname.replace(/^www\./,'')===b.hostname.replace(/^www\./,'')&&a.pathname.replace(/\/$/,'')===b.pathname.replace(/\/$/,'');}
