import {load} from 'cheerio';
import {JsonLdAdapter,parsePrice} from './base';
import {inlineObject} from './inline-data';
import {salePack,sameProductPath} from './sale-evidence';
import {ascii} from '../../public/catalog/product-identity.js';
import {validateProductFacts} from './validate-product-facts';
export function parsePilsitesiProduct(html:string,url:string){
 const $=load(html),d=inlineObject(html,/var\s+productDetailModel\s*=\s*\{/) as Record<string,any>,v=d.product;
 const canonical=$('link[rel="canonical"]').attr('href'),name=String(d.productName||'');
 if(!v||!name||!ascii($('h1').first().text()).startsWith(ascii(name))||String(v.urunKartiId)!==String(d.productId)||ascii(v.urunAdi)!==ascii(name)||!canonical||!sameProductPath(canonical,url))throw new Error('Pil Sitesi ana ürün kimliği doğrulanamadı.');
 const box=$('#indirimliFiyat').find('.spanFiyat').length?$('#indirimliFiyat'):$('#fiyat2').find('.spanFiyat').length?$('#fiyat2'):$('#fiyat');
 const gross=parsePrice(d.productPriceKDVIncluded),net=parsePrice(d.productPrice),shown=parsePrice(box.find('.spanFiyat').first().text()),rawNet=Number(v.indirimliFiyati)>0?Number(v.indirimliFiyati):Number(v.satisFiyati),vat=Number(v.indirimliFiyati)>0?Number(v.indirimliKDV):Number(v.satisKDV);
 if(!gross||shown!==gross||d.productCurrency!=='TRY'||v.paraBirimiKodu!=='TRY'||!/KDV\s*Dahil/i.test(box.text())||!Number.isFinite(rawNet)||!Number.isFinite(vat)||Math.round((rawNet+vat)*100)!==gross||parsePrice(rawNet)!==net)throw new Error('Pil Sitesi KDV dahil fiyatı doğrulanamadı.');
 const input=$('#txtbxurunSiparisAdedi'),minimum=Number(input.attr('min')),step=Number(input.attr('step')),stock=Number(d.totalStockAmount);
 if(d.productVariantData||d.productIsAsorti||d.productFileUploadIsRequire||v.urunAdediOndalikliSayiGirilebilir||!input.length||!Number.isSafeInteger(minimum)||minimum<1||minimum!==Number(v.urunAdediMinimumDeger)||!Number.isSafeInteger(step)||step<1||step!==Number(v.urunAdediKademeDeger)||!Number.isSafeInteger(stock)||stock<0)throw new Error('Pil Sitesi satış adımı veya varyantı doğrulanamadı.');
 const pack=salePack(name),description=$('#divTabDesc').text().replace(/\s+/g,' ').trim();validateProductFacts(name,description,[]);
 return {url,name,mpn:String(d.stockCode||''),manufacturer:String(d.brandName||''),model:'',image:String(v.spotResimYolu||'')||null,price:gross,priceNet:net,currency:'TRY',vatIncluded:true,vatRate:Number(v.kdvOrani)/100,packageQuantity:pack,minimumOrderQuantity:minimum*pack,orderStep:step*pack,quantityVerified:true,stockStatus:stock>0?'in_stock':'out_of_stock',stockQuantity:stock*pack,specifications:JSON.stringify({description}),warnings:['Pil Sitesi ürün fiyatı, KDV ve satış adımı doğrulandı. İsteğe bağlı puntalama veya özelleştirme bu fiyata dahil değildir.']};
}
export class PilsitesiAdapter extends JsonLdAdapter{async getProduct(raw:string){const page=await this.readPage(raw);return parsePilsitesiProduct(page.html,page.url);}}
