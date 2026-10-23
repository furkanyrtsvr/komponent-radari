import type {Offer} from './domain';
import {isFresh,quoteOffer,hasObservedPrice} from './pricing';
export type Availability={price:number|null;previousPrice?:number;label:string;note:string;offer?:Offer};
/** A missing quote is not evidence that no merchant offer exists. */
export function offerAvailability(offers:Offer[],quantity=1,options:{stores?:string[];exact?:boolean;refreshing?:boolean;at?:number;allowLastKnown?:boolean}={}):Availability{
 const selected=offers.filter(o=>!o.excluded&&!o.variant_conflict&&(!options.stores||options.stores.includes(o.store_id))&&(!options.exact||o.match_confidence===100));
 const quote=(o:Offer)=>quoteOffer(o,quantity);
 const enough=(o:Offer)=>o.stock_quantity===null||o.stock_quantity>=quote(o).purchasedQuantity;
 const valid=selected.filter(o=>hasObservedPrice(o,options.at)&&Number.isSafeInteger(quote(o).cost)&&quote(o).cost>0);
 const fresh=valid.filter(o=>isFresh(o,options.at));
 const usable=options.allowLastKnown?valid:fresh;
 const available=usable.filter(o=>o.stock_status==='in_stock'&&enough(o)).sort((a,b)=>quote(a).cost-quote(b).cost || Date.parse(b.last_checked_at)-Date.parse(a.last_checked_at));
 if(available[0]){const current=isFresh(available[0],options.at);return {price:quote(available[0]).cost,label:current?'Stokta':'Son alınan fiyat',note:current?'KDV dahil':`KDV dahil · son kontrol ${new Date(available[0].last_checked_at).toLocaleString('tr-TR')}`,offer:available[0]};}
 const previous=valid.filter(o=>o.stock_status==='in_stock'&&enough(o)).sort((a,b)=>Date.parse(b.last_checked_at)-Date.parse(a.last_checked_at));
 if(previous[0])return {price:null,previousPrice:quote(previous[0]).cost,label:options.refreshing?'Fiyat yenileniyor':'Güncelleme gerekli',note:'Son doğrulanmış fiyat; güncel sepet hesabına henüz dahil değil',offer:previous[0]};
 if(!selected.length)return {price:null,label:offers.length?(offers.every(o=>o.variant_conflict)?'Farklı varyant bulundu':'Filtre dışında'):options.refreshing?'Kontrol ediliyor':'Henüz doğrulanmadı',note:offers.length?'Mağaza seçimi, eşleşme filtresi veya ürün varyantını kontrol edin':'Mağaza fiyatı ve stok durumu kontrol edilmeli'};
 if(fresh.some(o=>o.stock_status==='in_stock'))return {price:null,label:'Adet için stok yetersiz',note:'İhtiyaç adedi, satış paketi veya minimum sipariş stoktan fazla'};
 if(fresh.some(o=>o.stock_status==='unknown'))return {price:null,label:'Stok doğrulanamadı',note:'Fiyat bulundu; mağazanın stok bilgisi doğrulanamadı'};
 if(fresh.length)return {price:null,label:'Stokta yok',note:'Son kontrolde seçili teklifler tükenmişti'};
 return {price:null,label:options.refreshing?'Kontrol ediliyor':'Yenileme gerekli',note:'Teklif kaydı var; güncel fiyat veya stok kontrolü gerekiyor'};
}
