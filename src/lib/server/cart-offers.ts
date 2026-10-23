import {salesUnit} from '../sales-unit';
import {pages,listIn} from './db';
import type {Offer,Product} from '../domain';
import {cartOffers,type OfferSelection} from '../cart-offers';
import {nameCandidateKeys,nameMatchScore} from '../../../public/catalog/product-identity.js';
import {validateRegulatorOffers} from '../regulator-offers';
import {phaseOffers} from './snapshots';
import {ascii} from '../../../public/catalog/product-identity.js';
export async function offersForProducts(targets:Product[],source:string,selections:OfferSelection[]=[]){
 const byKey=new Map<string,Product[]>();
 for(const product of targets)for(const key of nameCandidateKeys(product)){const rows=byKey.get(key)||[];rows.push(product);byKey.set(key,rows);}
 const products:Product[]=[];
 const ids=new Set(targets.map(product=>product.id));
 for await(const page of pages<Product>('canonical_products'))products.push(...page.filter(product=>ids.has(product.id) || source==='live' && nameCandidateKeys(product).some(key=>(byKey.get(key)||[]).some(target=>nameMatchScore(target,product)>=0.65))));
 const offers=await listIn<Offer>('store_offers','canonical_product_id',products.map(product=>product.id),{source});
 const raw=await listIn<{id:string;raw_data:string}>('store_products','id',offers.map(offer=>offer.store_product_id));
 const metadata=new Map(raw.map(row=>{try{const p=JSON.parse(row.raw_data);return [row.id,p] as const;}catch{return [row.id,null] as const;}}));
 for(const offer of offers){const p=metadata.get(offer.store_product_id);if(p&&ascii(p.name)===ascii(offer.title)){offer.specifications=p.specifications;offer.unit_type=salesUnit(p);}}
 // Own merchant descriptions are used once on the server. Sending the same
 // long description again for every basket alias needlessly inflates bootstrap.
 return cartOffers(await phaseOffers(validateRegulatorOffers(offers,products)),products,targets,selections).map(offer=>{
  delete offer.specifications;return offer;
 });
}
