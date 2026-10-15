import { load } from 'cheerio';
import { JsonLdAdapter, parseProduct, parsePrice } from '../base';
import { jumperDetails } from '../../lib/catalog-identity';
import { ascii } from '../../public/catalog/product-identity.js';
import type { ExtractedProduct } from '../types';

type Data = Record<string, any>;
export function parseSammProduct(html:string,url:string):ExtractedProduct {
  const p=parseProduct(html,url), $=load(html);
  let next:Data; try { next=JSON.parse($('#__NEXT_DATA__').text()); } catch { throw new Error('SAMM ürün verisi okunamadı.'); }
  const d=next.props?.pageProps?.pageSpecificData;
  const slug=new URL(url).pathname.replace(/^\//,'').replace(/\/$/,'');
  if(!d || d.type!=='PHYSICAL' || d.deleted || ascii(d.name)!==ascii(p.name) || d.metaData?.slug!==slug) throw new Error('SAMM ana ürün kimliği doğrulanamadı.');
  const requested=new URL(url).searchParams.get('vid');
  const variants=(d.variants||[]).filter((v:Data)=>v.isActive&&!v.deleted&&(!requested||v.id===requested));
  if(variants.length!==1)throw new Error('SAMM ürün varyantı belirsiz; varyant adresini seçin.');
  const v=variants[0];
  // Null-price-list entries can be USD base amounts despite their TRY label.
  // Only the price that reconciles exactly with the selected public Offer is used.
  const candidates=(v.prices||[]).flatMap((r:Data)=>[r.campaignPrice,r.discountPrice,r.sellPrice].filter((n:unknown)=>typeof n==='number'&&n>0).map((n:number)=>({row:r,value:parsePrice(n)}))).filter((r:Data)=>r.row.currencyCode==='TRY'&&r.value===p.price);
  if(!candidates.length || !p.price || p.currency!=='TRY')throw new Error('SAMM ödenecek fiyatı doğrulanamadı.');
  const scope=$('h1').first().parent().parent();
  const netLabels=scope.find('div,span').map((_,e)=>$(e).clone().children().remove().end().text().trim()).get().filter(t=>/^[\d.,]+\s*₺\s*\+\s*KDV$/i.test(t));
  const netLabel=netLabels.length===1?netLabels[0].match(/^([\d.,]+)\s*₺/):null;
  const net=netLabel?parsePrice(netLabel[1]):null;
  const visible=scope.find('[class*="final-price"]').map((_,e)=>parsePrice($(e).text())).get();
  if(net===null || net<=0 || net>=p.price || !visible.includes(p.price))throw new Error('SAMM görünür KDV dahil fiyatı doğrulanamadı.');
  const controls=scope.find('input[value="1"]').filter((_,e)=>{
    const parent=$(e).parent();return parent.find('button').length===2&&parent.find('button').first().is('[disabled]');
  });
  const channels=(d.salesChannels||[]).filter((c:Data)=>c.status==='VISIBLE');
  if(channels.length!==1 || channels[0].quantitySettings || channels[0].minQuantityPerCart!=null || !controls.length)throw new Error('SAMM satış miktarı veya satış adımı doğrulanamadı.');
  const description=load(String(d.description||'')).text().replace(/\s+/g,' ').trim();
  // The product title omits length; enrich only from an unambiguous description.
  let name=p.name;
  if(/jumper/i.test(name)&&!jumperDetails(name)){
    const lengths=[...description.matchAll(/\b(\d+)\s*cm\b/gi)].map(m=>Number(m[1]));
    const unique=[...new Set(lengths)];
    if(unique.length!==1)throw new Error('SAMM jumper kablo uzunluğu doğrulanamadı.');
    name+=` ${unique[0]}cm`;
  }
  const pack=jumperDetails(name)?1:p.packageQuantity||1;
  const stock=Number(v.stock);
  if(!Number.isSafeInteger(stock)||stock<0 || typeof v.sellIfOutOfStock!=='boolean')throw new Error('SAMM stok miktarı doğrulanamadı.');
  return {...p,name,priceNet:net,vatIncluded:true,vatRate:null,packageQuantity:pack,minimumOrderQuantity:pack,orderStep:pack,quantityVerified:true,
    stockQuantity:stock*pack,stockStatus:stock>0?'in_stock':v.sellIfOutOfStock?'unknown':'out_of_stock',specifications:JSON.stringify({description}),
    warnings:['SAMM seçili varyantının KDV dahil fiyatı, satış birimi ve stok miktarı mağaza sayfasından doğrulandı.','Kargo ücreti ödeme ekranında doğrulanmalıdır.']};
}
export class SammAdapter extends JsonLdAdapter {
  async getProduct(raw:string){const page=await this.readPage(raw);return parseSammProduct(page.html,page.url);}
  async getShippingRules(){return{estimated:true,available:false,sourceUrl:'https://market.samm.com/pages/teslimat-kosullari'};}
}
