import {load} from 'cheerio';
import {JsonLdAdapter,parsePrice,parseProduct,safeStoreUrl} from '../base';
import {canonicalMerchantPath} from '../../lib/merchant-url-aliases';
/** Merchant A0470's sitemap contained one stray leading hyphen. This exact
 * canonical address was checked; never strip hyphens from arbitrary products. */
export function robotronikProductUrl(raw:string,domain='www.robotronik.com.tr'){
 const url=safeStoreUrl(raw,domain);
 if(!url.search)url.pathname=canonicalMerchantPath(url.hostname,url.pathname);
 return url.href;
}
export function parseRobotronikProduct(html:string,url:string){
  const $=load(html),p=parseProduct(html,url),scope=$('.urun-detay-cerceve').first();
  const gross=parsePrice(scope.find('.urun-detay-fiyat2').first().text());
  const input=scope.find('#adet'),min=Number(input.attr('min')),step=Number(input.attr('step'));
  if(!scope.length || scope.find('.urun-detay-baslik').text().trim()!==p.name || !gross || gross!==p.price || p.currency!=='TRY' || !/KDV\s*Dahil/i.test(scope.find('.urun-detay-fiyat-kdv').text()))throw new Error('Robotronik ana ürün fiyatı ve KDV doğrulanamadı.');
  if(!input.length || !Number.isSafeInteger(min) || min<1 || !Number.isSafeInteger(step) || step<1)throw new Error('Robotronik satış adımı doğrulanamadı.');
  if(scope.find('select[name="model[]"]').length)throw new Error('Robotronik varyant seçimi doğrulanamadı.');
  const stockText=scope.find('.kalan-stok-sayi').text().trim();const stock=stockText?Number(stockText):null;
  if(stock!==null && (!Number.isSafeInteger(stock) || stock<0 || (stock===0 && p.stockStatus==='in_stock')))throw new Error('Robotronik stok bilgisi çelişiyor.');
  const pack=p.packageQuantity||1;
  return {...p,price:gross,vatIncluded:true,packageQuantity:pack,minimumOrderQuantity:min*pack,orderStep:step*pack,quantityVerified:true,stockQuantity:stock===null?null:stock*pack};
}
export class RobotronikAdapter extends JsonLdAdapter{
  async getProduct(raw:string){const page=await this.readPage(robotronikProductUrl(raw,this.store.domain));return parseRobotronikProduct(page.html,page.url);}
}
