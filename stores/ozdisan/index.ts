import {load} from 'cheerio';
import {JsonLdAdapter,parseProduct} from '../base';
import {ascii} from '../../public/catalog/product-identity.js';
import type {ExtractedProduct} from '../types';
import type {PriceTier} from '../../lib/pricing';
type Data=Record<string,any>;
function machineValue(value:unknown){const s=String(value??'').trim().replace(/\s*TRY$/,'');if(!/^(?:\d+|\d{1,3}(?:,\d{3})+)(?:\.\d+)?$/.test(s))return null;const n=Number(s.replaceAll(',',''));return Number.isFinite(n)&&n>=0?n:null;}
function quantity(value:unknown){const s=String(value??'').replaceAll(',','').trim();return /^\d+$/.test(s)&&Number.isSafeInteger(Number(s))?Number(s):null;}
export function parseOzdisanProduct(html:string,url:string):ExtractedProduct {
 const p=parseProduct(html,url),$=load(html);
 const nodes:Data[]=[];const visit=(v:any)=>{if(Array.isArray(v))v.forEach(visit);else if(v&&typeof v==='object'){if(v['@type']==='Product')nodes.push(v);if(v['@graph'])visit(v['@graph']);}};
 $('script[type="application/ld+json"]').each((_,e)=>{try{visit(JSON.parse($(e).text()));}catch{}});
 const samePath=(v:unknown)=>{try{return new URL(String(v),url).pathname===new URL(url).pathname;}catch{return false;}};
 const candidates=nodes.filter(n=>ascii(n.name)===ascii(p.name));
 if(candidates.length!==1)throw new Error('Özdisan ana ürün kimliği doğrulanamadı.');
 const node=candidates[0],offers=(Array.isArray(node.offers)?node.offers:[node.offers]).filter((o:Data)=>o&&o.priceCurrency==='TRY'&&samePath(o.url));
 if(offers.length!==1)throw new Error('Özdisan ürün teklifi belirsiz.');
 const offer=offers[0];
 const firstCard=$('[class*="ProductDetailTapeCard"][class*="tape-card-container"]').first();
 if(!firstCard.length||!/Toplam Fiyat[\s\S]*KDV Dahil/.test(firstCard.text()))throw new Error('Özdisan KDV dahil toplam fiyat tablosu doğrulanamadı.');
 const rows=firstCard.find('.price-row').map((_,e)=>{
  const row=$(e),minimum=quantity(row.find('.first-column > span').first().text());
  const net=machineValue(row.find('.second-column > span').filter((_,x)=>/TRY\s*$/.test($(x).text())).first().text());
  const grossTotal=machineValue(row.find('.third-column > span').filter((_,x)=>/TRY\s*$/.test($(x).text())).first().text());
  return {minimum,net,grossTotal};
 }).get();
 // Fixed-price products publish the same tier directly on Offer instead of
 // priceSpecification. Reconcile it with the one visible table row.
 const specs=(Array.isArray(offer.priceSpecification)?offer.priceSpecification:[offer.priceSpecification]).filter(Boolean);
 if(!specs.length&&rows.length===1)specs.push({price:offer.price,eligibleQuantity:offer.eligibleQuantity});
 const minimum=Number(offer.eligibleQuantity?.minValue);
 const multiples=(node.additionalProperty||[]).filter((s:Data)=>s.name==='Order Multiple');
 const step=multiples.length===1?Number(multiples[0].value):NaN;
 // MPQ is reel/tube packaging; it does not override explicit MOQ and Multiple.
 if(!Number.isSafeInteger(minimum)||minimum<1||!Number.isSafeInteger(step)||step<1||rows.length!==specs.length)throw new Error('Özdisan satış miktarı veya satış adımı doğrulanamadı.');
 const body=$('body').clone().find('script,style').remove().end().text();
 const moq=body.match(/MOQ:\s*([\d,]+)/)?.[1],multiple=body.match(/Multiple:\s*([\d,]+)/)?.[1];
 if(quantity(moq)!==minimum||quantity(multiple)!==step)throw new Error('Özdisan görünen MOQ/Multiple bilgisi eşleşmedi.');
 const tiers:(PriceTier&{netUnitPriceMicros:number;vatBasisPoints:number;rounding:'net-subtotal'})[]=[];
 for(let i=0;i<rows.length;i++){
  const row=rows[i],spec=specs[i],net=machineValue(spec.price),q=row.minimum;
  if(q===null||q<minimum||q!==Number(spec.eligibleQuantity?.minValue)||net===null||net<=0||row.net===null||Math.abs(row.net-net)>0.000001||row.grossTotal===null||row.grossTotal<=0)throw new Error('Özdisan miktar fiyatı JSON-LD ile eşleşmedi.');
  const micros=Math.round(net*1e6),grossCents=Math.round(row.grossTotal*100);
  // Verified against every visible anchor; this merchant rounds net subtotal
  // to kuruş before adding VAT. Do not round each unit before multiplication.
  if(Math.round(Math.round(micros/10000*q)*1.2)!==grossCents)throw new Error('Özdisan KDV dahil toplam fiyatı doğrulanamadı.');
  const next=rows[i+1]?.minimum;
  if(next!=null&&next<=q)throw new Error('Özdisan fiyat aralıkları sıralı değil.');
  tiers.push({minimum:q,maximum:next==null?null:next-1,price:Math.round(grossCents/q),netUnitPriceMicros:micros,vatBasisPoints:2000,rounding:'net-subtotal'});
 }
 if(!tiers.length||tiers[0].minimum!==minimum||machineValue(offer.price)!==rows[0].net)throw new Error('Özdisan temel fiyatı doğrulanamadı.');
 const stock=Number(offer.inventoryLevel?.value);
 if(!Number.isSafeInteger(stock)||stock<0)throw new Error('Özdisan stok miktarı doğrulanamadı.');
 const description=String(node.description||'').trim();
 return {...p,name:description&&!p.name.includes(description)?`${p.name} · ${description}`:p.name,price:tiers[0].price,priceNet:Math.round(rows[0].net!*100),vatIncluded:true,vatRate:0.2,packageQuantity:1,minimumOrderQuantity:minimum,orderStep:step,quantityVerified:true,priceTiers:tiers,stockQuantity:stock,stockStatus:stock>0?'in_stock':'out_of_stock',specifications:JSON.stringify({description,properties:node.additionalProperty||[]}),warnings:['Özdisan varsayılan paketlemesinin KDV dahil toplamları, MOQ ve sipariş adımı mağaza sayfasından doğrulandı.','Alternatif reel paketlemesi ve reel hazırlama ücreti bu teklifin kapsamında değildir. Kargo ödeme ekranında doğrulanmalıdır.']};
}
export class OzdisanAdapter extends JsonLdAdapter {async getProduct(raw:string){const page=await this.readPage(raw);return parseOzdisanProduct(page.html,page.url);}}
