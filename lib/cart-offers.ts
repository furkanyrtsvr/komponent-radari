import type {Offer,Product} from './domain';
import {nameCandidateKeys,nameMatchScore,potentiometerDetails} from '../public/catalog/product-identity.js';
import {matchesCatalogRequirement,variantConflict} from './catalog-identity';
export type OfferSelection={id:string;cart_id:string;canonical_product_id:string;offer_id:string;excluded:number;updated_at:string};
/** Reversible cart-local decisions. Original product IDs and merchant prices stay intact. */
export function cartOffers(offers:Offer[],products:Product[],targets:Product[],selections:OfferSelection[]=[]){
 const byKey=new Map<string,Offer[]>();
 const byProduct=new Map<string,Offer[]>();
 const merchantFacts=new Map(offers.map(offer=>[offer,{name:offer.title,manufacturer:offer.manufacturer,specifications:offer.specifications}]));
 const facts=(offer:Offer)=>merchantFacts.get(offer)!;
 for(const offer of offers){
  const own=byProduct.get(offer.canonical_product_id)||[];own.push(offer);byProduct.set(offer.canonical_product_id,own);
  for(const key of nameCandidateKeys(facts(offer))){const rows=byKey.get(key)||[];rows.push(offer);byKey.set(key,rows);}
 }
 const decisions=new Map(selections.map(row=>[row.canonical_product_id+':'+row.offer_id,Boolean(row.excluded)]));
 const result:Offer[]=[];
 for(const product of targets){
  const candidates=[...(byProduct.get(product.id)||[]),...nameCandidateKeys(product).flatMap(key=>byKey.get(key)||[])];
  const seen=new Set<string>();
  for(const offer of candidates){
   if(seen.has(offer.id))continue;seen.add(offer.id);
   const own=offer.canonical_product_id===product.id;
   if(!own && (offer.source!=='live' || nameMatchScore(product,facts(offer))<0.65))continue;
   const related=offer.source==='live' && !matchesCatalogRequirement(product,facts(offer));
   // Recheck even already-linked records: historical catalog merges cannot
   // override the title of the actual merchant item being sold.
   const conflict=offer.source==='live'?(variantConflict(product,facts(offer)) || (potentiometerDetails(product)&&!potentiometerDetails(facts(offer))?'Ayarlı direncin fiziksel türü mağaza açıklamasından doğrulanamadı':'')):'';
   result.push({...offer,id:own?offer.id:`${offer.id}@${product.id}`,canonical_product_id:product.id,original_offer_id:offer.id,name_match:Number(related),variant_conflict:conflict,excluded:Number(decisions.get(product.id+':'+offer.id)||false),...(conflict?{match_type:'different_variant',match_confidence:0}:related?{match_type:'verified',match_confidence:70}:{})});
  }
 }
 return result;
}
