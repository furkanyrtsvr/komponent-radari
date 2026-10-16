import type { Store } from "./domain";

// User-supplied starting values in TRY; calculations use kurus.
export const defaultShipping = [
  ["Direnc.net", 144, 1500],
  ["Robotistan", 149, 1500],
  ["Robo90", 100, 1500],
  ["Robiz", 132, 1000],
  ["Komponentci", 120, 2000],
  ["Robot Sepeti", 130, 2500],
  ["Motorobit", 137, 2500],
  ["Robolink Market", 119, 1500],
  ["SAMM Market", 99, 1500],
  ["Özdisan", 200, 1500],
  ["Robotzade", 149, 3000],
  ["Robitshop", 180, 2000],
  ["Robocombo", 150, 2000],
  ["Robotronik", 120, 2120],
  ["Pil Paketi", 120, 3000],
  ["Pil Sitesi", 120, 1500],
  ["E komponent", 170, 2500],
  ["Ulutaş Elektronik", 175, 1000],
  ["Hobi Devre", 128, 2000],
  ["F1 Depo", 150, 2000],
] as const;

const key = (name: string) => name.toLocaleLowerCase("tr-TR")
  .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
  .replace(/ı/g, "i").replace(/[^a-z0-9]/g, "");
const defaults = new Map(defaultShipping.map(([name, fee, threshold]) =>
  [key(name), { shipping_base_price: fee * 100, free_shipping_threshold: threshold * 100 }]));

export function applyDefaultShipping(store: Store): Store {
  const values = defaults.get(key(store.name));
  return values ? { ...store, ...values, shipping_known: true,
    shipping_default: true, shipping_source_url: null } : store;
}
