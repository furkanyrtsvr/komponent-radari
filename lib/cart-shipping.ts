import type {Store} from "./domain";
export type ShippingSetting={id:string;cart_id:string;store_id:string;shipping_price:number;free_shipping_threshold:number|null;updated_at:string};
export function applyCartShipping(stores:Store[],settings:ShippingSetting[],estimate=8000){
  const rules=new Map(settings.map(rule=>[rule.store_id,rule]));
  return stores.map(store=>{
    const rule=rules.get(store.id);
    return rule ? {...store,shipping_base_price:rule.shipping_price,free_shipping_threshold:rule.free_shipping_threshold,shipping_known:true,shipping_manual:true,shipping_source_url:null}
      : {...store,shipping_base_price:store.shipping_known===false?estimate:store.shipping_base_price};
  });
}
