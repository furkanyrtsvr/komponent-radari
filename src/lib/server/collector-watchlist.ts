import {binding,isSupabase,pages,listIn} from './db';
import {COLLECTOR_WATCHLIST_SQL} from '../collector-watchlist';
export async function collectorWatchlist(){
 if(!isSupabase())return (await binding().prepare(COLLECTOR_WATCHLIST_SQL).all<{storeId:string;url:string}>()).results;
 const ids=new Set<string>(),cartIds:string[]=[];
 for await(const batch of pages<{id:string}>('carts',{data_source:'live'}))cartIds.push(...batch.map(c=>c.id));
 for(const row of await listIn<{canonical_product_id:string}>('cart_items','cart_id',cartIds))ids.add(row.canonical_product_id);
 for(const table of ['favorites','price_alerts','stock_alerts'])for await(const batch of pages<{canonical_product_id:string}>(table,table==='favorites'?{}:{enabled:1}))for(const row of batch)ids.add(row.canonical_product_id);
 const offers=await listIn<{store_id:string;product_url:string}>('store_offers','canonical_product_id',[...ids],{source:'live'});
 return [...new Map(offers.map(o=>[o.store_id+':'+o.product_url,{storeId:o.store_id,url:o.product_url}])).values()].sort((a,b)=>a.storeId.localeCompare(b.storeId)||a.url.localeCompare(b.url)).slice(0,2000);
}
