import {load} from 'cheerio';
import {JsonLdAdapter,parseProduct,parsePrice} from './base';
import {salePack} from './sale-evidence';
import {ascii} from '../../public/catalog/product-identity.js';
export function parseEkomponentProduct(html:string,url:string){
 const $=load(html),scope=$('#product-detail'),title=scope.find('#product-title').text().trim(),fields=scope.parent(),hidden=fields.find('#product-name').attr('value');
 if(!scope.length||!title||ascii(title)!==ascii(hidden))throw new Error('E komponent ana ürün adı doğrulanamadı.');
 const mpn=scope.find('#supplier-product-code').first().text().trim();scope.find('h1').first().text(title);
 if(!parsePrice(scope.find('.product-current-price .product-price').first().text()))throw new Error('E komponent bu ürün için herkese açık fiyat yayımlamıyor.');
 const p=parseProduct($.html(),url),gross=parsePrice(scope.find('.product-current-price .product-price').first().text()),stored=parsePrice(fields.find('#product-price-vat-include').attr('value'));
 if(!gross||gross!==p.price||gross!==stored||p.currency!=='TRY'||!/KDV\s+Dahil\s+Birim\s+Fiyat/i.test(scope.find('.product-kdv-note').text()))throw new Error('E komponent KDV dahil fiyatı doğrulanamadı.');
 const qty=scope.find('input[id^="ProductCount"]').first(),minimum=Number(qty.attr('min')),step=Number(qty.attr('step')),unit=qty.parent().find('.unit').text().trim(),id=fields.find('#product-id').attr('value');
 if(!id||!qty.attr('id')?.startsWith('ProductCount'+id)||!Number.isSafeInteger(minimum)||minimum<1||!Number.isSafeInteger(step)||step<1||unit!=='Adet'||scope.find('select[name*="variant"]').length)throw new Error('E komponent satış birimi doğrulanamadı.');
 const stockFlag=fields.find('#product-stock-status').attr('value'),available=scope.find('.in-stock-available').filter((_,e)=>!$(e).hasClass('d-none')).length>0;
 if(stockFlag!=='1'||!available||p.stockStatus!=='in_stock')throw new Error('E komponent stok bilgisi doğrulanamadı.');
 const packs=scope.find('.multiple-item[data-stock]').map((_,e)=>Number($(e).attr('data-stock'))).get().filter(Number.isSafeInteger),stock=[...new Set(packs)],pack=salePack(p.name);
 const priceTiers=scope.find('.multiple-item').filter((_,e)=>!$(e).hasClass('give-bid')).map((_,e)=>{const row=$(e),q=Number(row.attr('data-min')),max=Number(row.attr('data-max')),price=parsePrice(row.find('.col-4').eq(1).text());return Number.isSafeInteger(q)&&q>=minimum&&price&&price<=gross?{minimum:q*pack,maximum:Number.isSafeInteger(max)&&max>=q?max*pack:null,price}:null;}).get();
 return {...p,mpn,price:gross,vatIncluded:true,packageQuantity:pack,minimumOrderQuantity:minimum*pack,orderStep:step*pack,quantityVerified:true,stockQuantity:stock.length===1?stock[0]*pack:null,priceTiers,warnings:['E komponent ana ürününün TRY fiyatı, KDV ve satış birimi doğrulandı.']};
}
export class EkomponentAdapter extends JsonLdAdapter{
 async getProduct(raw:string){const page=await this.readPage(raw);return parseEkomponentProduct(page.html,page.url);}
 async getCatalogProduct(raw:string){const page=await this.readPage(raw),$=load(page.html),name=$('#product-title').first().text().trim();if(!name||ascii(name)!==ascii($('#product-name').attr('value')))throw new Error('E komponent ürün bilgisi doğrulanamadı.');return {url:page.url,name,mpn:$('#supplier-product-code').first().text().trim(),model:'',manufacturer:'',image:null,price:null,currency:'',vatIncluded:null,vatRate:null,packageQuantity:null,stockStatus:'unknown',stockQuantity:null,specifications:'{}',quantityVerified:false,warnings:['Mağaza bu ürünün fiyatını veya satış birimini doğrulayan herkese açık bilgi vermiyor.']};}
}
