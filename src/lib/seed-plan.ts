import {liveProducts} from "../stores/live-catalog";
import {products,demoOffers,storeCatalog,seedTime} from "./catalog";

export const seedProducts=[...products,...liveProducts];
type ExistingOffer={id:string;price_net:number;price_gross:number;unit_price:number};
export function changedDemoOffers(existing:ExistingOffer[]){
  const byId=new Map(existing.map(offer=>[offer.id,offer]));
  return demoOffers.filter(offer=>{
    const saved=byId.get(offer.id);
    return saved && (saved.price_net!==offer.price_net || saved.price_gross!==offer.price_gross || saved.unit_price!==offer.unit_price);
  });
}
export function seedReady(stores:{id:string}[],canonical:{id:string}[],offers:ExistingOffer[]){
  const storeIds=new Set(stores.map(row=>row.id)),productIds=new Set(canonical.map(row=>row.id)),offerIds=new Set(offers.map(row=>row.id));
  return storeCatalog.every(row=>storeIds.has(row.id)) && seedProducts.every(row=>productIds.has(row.id)) && demoOffers.every(row=>offerIds.has(row.id)) && !changedDemoOffers(offers).length;
}
export function seedEntries():{table:string;row:object}[]{
  return [
    ...storeCatalog.map(row=>({table:"stores",row})),
    ...seedProducts.map(row=>({table:"canonical_products",row})),
    ...demoOffers.map(offer=>({table:"store_products",row:{id:offer.store_product_id,store_id:offer.store_id,url:`${offer.product_url}/#${offer.canonical_product_id}`,title:offer.title,mpn:offer.mpn,raw_data:'{"source":"demo"}'}})),
    ...demoOffers.map(row=>({table:"store_offers",row})),
    ...demoOffers.map(offer=>({table:"price_history",row:{id:`history-${offer.id}`,offer_id:offer.id,price_gross:offer.price_gross,stock_status:offer.stock_status,checked_at:seedTime}})),
  ];
}
