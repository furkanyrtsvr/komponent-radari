import {load} from 'cheerio';
import {JsonLdAdapter,parseProduct,parsePrice} from './base';
import {salePack,sameProductPath} from './sale-evidence';
import {ascii} from '../../public/catalog/product-identity.js';
export function parseHobidevreProduct(html:string,url:string){
 const $=load(html),p=parseProduct(html,url),scope=$('h1').first().closest('.hd-pdp'),box=scope.find('.hd-buybox'),form=box.find('form.cart');
 const canonical=$('link[rel="canonical"]').attr('href'),gross=parsePrice(box.find('.hd-bcur').first().text());
 if(!scope.length||!canonical||!sameProductPath(canonical,url)||!gross||p.currency!=='TRY'||!/KDV\s+dahil/i.test(box.find('.hd-vat').text()))throw new Error('Hobi Devre KDV dahil fiyatı doğrulanamadı.');
 if(form.hasClass('variations_form')||form.find('select[name^="attribute"],input[name="variation_id"]').length)throw new Error('Hobi Devre varyantı seçilmeden fiyat doğrulanamaz.');
 const button=form.find('button[name="add-to-cart"][data-product_id]').first(),input=form.find('input[name="quantity"]');
 let cart:any;try{cart=JSON.parse(button.attr('data-hd-ga')||'');}catch{throw new Error('Hobi Devre ana ürün satış verisi bulunamadı.');}
 const id=String(cart.id),minimum=Number(input.attr('min')),step=Number(input.attr('step'));
 if(!sameProductPath(form.attr('action')||'',url)||ascii(form.attr('data-name'))!==ascii(p.name)||String(button.val())!==id||button.attr('data-product_id')!==id||!$('body').hasClass('postid-'+id)||ascii(cart.name)!==ascii(p.name)||Number(cart.price)!==gross||!Number.isSafeInteger(minimum)||minimum<1||!Number.isSafeInteger(step)||step<1)throw new Error('Hobi Devre ana ürün fiyatı veya satış adımı doğrulanamadı.');
 const pack=salePack(p.name);
 return {...p,price:gross,vatIncluded:true,packageQuantity:pack,minimumOrderQuantity:minimum*pack,orderStep:step*pack,quantityVerified:true,stockQuantity:null,warnings:['Hobi Devre ürün ve sepete ekleme verisinden güncel KDV dahil fiyat doğrulandı.',...(p.price!==gross?['Mağazanın yapılandırılmış fiyatı eski; ana ürün ve sepete ekleme verisindeki güncel fiyat kullanıldı.']:[])]};
}
export class HobidevreAdapter extends JsonLdAdapter{async getProduct(raw:string){const page=await this.readPage(raw);return parseHobidevreProduct(page.html,page.url);}}
