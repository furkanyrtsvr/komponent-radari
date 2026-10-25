import {load} from 'cheerio';
import {JsonLdAdapter,parseProduct,parsePrice,safeStoreUrl} from './base';
import {salePack,sameProductPath} from './sale-evidence';
import {ascii} from '../../public/catalog/product-identity.js';
import {productImage} from './product-image';
export function parseHobidevreProduct(html:string,url:string,publicProduct?:unknown){
 const $=load(html),p=parseProduct(html,url),scope=$('h1').first().closest('.hd-pdp'),box=scope.find('.hd-buybox'),form=box.find('form.cart');
 const canonical=$('link[rel="canonical"]').attr('href'),gross=parsePrice(box.find('.hd-bcur').first().text());
 if(!scope.length||!canonical||!sameProductPath(canonical,url)||!gross||p.currency!=='TRY'||!/KDV\s+dahil/i.test(box.find('.hd-vat').text()))throw new Error('Hobi Devre KDV dahil fiyatı doğrulanamadı.');
 if(form.hasClass('variations_form')||form.find('select[name^="attribute"],input[name="variation_id"]').length)throw new Error('Hobi Devre varyantı seçilmeden fiyat doğrulanamaz.');
 if(!form.length){
  const d=publicProduct as Record<string,any>|undefined,id=String(d?.id||''),quantity=d?.add_to_cart;
  const linked=(value:string)=>{try{return sameProductPath(safeStoreUrl(value,new URL(url).hostname).href,url);}catch{return false;}};
  const nodes:any[]=[];const visit=(v:any)=>{if(Array.isArray(v))v.forEach(visit);else if(v&&typeof v==='object'){if(v['@type']==='Product'&&ascii(v.name)===ascii(p.name)&&linked(v.url||v['@id']||''))nodes.push(v);if(v['@graph'])visit(v['@graph']);}};
  $('script[type="application/ld+json"]').each((_,e)=>{try{visit(JSON.parse($(e).text()));}catch{}});
  const sku=nodes.length===1?String(nodes[0].sku||''):'';
  // Woo's API encodes the multiplication sign inside dimensional SKU values.
  // Normalize that separator only between digits; retain every model/rating digit.
  const skuValue=(value:unknown)=>typeof value==='string'?value.replace(/(?<=\d)(?:&#(?:215|x0*d7);|&times;|×)(?=\d)/gi,'x'):'';
  const exact=d&&/^\d+$/.test(id)&&$('body').hasClass('postid-'+id)&&linked(d.permalink||'')&&ascii(d.name)===ascii(p.name)&&sku&&skuValue(d.sku)===skuValue(sku)&&d.type==='simple'&&d.parent===0&&d.has_options===false&&Array.isArray(d.variations)&&d.variations.length===0;
  const price=d?.prices?.price;
  if(!exact||d?.prices?.currency_code!=='TRY'||d?.prices?.currency_minor_unit!==2||typeof price!=='string'||!/^\d+$/.test(price)||Number(price)!==gross||parsePrice(box.attr('data-price'))!==gross)throw new Error('Hobi Devre stok dışı ürünün kimliği veya halka açık fiyatı doğrulanamadı.');
  if(d.is_in_stock!==false||d.is_on_backorder!==false||d.stock_availability?.class!=='out-of-stock'||p.stockStatus!=='out_of_stock')throw new Error('Hobi Devre stok bilgisi çelişiyor.');
  if(!Number.isSafeInteger(quantity?.minimum)||quantity.minimum<1||!Number.isSafeInteger(quantity?.multiple_of)||quantity.multiple_of<1)throw new Error('Hobi Devre stok dışı satış adımı doğrulanamadı.');
  const pack=salePack(p.name);
  return {...p,price:gross,vatIncluded:true,packageQuantity:pack,minimumOrderQuantity:quantity.minimum*pack,orderStep:quantity.multiple_of*pack,quantityVerified:true,stockQuantity:0,image:productImage(p.image,url,d.images?.[0]?.src),warnings:['Hobi Devre stok dışı ürünün kimliği, KDV dahil görünür fiyatı ve satış adımı halka açık ürün API’siyle eşleştirildi.',...(p.price!==gross?['Eski JSON-LD fiyatı kullanılmadı; görünür fiyat ve aynı ürünün API fiyatı eşleşti.']:[])]};
 }
 const button=form.find('button[name="add-to-cart"][data-product_id]').first(),input=form.find('input[name="quantity"]');
 let cart:any;try{cart=JSON.parse(button.attr('data-hd-ga')||'');}catch{throw new Error('Hobi Devre ana ürün satış verisi bulunamadı.');}
 const id=String(cart.id),minimum=Number(input.attr('min')),step=Number(input.attr('step'));
 if(!sameProductPath(form.attr('action')||'',url)||ascii(form.attr('data-name'))!==ascii(p.name)||String(button.val())!==id||button.attr('data-product_id')!==id||!$('body').hasClass('postid-'+id)||ascii(cart.name)!==ascii(p.name)||Number(cart.price)!==gross||!Number.isSafeInteger(minimum)||minimum<1||!Number.isSafeInteger(step)||step<1)throw new Error('Hobi Devre ana ürün fiyatı veya satış adımı doğrulanamadı.');
 const pack=salePack(p.name);
 return {...p,price:gross,vatIncluded:true,packageQuantity:pack,minimumOrderQuantity:minimum*pack,orderStep:step*pack,quantityVerified:true,stockQuantity:null,warnings:['Hobi Devre ürün ve sepete ekleme verisinden güncel KDV dahil fiyat doğrulandı.',...(p.price!==gross?['Mağazanın yapılandırılmış fiyatı eski; ana ürün ve sepete ekleme verisindeki güncel fiyat kullanıldı.']:[])]};
}
export class HobidevreAdapter extends JsonLdAdapter{async getProduct(raw:string){
 const page=await this.readPage(raw),$=load(page.html),scope=$('h1').first().closest('.hd-pdp');
 if(!scope.find('.hd-buybox form.cart').length){
  const id=($('body').attr('class')||'').match(/\bpostid-(\d+)\b/)?.[1];
  if(!id)throw new Error('Hobi Devre ana ürün kimliği bulunamadı.');
  const endpoint=new URL('/wp-json/wc/store/v1/products/'+id,page.url),data=await this.readPage(endpoint.href);
  return parseHobidevreProduct(page.html,page.url,JSON.parse(data.html));
 }
 return parseHobidevreProduct(page.html,page.url);
}}
