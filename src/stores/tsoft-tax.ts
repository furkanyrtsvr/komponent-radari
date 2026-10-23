import {load} from 'cheerio';
import {ascii} from '../../public/catalog/product-identity.js';
import {parsePrice} from './base';
import type {ExtractedProduct} from './types';

/** Decode public JSON strings as data. No merchant script is evaluated. */
function productRecords(html:string){
 const records:Record<string,unknown>[]=[];
 const $=load(html);
 $('script').each((_,el)=>{
  for(const m of $(el).text().matchAll(/PRODUCT_DATA\.push\(JSON\.parse\('((?:\\.|[^'\\])*)'\)\)/g)){
   try{
    const raw=m[1].replace(/\\(u[0-9a-f]{4}|x[0-9a-f]{2}|[\s\S])/gi,(_,escape:string)=>escape[0]==='u'||escape[0]==='x'?String.fromCharCode(parseInt(escape.slice(1),16)):({n:'\n',r:'\r',t:'\t',b:'\b',f:'\f'} as Record<string,string>)[escape]??escape);
    records.push(JSON.parse(raw));
   }catch{/* Incomplete or non-JSON product records cannot prove a tax total. */}
  }
 });return records;
}

/** A regional widget can label a net amount as VAT-inclusive. Require the
 * merchant's own positive-VAT total, bound to the same product ID, SKU and URL. */
export function robotistanTaxProof(html:string,url:string,p:ExtractedProduct,visible:number[]){
 const $=load(html),nodes:any[]=[];
 function visit(v:any){if(Array.isArray(v))v.forEach(visit);else if(v&&typeof v==='object'){if(v['@type']==='Product')nodes.push(v);if(v['@graph'])visit(v['@graph']);}}
 $('script[type="application/ld+json"]').each((_,el)=>{try{visit(JSON.parse($(el).text()));}catch{}});
 const sameUrl=(value:unknown)=>{try{const a=new URL(String(value),url),b=new URL(url);return a.hostname.replace(/^www\./,'')===b.hostname.replace(/^www\./,'')&&a.pathname.replace(/\/$/,'')===b.pathname.replace(/\/$/,'');}catch{return false;}};
 const ld=nodes.filter(n=>ascii(String(n.name||''))===ascii(p.name)&&sameUrl(n.url||n.offers?.url||String(n['@id']||'').split('#')[0]));
 const records=productRecords(html).filter(r=>sameUrl(r.url)&&ascii(String(r.name||''))===ascii(p.name));
 const fail=()=>{console.warn('Robotistan tax proof rejected',{path:new URL(url).pathname,metadata:p.price,visible,records:records.map(r=>({id:r.id,target:r.currency_target,vat:r.vat,net:r.sale_price,total:r.total_sale_price})).slice(0,3)});throw new Error('Robotistan Türkiye KDV dahil toplamı ürün verisiyle doğrulanamadı; fiyat kullanılmadı.');};
 if(ld.length!==1||records.length!==1)return fail();
 const data=records[0],node=ld[0];
 const netAmount=Number(data.sale_price),rate=Number(data.vat),gross=parsePrice(data.total_sale_price),net=parsePrice(data.sale_price);
 if(!node.productID||!node.sku||String(data.id)!==String(node.productID)||String(data.code)!==String(node.sku)||Number(data.subproduct_id)!==0||p.currency!=='TRY'||!['TL','TRY'].includes(String(data.currency_target))||!Number.isFinite(rate)||rate<=0||rate>100||!Number.isFinite(netAmount)||netAmount<=0||!gross||!net||Math.abs(Math.round(netAmount*(1+rate/100)*100)-gross)>1||(p.price!==net&&p.price!==gross)||!visible.length||visible.some(v=>v!==net&&v!==gross))return fail();
 return {gross,net,vatRate:rate/100};
}
