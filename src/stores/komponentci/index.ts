import {load} from 'cheerio';
import {JsonLdAdapter,parseProduct,parsePrice} from '../base';
import {jumperDetails} from '../../lib/catalog-identity';
import type {ExtractedProduct} from '../types';
export function parseKomponentciProduct(html:string,url:string):ExtractedProduct {
  const p=parseProduct(html,url),$=load(html);
  const scope=$('h1').first().closest('#PM_urun_detayi');
  if(!scope.length)throw new Error('Komponentci ana ürün bölümü doğrulanamadı.');
  const displayed=scope.find('.urun_kdvdahil_fiyati').filter((_,e)=>/KDV\s*Dahil/i.test($(e).closest('tr').text()));
  const values=[...new Set(displayed.map((_,e)=>parsePrice($(e).text())).get())];
  const gross=values.length===1?values[0]:null;
  const amount=scope.find('#urun_miktar_secenekleri'),minimum=Number(scope.find('#urun_min_miktar').attr('value'));
  const unit=scope.find('label[for="urun_miktar_secenekleri"]').text().trim();
  const explicitlyDeclared=Number(amount.attr('step')||scope.find('#urun_artis_miktar').attr('value')||'1');
  if(gross===null||gross!==p.price||gross<=0||p.currency!=='TRY'||amount.length!==1||!Number.isSafeInteger(minimum)||minimum<1||!Number.isSafeInteger(explicitlyDeclared)||explicitlyDeclared<1||!/^(Adet|Paket|Set)$/i.test(unit))throw new Error('Komponentci fiyatı veya satış birimi doğrulanamadı.');
  const pack=jumperDetails(p.name)?1:p.packageQuantity||1;
  // Merchant controls count sale packs. The comparison model counts pieces.
  const minPieces=minimum*pack,stepPieces=explicitlyDeclared*pack;
  if(!Number.isSafeInteger(minPieces)||!Number.isSafeInteger(stepPieces))throw new Error('Komponentci paket miktarı geçersiz.');
  return {...p,price:gross,vatIncluded:true,packageQuantity:pack,minimumOrderQuantity:minPieces,orderStep:stepPieces,quantityVerified:true,
    warnings:['Komponentci ana ürününün KDV dahil fiyatı ve satış paketi mağaza sayfasından doğrulandı.','Kargo ücreti ödeme ekranında doğrulanmalıdır.']};
}
export class KomponentciAdapter extends JsonLdAdapter {
  async getProduct(raw:string){const page=await this.readPage(raw);return parseKomponentciProduct(page.html,page.url);}
  async getShippingRules(){return{estimated:true,available:false};}
}
