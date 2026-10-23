import {load} from 'cheerio';
import {JsonLdAdapter,parseProduct,parsePrice} from './base';
import {salePack,sameProductPath} from './sale-evidence';
import {ascii} from '../../public/catalog/product-identity.js';
export function parsePilpaketiProduct(html:string,url:string){
 const $=load(html),p=parseProduct(html,url),scope=$('h1').first().closest('.product-profile-1');
 const nodes:any[]=[];const visit=(v:any)=>{if(Array.isArray(v))v.forEach(visit);else if(v&&typeof v==='object'){if(v['@type']==='Product')nodes.push(v);if(v['@graph'])visit(v['@graph']);}};
 $('script[type="application/ld+json"]').each((_,e)=>{try{visit(JSON.parse($(e).text()));}catch{}});
 const node=nodes.find(n=>ascii(n.name)===ascii(p.name));
 if(!node||!scope.length||String(node.productId)!==scope.attr('data-product-id')||!sameProductPath(String(node.offers?.url||''),url))throw new Error('Pil Paketi ana ürün kimliği doğrulanamadı.');
 const buy=scope.find('.pp-area-satin'),gross=parsePrice(buy.find('.sale-variant-price').first().text());
 if(!gross||gross!==p.price||p.currency!=='TRY'||!/KDV\s+Dahil/i.test(buy.find('.pp-vat-note').text()))throw new Error('Pil Paketi KDV dahil fiyatı doğrulanamadı.');
 const unit=scope.find('.pp-spec-k').filter((_,e)=>/^Satış Birimi$/i.test($(e).text().trim())).first().siblings('.pp-spec-v').text().trim();
 const input=buy.find('.product-quantity input[name="quantity"]'),minimum=input.length?Number(input.attr('data-min')):1,step=input.length?Number(input.attr('data-increase')):1;
 if(!['Adet','Metre'].includes(unit)||scope.find('select[name*="variant"],.product-variant-list select').length||(!input.length&&p.stockStatus!=='out_of_stock')||(input.length&&input.attr('data-decimal')!=='0')||!Number.isSafeInteger(minimum)||minimum<1||!Number.isSafeInteger(step)||step<1)throw new Error('Pil Paketi satış birimi veya varyantı doğrulanamadı.');
 const pack=unit==='Metre'?1:salePack(p.name);
 return {...p,unitType:unit==='Metre'?'metre' as const:'adet' as const,price:gross,vatIncluded:true,packageQuantity:pack,minimumOrderQuantity:minimum*pack,orderStep:step*pack,quantityVerified:true,stockQuantity:p.stockStatus==='out_of_stock'?0:null,warnings:[`Pil Paketi ana ürün fiyatı, KDV ve satış birimi doğrulandı. Fiyat ${unit==='Metre'?'metre':'paket/adet'} başınadır; minimum ve artış mağazadaki miktar kontrolünden okunur.`]};
}
export class PilpaketiAdapter extends JsonLdAdapter{async getProduct(raw:string){const page=await this.readPage(raw);return parsePilpaketiProduct(page.html,page.url);}}
