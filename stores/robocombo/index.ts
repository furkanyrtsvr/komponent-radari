import {load} from 'cheerio';
import {JsonLdAdapter,parsePrice,parseProduct} from '../base';
import {inlineObject} from '../inline-data';
export function parseRobocomboProduct(html:string,url:string){
  const $=load(html),model=inlineObject(html,/var\s+productDetailModel\s*=\s*\{/);
  // Ticimax adds the stock code to h1; JSON-LD carries the actual name.
  const h=$('h1').first();
  if(!h.text().replace(/\s+/g,' ').trim().startsWith(String(model.productName||'')))throw new Error('Robocombo ana ürün adı çelişiyor.');
  h.text(String(model.productName||''));
  const p=parseProduct($.html(),url);
  const discounted=$('#indirimliFiyat');
  const priceScope=discounted.find('.spanFiyat').length?discounted:$('#fiyat2').find('.spanFiyat').length?$('#fiyat2'):$('#fiyat');
  const gross=parsePrice(priceScope.find('.spanFiyat').first().text());
  if(!gross || gross!==p.price || gross!==parsePrice(model.productPriceKDVIncluded) || !/KDV\s*Dahil/i.test(priceScope.text()) || p.name!==model.productName || p.currency.toUpperCase()!=='TRY')throw new Error('Robocombo ana ürün fiyatı ve KDV doğrulanamadı.');
  const input=$('#txtbxurunSiparisAdedi');const min=Number(input.attr('min')),step=Number(input.attr('step'));
  if(!input.length || !Number.isSafeInteger(min) || min<1 || !Number.isSafeInteger(step) || step<1)throw new Error('Robocombo satış adımı doğrulanamadı.');
  if(model.productVariantData || model.productIsAsorti)throw new Error('Varyant seçimi gereken ürün doğrulanamadı.');
  const pack=p.packageQuantity||1;
  const stock=Number(model.totalStockAmount);
  if(!Number.isSafeInteger(stock) || stock<0 || (stock===0 && p.stockStatus==='in_stock') || (stock>0 && p.stockStatus==='out_of_stock'))throw new Error('Robocombo stok bilgisi çelişiyor.');
  return {...p,currency:'TRY',price:gross,priceNet:parsePrice(model.productPrice),vatIncluded:true,packageQuantity:pack,minimumOrderQuantity:min*pack,orderStep:step*pack,quantityVerified:true,stockQuantity:stock*pack};
}
export class RobocomboAdapter extends JsonLdAdapter{
  async getProduct(raw:string){const page=await this.readPage(raw);return parseRobocomboProduct(page.html,page.url);}
}
