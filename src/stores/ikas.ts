import {load} from 'cheerio';
import {parseProduct,parsePrice} from './base';
import {ascii} from '../../public/catalog/product-identity.js';
/** New Robocombo storefront: reconcile the selected product/variant with its own public offer. */
export function parseIkasProduct(html:string,url:string){
 const $=load(html),p=parseProduct(html,url);
 const raw=$('#__NEXT_DATA__').text()||html.match(/<script\b(?=[^>]*\bid=["']__NEXT_DATA__["'])(?=[^>]*\btype=["']application\/json["'])[^>]*>([\s\S]*?)<\/script>/i)?.[1]||'';
 const root=JSON.parse(raw).props?.pageProps,d=root?.pageSpecificData;
 if(!d||d.type!=='PHYSICAL'||d.deleted||ascii(d.name)!==ascii(p.name)||d.metaData?.slug!==new URL(url).pathname.replace(/^\//,'').replace(/\/$/,''))throw new Error('Mağaza ana ürün kimliği doğrulanamadı.');
 const requested=new URL(url).searchParams.get('vid'),variants=(d.variants||[]).filter((v:any)=>v.isActive&&!v.deleted&&(!requested||v.id===requested));
 if(variants.length!==1)throw new Error('Ürün varyantı belirsiz; varyant seçilmeli.');
 const v=variants[0],prices=(v.prices||[]).filter((r:any)=>r.currencyCode==='TRY').flatMap((r:any)=>[r.campaignPrice,r.discountPrice,r.sellPrice]).filter((n:any)=>typeof n==='number'&&n>0).map(parsePrice);
 if(!p.price||p.currency!=='TRY'||!prices.includes(p.price)||!/Fiyatlarımıza\s+KDV\s+dahildir/i.test($.root().text().replace(/\s+/g,' ')))throw new Error('Mağaza KDV dahil fiyatı doğrulanamadı.');
 const channels=(d.salesChannels||[]).filter((c:any)=>c.status==='VISIBLE');
 if(channels.length!==1||channels[0].quantitySettings||channels[0].minQuantityPerCart!=null||v.unit!=null)throw new Error('Mağaza satış adımı doğrulanamadı.');
 const stock=Number(v.stock),pack=p.packageQuantity||1;
 if(!Number.isSafeInteger(stock)||stock<0||stock===0&&p.stockStatus==='in_stock'||stock>0&&p.stockStatus==='out_of_stock')throw new Error('Mağaza stok bilgisi çelişiyor.');
 return {...p,vatIncluded:true,priceNet:null,packageQuantity:pack,minimumOrderQuantity:pack,orderStep:pack,quantityVerified:true,stockQuantity:stock*pack,specifications:JSON.stringify({description:d.description||''}),warnings:[...p.warnings,'Seçili mağaza ürünü, TRY fiyatı, KDV, satış birimi ve stok tutarlılığı doğrulandı.']};
}
