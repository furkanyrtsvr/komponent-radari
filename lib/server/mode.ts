import { cookies } from "next/headers";
import { storeCatalog } from "../catalog";
import type { Store } from "../domain";
import { list,config } from "./db";
import { verifiedShippingRule } from "../shipping";
import { applyDefaultShipping } from "../default-shipping";
export async function dataSource(): Promise<"live" | "demo"> {
  return config("ENABLE_TEST_DATA")==="true" && (await cookies()).get("eub_data_mode")?.value === "demo"
    ? "demo"
    : "live";
}
export async function storesForSource(source: string): Promise<Store[]> {
  const stores = await list<Store>("stores");
  if (source === "demo")
    return stores.map((s) => ({
      ...s,
      shipping_base_price:
        storeCatalog.find((x) => x.id === s.id)?.shipping_base_price ??
        s.shipping_base_price,
      free_shipping_threshold:
        storeCatalog.find((x) => x.id === s.id)?.free_shipping_threshold ??
        null,
    }));
  const rules = await list<{
    store_id: string;
    rules: string;
    estimated: number;
    last_updated:string;
    source_url:string|null;
  }>("store_shipping_rules");
  return stores.map((s) => {
    const shipping = rules.filter(rule=>rule.store_id===s.id)
      .sort((a,b)=>b.last_updated.localeCompare(a.last_updated))
      .map(rule=>verifiedShippingRule(rule,s.domain)).find(Boolean);
    return applyDefaultShipping({
      ...s,
      shipping_base_price: 0,
      free_shipping_threshold: shipping?.free_shipping_threshold ?? null,
      shipping_known: false,
      shipping_source_url: shipping?.source_url ?? null,
    });
  });
}
