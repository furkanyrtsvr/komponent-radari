import test from "node:test";
import assert from "node:assert/strict";
import { optimize, allocateCosts } from "../lib/optimizer";
import {
  normalizePrice,
  matchProduct,
  mergeItems,
  type CartItem,
  type Offer,
  type Store,
} from "../lib/domain";
import {
  products,
  demoOffers,
  storeCatalog,
  demoQuantities,
} from "../lib/catalog";
import { parseBomRows, csvCell } from "../lib/bom";
import {
  parseProduct,
  safeStoreUrl,
  robotsAllowed,
  parsePrice,
} from "../stores/base";
import { catalogIdentity } from "../lib/catalog-identity";
const item = (pid: string, q = 1, person = "a"): CartItem => ({
  id: `${pid}-${person}`,
  cart_id: "cart",
  canonical_product_id: pid,
  quantity: q,
  added_by: person,
  notes: "",
  allow_alternative: 0,
  preferred_manufacturer: "",
  maximum_unit_price: null,
  created_at: "",
});
const store = (
  id: string,
  shipping = 0,
  threshold: number | null = null,
): Store => ({
  ...storeCatalog[0],
  id,
  shipping_base_price: shipping,
  free_shipping_threshold: threshold,
});
const offer = (pid: string, sid: string, price: number, pack = 1): Offer => ({
  ...demoOffers[0],
  id: `${pid}-${sid}-${price}`,
  canonical_product_id: pid,
  store_id: sid,
  price_gross: price,
  unit_price: Math.round(price / pack),
  package_quantity: pack,
  stock_quantity: 10000,
});
test("larger store caps retain a valid cheaper plan without inventing orders", () => {
  const r = optimize([item("a"), item("b"), item("c")], [offer("a", "x", 100), offer("b", "y", 200), offer("c", "x", 300)], ["x", "y", "z", "u", "v"].map(s => store(s)));
  assert.deepEqual(r.eligibleStoreIds?.sort(), ["x", "y"]);
  assert.deepEqual(r.comparedStoreIds, ["x", "y", "z", "u", "v"]);
  assert.deepEqual(r.scenarios.map(s => s.maxStores), [2,3,4,5]);
  assert.ok(r.scenarios.every(s=>s.storeCount===2 && s.total===r.scenarios[0].total));
  assert.deepEqual(r.exactScenarios?.map(s=>s.storeCount),[2]);
  assert.equal(r.recommendedMax, 2);
});
test('a bounded many-alternative basket retains an available three-store plan before exhausting its search',()=>{
 const stores=Array.from({length:14},(_,i)=>store('s'+i,8000));
 const needs=[item('camera'),item('charger'),item('programmer'),...Array.from({length:10},(_,i)=>item('common'+i))];
 const rows=[offer('camera','s0',90000),offer('charger','s1',7000),offer('programmer','s2',15000)];
 for(let i=0;i<10;i++)for(let j=0;j<14;j++)rows.push(offer('common'+i,'s'+j,j===i+3?100:1000));
 const result=optimize(needs,rows,stores,{nodeLimit:1});
 assert.equal(result.optimal,false);const three=result.scenarios.find(s=>s.maxStores===3)!;assert.ok(three);assert.equal(three.storeCount,3);assert.equal(three.groups.flatMap(g=>g.lines).length,13);assert.equal(three.shippingTotal,24000);
});
test("catalog identity merges XR2206 generator listings but keeps the bare IC separate", () => {
  const kit = catalogIdentity({ name: "XR2206 Sinyal Jeneratör DIY Kit", mpn: "", model: "" });
  const module = catalogIdentity({ name: "XR2206 1Hz-1MHz Sinyal Jeneratör Modülü", mpn: "", model: "" });
  const chip = catalogIdentity({ name: "XR2206 TSSOP-16 Zamanlayıcı Entegre", mpn: "XR2206", model: "" });
  assert.equal(kit, module);
  assert.notEqual(kit, chip);
});
test("catalog identity merges equivalent 40-pin jumper cable naming", () => {
  const motorobit = catalogIdentity({ name: "40pin 20cm erkek erkek jumper kablo", mpn: "", model: "" });
  const robotistan = catalogIdentity({ name: "40 Pin Ayrılabilen Erkek-Erkek M-M Jumper Kablo-200 mm", mpn: "", model: "" });
  const female = catalogIdentity({ name: "40 Pin Ayrılabilen Dişi-Dişi F-F Jumper Kablo-200 mm", mpn: "", model: "" });
  assert.equal(motorobit, robotistan);
  assert.notEqual(motorobit, female);
});
test("comparison uses the optimizer quantity quote and explains unavailable stock", () => {
  const soldOut = { ...offer("a", "y", 1), stock_status: "out_of_stock" };
  const r = optimize([item("a", 12)], [offer("a", "x", 500, 10), soldOut], [store("x"), store("y")]);
  const cells = r.comparison![0].cells;
  assert.equal(cells[0].purchasedQuantity, 20);
  assert.equal(cells[0].cost, r.scenarios[0].productTotal);
  assert.equal(cells[1].cost, undefined);
  assert.match(cells[1].reason!, /Stokta yok/);
});
test("identical costs keep the smallest recommended cap", () => {
  const r = optimize([item("a"), item("b")], [offer("a", "x", 100), offer("b", "x", 100), offer("a", "y", 200)], [store("x"), store("y")]);
  assert.equal(r.scenarios.length, 2);
  assert.equal(r.recommendedMax, 1);
});

test("a recently checked mismatched variant is excluded and explained as a model mismatch", () => {
  const mismatch = {...offer('camera','wrong',1),source:'live',last_checked_at:new Date().toISOString(),last_error:'Ürün modeli veya aksesuar türü eşleşmiyor.'};
  const r = optimize([item('camera')],[mismatch,offer('camera','valid',1000)],[store('wrong'),store('valid')]);
  assert.equal(r.comparison![0].cells[0].reason,'Ürün modeli veya satış paketi eşleşmiyor');
  assert.equal(r.scenarios.at(-1)!.total,1000);
  assert.deepEqual(r.eligibleStoreIds,['valid']);
});
test("VAT included/excluded becomes the same payable amount", () => {
  assert.equal(normalizePrice(10000, 0.2, false).gross, 12000);
  assert.equal(normalizePrice(12000, 0.2, true).gross, 12000);
  assert.equal(normalizePrice(12000, 0.2, true).net, 10000);
});
test("30 requested units require 3 ten-packs, not fractions of a hundred-pack", () => {
  const r = optimize(
    [item("r", 30)],
    [offer("r", "a", 2500, 100), offer("r", "b", 500, 10)],
    [store("a"), store("b")],
  );
  assert.equal(r.scenarios.at(-1)!.total, 1500);
  assert.equal(r.scenarios.at(-1)!.groups[0].lines[0].packages, 3);
});
test("out-of-stock and insufficient stock excluded", () => {
  const o = offer("p", "a", 100);
  o.stock_quantity = 0;
  assert.deepEqual(optimize([item("p")], [o], [store("a")]).missing, ["p"]);
});
test("shipping threshold can make a more expensive assignment optimal", () => {
  const r = optimize(
    [item("a"), item("b")],
    [
      offer("a", "x", 6000),
      offer("b", "x", 4000),
      offer("a", "y", 5000),
      offer("b", "y", 3000),
    ],
    [store("x", 3000, 10000), store("y", 3000)],
  );
  assert.equal(r.scenarios.at(-1)!.total, 10000);
  assert.equal(r.scenarios.at(-1)!.groups[0].storeId, "x");
});
test("one/two/three/unlimited store caps are respected", () => {
  const offers = ["a", "b", "c"].flatMap((p, i) =>
    ["x", "y", "z"].map((s, j) => offer(p, s, i === j ? 100 : 900)),
  );
  const r = optimize(
    ["a", "b", "c"].map((p) => item(p)),
    offers,
    ["x", "y", "z"].map((s) => store(s)),
  );
  assert.deepEqual(
    r.scenarios.map((s) => s.total),
    [1900, 1100, 300],
  );
  assert.deepEqual(
    r.scenarios.map((s) => s.storeCount),
    [1, 2, 3],
  );
});
test("missing product produces no partial misleading optimum", () => {
  const r = optimize(
    [item("a"), item("missing")],
    [offer("a", "x", 100)],
    [store("x")],
  );
  assert.deepEqual(r.missing, ["missing"]);
  assert.equal(r.scenarios.length, 0);
});
test("different STM32 MPNs never become exact or alternative automatically", () => {
  const a = products.find((p) => p.id === "stm32c8")!,
    b = products.find((p) => p.id === "stm32cb")!;
  assert.equal(matchProduct(a, b).confidence, 0);
});
test("same MPN from another manufacturer is not exact", () => {
  assert.equal(
    matchProduct(products[0], { ...products[0], manufacturer: "Another" }).type,
    "alternative",
  );
});
test("MPN decimal punctuation is significant", () => {
  assert.equal(
    matchProduct(
      { ...products[0], mpn: "AMS1117-3.3" },
      { ...products[0], mpn: "AMS1117-33" },
    ).confidence,
    0,
  );
});
test("same stock cannot be consumed twice by separate requirement constraints", () => {
  const a = item("p", 4),
    b = { ...item("p", 4, "b"), maximum_unit_price: 10000 };
  const o = offer("p", "s", 100);
  o.stock_quantity = 5;
  const r = optimize([a, b], [o], [store("s")]);
  assert.equal(r.scenarios.length, 0);
});
test("merge preserves attribution and combines identical owner needs", () => {
  const a = item("p", 2),
    b = item("p", 3),
    other = item("p", 4, "b");
  const r = mergeItems([[a], [b, other]], "new");
  assert.equal(r.length, 2);
  assert.equal(r.find((i) => i.added_by === "a")!.quantity, 5);
  assert.equal(a.quantity, 2);
});
test("shared package cost is paid once and shipping allocation sums exactly", () => {
  const r = optimize(
    [item("p", 20), item("p", 10, "b")],
    [offer("p", "x", 1000, 50)],
    [store("x", 101)],
  );
  const s = r.scenarios[0];
  assert.equal(s.productTotal, 1000);
  for (const mode of ["equal", "proportional"] as const)
    assert.equal(
      Object.values(allocateCosts(s, mode)).reduce((n, x) => n + x.total, 0),
      1101,
    );
});
test("minimum saving per extra store keeps a sensible recommendation", () => {
  const r = optimize(
    [item("a"), item("b")],
    [
      offer("a", "x", 100),
      offer("b", "x", 150),
      offer("a", "y", 150),
      offer("b", "y", 100),
    ],
    [store("x"), store("y")],
    { minimumSaving: 100 },
  );
  assert.equal(r.scenarios.at(-1)!.total, 200);
  assert.equal(r.recommendedMax, 1);
});
test("bounded optimization never claims mathematical proof", () => {
  const r = optimize(
    [item("a"), item("b")],
    [
      offer("a", "x", 100),
      offer("b", "x", 150),
      offer("a", "y", 150),
      offer("b", "y", 100),
    ],
    [store("x"), store("y")],
    { nodeLimit: 1 },
  );
  assert.equal(r.optimal, false);
  assert.ok(r.reason);
});
test("seed has 20 stores, at least 30 canonical products, and a solvable 8-line demo", () => {
  assert.equal(storeCatalog.length, 20);
  assert.ok(products.length >= 30);
  const r = optimize(
    products.slice(0, 8).map((p, i) => item(p.id, demoQuantities[i])),
    demoOffers,
    storeCatalog,
    { timeLimitMs: 15000 },
  );
  assert.equal(r.missing.length, 0);
  assert.equal(r.optimal, true);
  assert.ok(r.scenarios.length >= 3);
  for (let i = 1; i < r.scenarios.length; i++)
    assert.ok(r.scenarios[i].total <= r.scenarios[i - 1].total);
});
test("BOM uses strict part number matching and rejects invalid quantities", () => {
  assert.equal(
    parseBomRows([{ MPN: "STM32F103C8T6", Quantity: 2 }], products).items[0]
      .productId,
    "stm32c8",
  );
  assert.equal(
    parseBomRows([{ MPN: "STM32F103CXT6", Quantity: 2 }], products).unmatched
      .length,
    1,
  );
  assert.throws(() => parseBomRows([{ MPN: "A", Quantity: -2 }], products));
});
test("CSV formula injection is escaped", () =>
  assert.equal(csvCell("=1+1"), '"\'=1+1"'));
test("SSRF guard disallows foreign redirects, credentials, protocols and ports", () => {
  for (const url of [
    "http://www.direnc.net/x",
    "https://www.direnc.net.evil.test/x",
    "https://127.0.0.1/",
    "https://www.direnc.net:444/",
    "https://foo@www.direnc.net/",
  ])
    assert.throws(() => safeStoreUrl(url, "www.direnc.net"));
  assert.equal(
    safeStoreUrl("https://www.direnc.net/test", "www.direnc.net").hostname,
    "www.direnc.net",
  );
});
test("robots exclusion honored", () => {
  assert.equal(
    robotsAllowed(
      "User-agent: *\nDisallow: /private\nAllow: /private/public",
      "/private/a",
    ),
    false,
  );
  assert.equal(
    robotsAllowed(
      "User-agent: *\nDisallow: /private\nAllow: /private/public",
      "/private/public/a",
    ),
    true,
  );
});
test("broken adapter JSON is not silently replaced by seed prices", () =>
  assert.throws(() =>
    parseProduct("<html>Blocked</html>", "https://example.com"),
  ));
test("JSON-LD extracts explicit price but preserves uncertain VAT/package", () => {
  const p = parseProduct(
    '<script type="application/ld+json">' +
      JSON.stringify({
        "@type": "Product",
        name: "Part",
        mpn: "A",
        offers: {
          price: "100.50",
          priceCurrency: "TRY",
          availability: "https://schema.org/InStock",
        },
      }) +
      "</script>",
    "https://example.com",
  );
  assert.equal(p.price, 10050);
  assert.equal(p.vatIncluded, null);
  assert.equal(p.packageQuantity, null);
  assert.equal(parsePrice("1.250,50 TL"), 125050);
});
test("branch-and-bound agrees with independent exhaustive enumeration for 40 deterministic baskets", () => {
  let seed = 41;
  const rand = () => {
    seed = (seed * 16807) % 2147483647;
    return seed;
  };
  for (let t = 0; t < 40; t++) {
    const ps = ["p", "q", "r", "t"],
      ss = ["a", "b", "c"].map((s) =>
        store(s, rand() % 80, 80 + (rand() % 180)),
      ),
      os = ps.flatMap((p) => ss.map((s) => offer(p, s.id, 1 + (rand() % 150))));
    const expected = [Infinity, Infinity, Infinity];
    for (let mask = 0; mask < 81; mask++) {
      let bits = mask,
        totals = [0, 0, 0],
        used = [false, false, false];
      for (const p of ps) {
        const s = bits % 3;
        bits = Math.floor(bits / 3);
        totals[s] += os.find(
          (o) => o.canonical_product_id === p && o.store_id === ss[s].id,
        )!.price_gross;
        used[s] = true;
      }
      const count = used.filter(Boolean).length,
        total = totals.reduce(
          (n, v, i) =>
            n +
            v +
            (used[i] && v < ss[i].free_shipping_threshold!
              ? ss[i].shipping_base_price
              : 0),
          0,
        );
      for (let k = count; k <= 3; k++)
        expected[k - 1] = Math.min(expected[k - 1], total);
    }
    const r = optimize(
      ps.map((p) => item(p)),
      os,
      ss,
    );
    assert.deepEqual(
      r.scenarios.map((s) => s.total),
      expected,
    );
  }
});
