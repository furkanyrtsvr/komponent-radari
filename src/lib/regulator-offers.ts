import type {Offer,Product} from './domain';
import {catalogIdentity,matchesCatalogRequirement} from './catalog-identity';
/** Re-check older cached offers against the current board identity rules. */
export function validateRegulatorOffers(offers:Offer[],products:Product[]){
 const byId=new Map(products.map(product=>[product.id,product]));
 return offers.map(offer=>{
  const product=byId.get(offer.canonical_product_id);
  if(offer.source==='live' && product && catalogIdentity(product).startsWith('model:lm2596:module:') && !matchesCatalogRequirement(product,{name:offer.title,manufacturer:offer.manufacturer,specifications:offer.specifications}))
   return {...offer,last_error:'Farklı LM2596 kart sürümü; bu ürünün fiyatına katılmaz.'};
  return offer;
 });
}
