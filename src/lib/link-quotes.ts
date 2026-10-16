import {isFresh,quoteOffer,hasObservedPrice} from "./pricing";
import type {Offer,Store} from "./domain";
export function linkQuotes(offers:Offer[],stores:Store[],quantity:number,includeExcluded=false,allowLastKnown=false){
  const quotes=offers.filter(offer=>(includeExcluded || !offer.excluded)&&(isFresh(offer)||allowLastKnown&&hasObservedPrice({...offer,excluded:0,variant_conflict:''}))&&offer.stock_status==="in_stock").flatMap(offer=>{
    const store=stores.find(store=>store.id===offer.store_id && store.enabled);
    if(!store)return [];
    const quote=quoteOffer(offer,quantity);
    if(offer.stock_quantity!==null && offer.stock_quantity<quote.purchasedQuantity)return [];
    const shipping=store.free_shipping_threshold!==null && quote.cost>=store.free_shipping_threshold ? 0 : store.shipping_base_price;
    return [{storeId:store.id,store:store.name,offerId:offer.id,originalOfferId:offer.original_offer_id || offer.id,title:offer.title,image:offer.image_url,nameMatch:Boolean(offer.name_match),variantConflict:offer.variant_conflict||'',excluded:Boolean(offer.excluded),url:offer.product_url,productTotal:quote.cost,shipping,total:quote.cost+shipping,purchasedQuantity:quote.purchasedQuantity,estimated:store.shipping_known===false,checkedAt:offer.last_checked_at,lastKnown:!isFresh(offer)}];
  });
  return quotes.sort((a,b)=>a.total-b.total || a.store.localeCompare(b.store));
}
