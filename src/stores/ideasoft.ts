import {ascii} from '../../public/catalog/product-identity.js';
import {load} from 'cheerio';
import {JsonLdAdapter,parsePrice,safeStoreUrl} from './base';
import {inlineObject} from './inline-data';
import {validateProductFacts} from './validate-product-facts';
import type {ExtractedProduct} from './types';
import catalog from '../lib/generated/ideasoft-catalog.json';

export function parseIdeasoftProduct(html:string,url:string):ExtractedProduct{
  const $=load(html);
  const p=inlineObject(html,/pageParams\s*=\s*\{\s*product\s*:\s*\{/);
  const scope=$('h1').first().closest('.rz-pd-grid, .product-right');
  const name=scope.find('h1').first().text().replace(/\s+/g,' ').trim();
  if(!scope.length || !name || name.replace(/\s/g,'')!==String(p.fullName||'').replace(/\s/g,'') || String(p.currency)!=='TRY')throw new Error('Ana ürün adı veya para birimi doğrulanamadı.');
  const canonical=$('link[rel="canonical"]').attr('href');
  if(canonical && new URL(canonical,url).pathname!==new URL(url).pathname)throw new Error('Bağlantı farklı bir ürüne yönlendi.');
  const gross=parsePrice(p.salePrice),tax=Number(p.tax);
  const priceNode=scope.find('.rz-pd-price-sub').length?scope.find('.rz-pd-price-sub').first():scope.find('.product-price-new').length?scope.find('.product-price-new').first():scope.find('.product-price').first();
  const displayed=parsePrice(priceNode.text());
  const netLabel=/\+\s*KDV|KDV\s*Hariç/i.test(priceNode.text());
  const net=Number(p.priceWithCurrency??p.price)-Number(p.discountWithCurrency||0),verifiedDisplay=displayed===gross||netLabel&&Number.isFinite(net)&&net>0&&displayed===parsePrice(net)&&Math.abs(Math.round(net*(1+tax/100)*100)-gross!)<=1;
  if(!gross || !verifiedDisplay || !Number.isFinite(tax) || tax<0 || tax>100)throw new Error('Mağazanın KDV dahil ürün fiyatı doğrulanamadı.');
  const qty=scope.find('[data-selector="qty"][data-context="detail"]').first();
  const buy=scope.find('[data-selector="add-to-cart"][data-context="detail"]').filter((_,e)=>$(e).attr('data-product-id')===String(p.id));
  const unavailable=/gelince haber ver|stokta yok|tukendi/.test(ascii(scope.text()));
  const stock=unavailable?'out_of_stock':buy.length?'in_stock':'unknown';
  // IdeaSoft's stockamount is the stock ceiling; its input value/min and the
  // Piece quantity control describe the amount the buyer can actually order.
  const minimum=qty.length?Number(qty.attr('min')??qty.attr('value')):1;
  const step=qty.length?Number(qty.attr('step')??1):1;
  const stockAmount=qty.length?Number(qty.attr('data-stockamount')):null;
  if(qty.length && (qty.attr('data-stocktype')!=='Piece' || !Number.isSafeInteger(minimum) || minimum<1 || !Number.isSafeInteger(step)||step<1||!Number.isSafeInteger(stockAmount)||stockAmount!<0))throw new Error('Satış birimi veya minimum sipariş doğrulanamadı.');
  if(buy.length && !qty.length)throw new Error('Ürün satış adımı bulunamadı.');
  if(Number(p.parentId)!==0 || scope.find('select[data-selector*="variant"]').length)throw new Error('Ürün varyantı seçilmeden fiyat karşılaştırılamaz.');
  const description=$('.product-detail-tab-row').first().text().replace(/\s+/g,' ').trim();
  validateProductFacts(name,description,[]);
  const pack=name.match(/\b(\d+)\s*(?:adet|pcs)\b/i);const packageQuantity=pack?Number(pack[1]):1;
  const rawImage=String(p.primaryImageUrl||'');const image=rawImage?new URL(rawImage,url).href:null;
  return {url,name,mpn:String(p.sku||''),model:'',manufacturer:String(p.brandName||''),image,
    price:gross,priceNet:Math.round(gross/(1+tax/100)),currency:'TRY',vatIncluded:true,vatRate:tax/100,
    packageQuantity,minimumOrderQuantity:minimum*packageQuantity,orderStep:step*packageQuantity,quantityVerified:true,
    stockStatus:stock,stockQuantity:stockAmount===null?(stock==='out_of_stock'?0:null):stockAmount*packageQuantity,specifications:JSON.stringify({description}),warnings:['KDV dahil mağaza fiyatı ve satış birimi doğrulandı.'],priceTiers:[]};
}
export class IdeasoftAdapter extends JsonLdAdapter{
  async getProduct(raw:string){const page=await this.readPage(raw);return parseIdeasoftProduct(page.html,page.url);}
  async getCatalogProduct(raw:string):Promise<ExtractedProduct>{
    const url=safeStoreUrl(raw,this.store.domain);
    const row=(catalog as Record<string,{storeId:string;name:string}>)[this.storeId+':'+url.pathname];
    if(row?.storeId!==this.storeId)return super.getCatalogProduct(raw);
    // A sitemap address can create a requirement; it never supplies a price,
    // VAT, sales quantity or stock proof when the live page is unavailable.
    return {url:raw,name:row.name,mpn:'',model:'',manufacturer:'',image:null,
      price:null,currency:'',vatIncluded:null,vatRate:null,packageQuantity:null,
      quantityVerified:false,stockStatus:'unknown',stockQuantity:null,specifications:'{}',
      warnings:['Bu mağazanın canlı fiyatı şu anda alınamadı. Ürün katalog bağlantısından eklendi; diğer mağazaların doğrulanan teklifleri gösteriliyor.']};
  }
}
