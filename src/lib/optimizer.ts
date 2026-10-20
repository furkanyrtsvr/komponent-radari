import { quoteOffer, isFresh, hasObservedPrice } from "./pricing";
import type {
  CartItem,
  Offer,
  Store,
  Scenario,
  Allocation,
  Optimization,
} from "./domain";
export type Options = {
  maxStores?: number;
  exactOnly?: boolean;
  selectedStores?: string[];
  minimumSaving?: number;
  nodeLimit?: number;
  timeLimitMs?: number;
  allowLastKnown?: boolean;
};
// Exhaustive branch-and-bound. Free shipping is non-monotonic; never prune by current shipping.
// A bounded run reports optimal=false rather than claiming an unproven mathematical minimum.
export function optimize(
  items: CartItem[],
  offers: Offer[],
  stores: Store[],
  options: Options = {},
): Optimization {
  const enabled = stores.filter(
    (s) =>
      s.enabled &&
      (options.selectedStores === undefined ||
        options.selectedStores.includes(s.id)),
  );
  const index = new Map(enabled.map((s, i) => [s.id, i]));
  const storeMap = new Map(enabled.map((s) => [s.id, s]));
  const groups = new Map<string, CartItem[]>();
  for (const i of items) {
    const key = [
      i.canonical_product_id,
      i.allow_alternative,
      i.preferred_manufacturer,
      i.maximum_unit_price,
    ].join("|");
    groups.set(key, [...(groups.get(key) || []), i]);
  }
  const tasks = [...groups.values()]
    .map((group) => {
      const item = group[0],
        quantity = group.reduce((n, x) => n + x.quantity, 0);
      const candidates = offers
        .filter(
          (o) =>
            o.canonical_product_id === item.canonical_product_id &&
            index.has(o.store_id) &&
            o.currency === "TRY" &&
            (isFresh(o) || Boolean(options.allowLastKnown && hasObservedPrice(o))) &&
            o.stock_status === "in_stock" &&
            ((o.match_type === "exact" && o.match_confidence === 100) ||
              (!options.exactOnly &&
                (o.match_type === "verified" ||
                  (item.allow_alternative &&
                    o.match_type === "alternative")))) &&
            (!item.preferred_manufacturer ||
              o.manufacturer === item.preferred_manufacturer),
        )
        .map((o) => ({
          offer: o,
          ...quoteOffer(o, quantity),
        }))
        .filter(
          (c) =>
            Number.isSafeInteger(c.cost) && c.cost>0 &&
            (c.offer.stock_quantity === null ||
              c.offer.stock_quantity >=
                c.packages * c.offer.package_quantity) &&
            (item.maximum_unit_price === null ||
              c.cost <= quantity * item.maximum_unit_price),
        )
        .sort((a, b) => a.cost - b.cost || index.get(a.offer.store_id)!-index.get(b.offer.store_id)! || a.offer.product_url.localeCompare(b.offer.product_url) || a.offer.id.localeCompare(b.offer.id));
      return { group, quantity, candidates };
    })
    .sort((a, b) => a.candidates.length - b.candidates.length || a.group[0].canonical_product_id.localeCompare(b.group[0].canonical_product_id));
  const missing = tasks
    .filter((t) => !t.candidates.length)
    .map((t) => t.group[0].canonical_product_id);
  const eligibleStoreIds = [...new Set(tasks.flatMap(t => t.candidates.map(c => c.offer.store_id)))];
  const eligibleOffers = [...new Map(tasks.flatMap(task=>task.candidates.map(candidate=>[candidate.offer.id,candidate.offer] as const))).values()];
  // Keep every selected merchant in the comparison. A merchant without a
  // usable quote is still useful information: the table can explain whether
  // the product is missing, stale or out of stock instead of making it look
  // as though only the merchants with quotes were compared.
  const comparedStoreIds = enabled.map((s) => s.id);
  const comparison = tasks.map(t => ({
    productId: t.group[0].canonical_product_id,
    itemIds: t.group.map(i => i.id),
    quantity: t.quantity,
    cells: comparedStoreIds.map(storeId => {
      const candidate = t.candidates.find(c => c.offer.store_id === storeId);
      if (candidate) return { storeId, offer: candidate.offer, cost: candidate.cost, purchasedQuantity: candidate.purchasedQuantity };
      const available = offers.filter(o => o.store_id === storeId && o.canonical_product_id === t.group[0].canonical_product_id);
      const reason = !available.length ? "Teklif yok"
        : available.every(o=>o.variant_conflict) ? "Farklı ürün varyantı; sepet hesabına dahil değil"
        : available.every(o=>o.last_error && /model|aksesuar|başlık|paket/i.test(o.last_error)) ? "Ürün modeli veya satış paketi eşleşmiyor"
        : available.every(o => !isFresh(o)) ? "Fiyat yenilenmeli"
        : available.filter(o=>isFresh(o)).every(o => o.stock_status !== "in_stock") ? "Stokta yok / stok doğrulanmadı" : "Adet veya ürün tercihlerine uygun değil";
      return { storeId, reason };
    }),
  }));
  if (missing.length || !items.length)
    return {
      scenarios: [],
      exactScenarios: [],
      eligibleStoreIds, comparedStoreIds, comparison, eligibleOffers,
      missing,
      optimal: true,
      nodes: 0,
      recommendedMax: 0,
      generatedAt: new Date().toISOString(),
      source: "none",
    };
  const upperMax = Math.min(options.maxStores || enabled.length, enabled.length);
  const max = Math.min(
    upperMax,
    eligibleStoreIds.length,
    tasks.length,
  );
  const best: (Scenario | undefined)[] = Array(max + 1);
  const subtotals = enabled.map(() => 0);
  const used = enabled.map(() => 0);
  const reserved = new Map<string, number>();
  const chosen: (typeof tasks)[0]["candidates"][0][] = [];
  let nodes = 0,
    exhausted = false;
  const start = Date.now();
  const suffix = Array(tasks.length + 1).fill(0);
  for (let i = tasks.length - 1; i >= 0; i--)
    suffix[i] = suffix[i + 1] + tasks[i].candidates[0].cost;
  function record(cost: number, count: number) {
    const shipping = subtotals.reduce(
      (n, total, i) =>
        n +
        (used[i]
          ? enabled[i].free_shipping_threshold !== null &&
            total >= enabled[i].free_shipping_threshold!
            ? 0
            : enabled[i].shipping_base_price
          : 0),
      0,
    );
    const total = cost + shipping;
    if (best[count] && best[count]!.total <= total) return;
    const lines: Allocation[] = tasks.flatMap((task, i) => {
      const c = chosen[i];
      let remaining = c.cost;
      return task.group.map((item, j) => {
        const lineCost =
          j === task.group.length - 1
            ? remaining
            : Math.floor((c.cost * item.quantity) / task.quantity);
        remaining -= lineCost;
        return {
          itemId: item.id,
          productId: item.canonical_product_id,
          offerId: c.offer.id,
          storeId: c.offer.store_id,
          quantity: item.quantity,
          packages: j === 0 ? c.packages : 0,
          purchasedQuantity:
            j === 0 ? c.packages * c.offer.package_quantity : 0,
          total: lineCost,
          addedBy: item.added_by,
        };
      });
    });
    best[count] = {
      maxStores: count,
      storeCount: count,
      productTotal: cost,
      shippingTotal: shipping,
      total,
      savings: 0,
      groups: enabled
        .filter((_, i) => used[i])
        .map((s) => {
          const subtotal = subtotals[index.get(s.id)!],
            free =
              s.free_shipping_threshold !== null &&
              subtotal >= s.free_shipping_threshold;
          return {
            storeId: s.id,
            subtotal,
            shipping: free ? 0 : s.shipping_base_price,
            freeShipping: free,
            lines: lines.filter((l) => l.storeId === s.id),
          };
        }),
    };
  }
  function walk(depth: number, cost: number, count: number) {
    if (exhausted) return;
    if (
      ++nodes > (options.nodeLimit ?? 3000000) ||
      (nodes % 1024 === 0 && Date.now() - start > (options.timeLimitMs ?? 3500))
    ) {
      exhausted = true;
      return;
    }
    if (depth === tasks.length) {
      record(cost, count);
      return;
    }
    const lower = cost + suffix[depth];
    let couldImprove = false;
    for (
      let k = Math.max(1, count);
      k <= Math.min(max, count + tasks.length - depth);
      k++
    )
      if (!best[k] || lower < best[k]!.total) {
        couldImprove = true;
        break;
      }
    if (!couldImprove) return;
    for (const c of tasks[depth].candidates) {
      const needed = c.packages * c.offer.package_quantity;
      const stockKey=c.offer.original_offer_id || c.offer.id;
      const held = reserved.get(stockKey) || 0;
      if (
        c.offer.stock_quantity !== null &&
        held + needed > c.offer.stock_quantity
      )
        continue;
      const si = index.get(c.offer.store_id)!;
      const isNew = used[si] === 0;
      if (isNew && count === max) continue;
      reserved.set(stockKey, held + needed);
      used[si]++;
      subtotals[si] += c.cost;
      chosen[depth] = c;
      walk(depth + 1, cost + c.cost, count + (isNew ? 1 : 0));
      subtotals[si] -= c.cost;
      used[si]--;
      reserved.set(stockKey, held);
    }
  }
  // Seed incumbents for every feasible single store, then enumerate all assignments.
  for (const s of enabled) {
    const choices = tasks.map((t) =>
      t.candidates.find((c) => c.offer.store_id === s.id),
    );
    if (
      choices.every(Boolean) &&
      choices.every(
        (c) =>
          c!.offer.stock_quantity === null ||
          choices
            .filter((x) => (x!.offer.original_offer_id || x!.offer.id) === (c!.offer.original_offer_id || c!.offer.id))
            .reduce((n, x) => n + x!.packages * x!.offer.package_quantity, 0) <=
            c!.offer.stock_quantity!,
      )
    ) {
      const si = index.get(s.id)!;
      chosen.splice(0, chosen.length, ...(choices as typeof chosen));
      used[si] = tasks.length;
      subtotals[si] = choices.reduce((n, c) => n + c!.cost, 0);
      record(subtotals[si], 1);
      used[si] = 0;
      subtotals[si] = 0;
    }
  }
  // Establish small-store feasible plans before the bounded search. With many
  // alternatives, the first cheap branch can otherwise exhaust the budget at
  // six stores without ever visiting an available three-store basket.
  const seedStores=enabled.filter(s=>eligibleStoreIds.includes(s.id));
  function seedSubset(subset:string[]){
    const choices=tasks.map(t=>t.candidates.find(c=>subset.includes(c.offer.store_id)));
    if(!choices.every(Boolean))return;
    const held=new Map<string,number>();
    for(const choice of choices){const c=choice!,key=c.offer.original_offer_id||c.offer.id;const amount=(held.get(key)||0)+c.purchasedQuantity;if(c.offer.stock_quantity!==null&&amount>c.offer.stock_quantity)return;held.set(key,amount);}
    chosen.splice(0,chosen.length,...choices as typeof chosen);
    for(const choice of choices){const c=choice!,si=index.get(c.offer.store_id)!;used[si]++;subtotals[si]+=c.cost;}
    record(choices.reduce((n,c)=>n+c!.cost,0),used.filter(Boolean).length);
    used.fill(0);subtotals.fill(0);
  }
  function seedCombinations(offset:number,subset:string[],size:number){
    if(subset.length===size){seedSubset(subset);return;}
    for(let i=offset;i<=seedStores.length-(size-subset.length);i++)seedCombinations(i+1,[...subset,seedStores[i].id],size);
  }
  for(let size=2;size<=Math.min(4,max);size++)seedCombinations(0,[],size);
  walk(0, 0, 0);
  const scenarios: Scenario[] = [];
  let current: Scenario | undefined;
  for (let k = 1; k <= upperMax; k++) {
    if (best[k] && (!current || best[k]!.total < current.total))
      current = best[k];
    if (current)
      scenarios.push({
        ...current,
        maxStores: k,
        savings: (best[1]?.total ?? current.total) - current.total,
      });
  }
  let recommended = scenarios[0];
  for (const s of scenarios.slice(1))
    if (
      recommended &&
      s.total < recommended.total &&
      recommended.total - s.total >=
        (options.minimumSaving ?? 0) *
          Math.max(1, s.storeCount - recommended.storeCount)
    )
      recommended = s;
  return {
    eligibleStoreIds, comparedStoreIds, comparison, eligibleOffers,
    scenarios,
    exactScenarios:best.filter((s):s is Scenario=>Boolean(s)).map(s=>({...s,savings:(best[1]?.total ?? s.total)-s.total})),
    missing: [],
    optimal: !exhausted,
    nodes,
    recommendedMax: recommended?.maxStores ?? 0,
    generatedAt: new Date().toISOString(),
    source: offers.some((o) => o.source === "demo") ? "demo" : "live",
    ...(exhausted
      ? {
          reason:
            "Arama sınırına ulaşıldı. Gösterilen sonuç geçerli bir çözüm; matematiksel minimum henüz kanıtlanmadı.",
        }
      : {}),
  };
}
export function allocateCosts(
  scenario: Scenario,
  mode: "equal" | "proportional" = "proportional",
) {
  const result = new Map<
    string,
    { products: number; shipping: number; total: number }
  >();
  for (const g of scenario.groups) {
    const sums = new Map<string, number>();
    for (const l of g.lines)
      sums.set(l.addedBy, (sums.get(l.addedBy) || 0) + l.total);
    let remainder = g.shipping;
    [...sums].forEach(([person, cost], i) => {
      const share =
        i === sums.size - 1
          ? remainder
          : Math.floor(
              g.shipping *
                (mode === "equal" ? 1 / sums.size : cost / g.subtotal),
            );
      remainder -= share;
      const p = result.get(person) || { products: 0, shipping: 0, total: 0 };
      result.set(person, {
        products: p.products + cost,
        shipping: p.shipping + share,
        total: p.total + cost + share,
      });
    });
  }
  return Object.fromEntries(result);
}
