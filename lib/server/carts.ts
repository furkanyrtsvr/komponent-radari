import { dataSource, storesForSource } from "./mode";
import { syncLive, catalogueSources } from "./live";
import type { Cart, CartItem, CartView, Product } from "../domain";
import { id, now, mergeItems } from "../domain";
import { products, demoQuantities } from "../catalog";
import { one, list, listIn, insert, insertBatch, update, HttpError } from "./db";
import type { User } from "./auth";
import { optimize, type Options } from "../optimizer";
import {applyCartShipping,type ShippingSetting} from "../cart-shipping";
import type {OfferSelection} from '../cart-offers';
import {offersForProducts} from './cart-offers';
import {offerAvailability} from '../offer-availability';
export async function access(
  cartId: string,
  userId: string,
  action: "view" | "add" | "edit" | "owner" = "view",
) {
  const cart = await one<Cart>("carts", { id: cartId });
  if (!cart) throw new HttpError(404, "Sepet bulunamadı.");
  const member = await one<{ role: string }>("cart_members", {
    cart_id: cartId,
    user_id: userId,
  });
  const role = cart.owner_id === userId ? "owner" : member?.role;
  if (
    !role ||
    (action === "owner" && role !== "owner") ||
    (action === "edit" && !["owner", "editor"].includes(role)) ||
    (action === "add" && !["owner", "editor", "contributor"].includes(role))
  )
    throw new HttpError(403, "Bu sepet için gerekli yetkiniz yok.");
  return { cart, role };
}
export async function cartView(
  cartId: string,
  userId: string,
): Promise<CartView> {
  const { cart, role } = await access(cartId, userId);
  const [items, members, snapshots,shippingSettings,offerSelections] = await Promise.all([
    list<CartItem>("cart_items", { cart_id: cartId }),
    list<{ user_id: string; role: string }>("cart_members", {
      cart_id: cartId,
    }),
    list<{ id: string; created_at: string; total: number; payload: string }>(
      "cart_snapshots",
      { cart_id: cartId },
    ),
    list<ShippingSetting>("cart_shipping_settings",{cart_id:cartId}),
    list<OfferSelection>('cart_offer_selections',{cart_id:cartId}),
  ]);
  const people=await listIn<User>("users","id",members.map(member=>member.user_id));
  return {
    ...cart,
    role,
    items,
    shippingSettings,
    offerSelections,
    members: members.map((m, i) => ({
      ...m,
      label: m.user_id === userId ? "Sen" : people.find(person=>person.id===m.user_id)?.display_name || `Katılımcı ${i + 1}`,
    })),
    snapshots: snapshots.sort((a, b) =>
      b.created_at.localeCompare(a.created_at),
    ),
  };
}
export async function userCarts(userId: string) {
  const memberships = await list<{ cart_id: string }>("cart_members", {
    user_id: userId,
  });
  return (
    await Promise.all(
      memberships.map((m) => one<Cart>("carts", { id: m.cart_id })),
    )
  ).filter((c): c is Cart => Boolean(c));
}
export function makeItem(
  cartId: string,
  productId: string,
  quantity: number,
  userId: string,
): CartItem {
  return {
    id: id(),
    cart_id: cartId,
    canonical_product_id: productId,
    quantity,
    added_by: userId,
    notes: "",
    allow_alternative: 0,
    preferred_manufacturer: "",
    maximum_unit_price: null,
    created_at: now(),
  };
}
export async function createCart(
  u: User,
  name: string,
  demo = false,
  sourceItems?: CartItem[],
) {
  const source = await dataSource();
  const cart: Cart = {
    id: id(),
    owner_id: u.id,
    name,
    created_at: now(),
    updated_at: now(),
    data_source: source,
  };
  const items = sourceItems
    ? mergeItems([sourceItems], cart.id)
    : demo
      ? products
          .slice(0, 8)
          .map((p, i) => makeItem(cart.id, p.id, demoQuantities[i], u.id))
      : [];
  await insertBatch([
    { table: "carts", row: cart },
    {
      table: "cart_members",
      row: { id: id(), cart_id: cart.id, user_id: u.id, role: "owner" },
    },
    ...items.map((row) => ({ table: "cart_items", row })),
  ]);
  return cartView(cart.id, u.id);
}
export async function cartOptimization(
  cartId: string,
  userId: string,
  options: Options = {},
) {
  const view = await cartView(cartId, userId),
    source = await dataSource();
  let refresh:Awaited<ReturnType<typeof syncLive>>|null=null;
  const products=await listIn<Product>('canonical_products','id',view.items.map(item=>item.canonical_product_id));
  let [offers, stores] = await Promise.all([
    offersForProducts(products,source,view.offerSelections),
    storesForSource(source),
  ]);
  // A basket with observed prices can be calculated immediately. Refresh only
  // missing products here; the workspace already renews prices independently.
  const missingPrices=[...new Set(view.items.filter(item=>offerAvailability(offers.filter(o=>o.canonical_product_id===item.canonical_product_id && (!item.preferred_manufacturer||o.manufacturer===item.preferred_manufacturer)),item.quantity,{stores:options.selectedStores,exact:options.exactOnly,allowLastKnown:options.allowLastKnown!==false}).price===null).map(item=>item.canonical_product_id))];
  if(source==='live' && missingPrices.length){refresh=await syncLive(missingPrices);offers=await offersForProducts(products,source,view.offerSelections);}
  const shippingEstimate = options.shippingEstimate ?? 8000;
  const result = optimize(
    view.items,
    offers.filter(offer=>!offer.excluded),
    applyCartShipping(stores,view.shippingSettings || [],shippingEstimate).map((s) =>
      source === "live" && !s.shipping_known
        ? { ...s, shipping_base_price: shippingEstimate }
        : s,
    ),
    { exactOnly: source === "demo", allowLastKnown:source==='live', ...options },
  );
  if(source==='live') {
    const products=await Promise.all(result.comparison?.map(row=>one<Product>('canonical_products',{id:row.productId})) || []);
    result.comparison?.forEach((row,i)=>{
      const p=products[i];
      if(!p) return;
      const known=new Set(catalogueSources(p).map(s=>s.storeId));
      for(const cell of row.cells) if(!cell.offer && cell.reason==='Teklif yok' && known.has(cell.storeId)) cell.reason='Mağaza kaydı var; fiyat veya eşleşme doğrulanamadı';
    });
  }
  return {
    ...result,
    shippingEstimated: source === "live" && [...result.scenarios,...(result.exactScenarios || [])].some(scenario=>scenario.groups.some(group=>stores.some(store=>store.id===group.storeId && !store.shipping_known && !(view.shippingSettings || []).some(rule=>rule.store_id===store.id)))),
    shippingAssumption: source === "live" ? shippingEstimate : null,
    ...(refresh ? {refreshSummary:{checked:refresh.checked,cached:refresh.cached,failed:refresh.failed,retained:refresh.retained,message:refresh.message}}:{}),
  };
}
export async function createLiveStarter(u: User) {
  return createCart(u,"Alışveriş sepetim");
}
export async function touchCart(cartId: string) {
  await update("carts", { updated_at: now() }, { id: cartId });
}
export async function joinShare(token: string, u: User) {
  const share = await one<{
    cart_id: string;
    role: string;
    expires_at: string;
  }>("cart_shares", { id: token });
  if (!share || share.expires_at < now())
    throw new HttpError(
      404,
      "Paylaşım bağlantısı bulunamadı veya süresi doldu.",
    );
  const existing = await one<{ id: string; role: string }>("cart_members", {
    cart_id: share.cart_id,
    user_id: u.id,
  });
  const ranks: Record<string, number> = {
    viewer: 0,
    contributor: 1,
    editor: 2,
    owner: 3,
  };
  if (existing && ranks[share.role] > ranks[existing.role])
    await update("cart_members", { role: share.role }, { id: existing.id });
  if (!existing)
    await insert("cart_members", {
      id: id(),
      cart_id: share.cart_id,
      user_id: u.id,
      role: share.role,
    });
  await touchCart(share.cart_id);
  return cartView(share.cart_id, u.id);
}
