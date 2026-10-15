import {list,listIn,insertIgnoreBatch,update,config} from "./db";
import {storeCatalog} from "../catalog";
import {seedProducts,seedReady,seedEntries,changedDemoOffers} from "../seed-plan";
import {startupGate} from "../startup";

export const ensureSeed=startupGate(seed);
async function seed(){
  const testData=config("ENABLE_TEST_DATA")==="true";
  const [stores,canonical,offers]=await Promise.all([
    list<{id:string}>("stores"),
    listIn<{id:string}>("canonical_products","id",seedProducts.map(product=>product.id)),
    testData?list<{id:string;price_net:number;price_gross:number;unit_price:number}>("store_offers",{source:"demo"}):Promise.resolve([]),
  ]);
  // A populated production database requires reads only on cold start.
  if(testData?seedReady(stores,canonical,offers):storeCatalog.every(store=>stores.some(row=>row.id===store.id))&&seedProducts.every(product=>canonical.some(row=>row.id===product.id)))return;
  await insertIgnoreBatch(seedEntries().filter(entry=>testData || entry.table==="stores" || entry.table==="canonical_products"));
  for(const offer of changedDemoOffers(offers))
    await update("store_offers",{price_net:offer.price_net,price_gross:offer.price_gross,unit_price:offer.unit_price},{id:offer.id});
}
