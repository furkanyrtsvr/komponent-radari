import assert from "node:assert/strict";
const base = process.env.TEST_BASE_URL || "http://localhost:5173",
  cookies = new Map();
async function api(path, body) {
  const r = await fetch(base + "/api/" + path, {
    method: body ? "POST" : "GET",
    headers: {
      "Content-Type": "application/json",
      Cookie: [...cookies].map(([k, v]) => k + "=" + v).join("; "),
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  for (const c of r.headers.getSetCookie()) {
    const [k, ...v] = c.split(";")[0].split("=");
    cookies.set(k, v.join("="));
  }
  const d = await r.json();
  assert.equal(r.status, 200, JSON.stringify(d));
  return d;
}
const first = await api("bootstrap");
assert.equal(first.demo, false);
const sync = await api("refresh", { productIds: first.cart.items.map(item=>item.canonical_product_id), force: false });
const boot = await api("bootstrap");
assert.ok(boot.offers.length >= 10);
assert.ok(boot.offers.every((o) => o.source === "live"));
const known = boot.offers.filter((o) => !o.last_error && o.price_gross > 0);
assert.ok(known.length >= 10);
assert.ok(
  known.every(
    (o) =>
      Number.isInteger(o.minimum_order_quantity) &&
      Number.isInteger(o.order_step),
  ),
);
const resistor = known.find(
  (o) => o.store_id === "robotistan" && o.canonical_product_id === "live-res1k",
);
assert.equal(resistor.minimum_order_quantity, 50);
assert.equal(resistor.order_step, 50);
const opt = await api("carts/" + first.cart.id + "/optimize", {
  exactOnly: false,
  shippingEstimate: 8000,
});
assert.ok(opt.scenarios.length);
assert.equal(opt.missing.length, 0);
assert.equal(opt.shippingEstimated, true);
assert.equal(opt.shippingAssumption, 8000);
const cached = await api("refresh", {
  productIds: ["live-res1k"],
  force: false,
});
assert.equal(cached.checked, 0);
assert.ok(cached.cached>=2);
await api("mode", { mode: "demo" });
const demo = await api("bootstrap");
assert.equal(demo.demo, true);
assert.ok(demo.offers.every((o) => o.source === "demo"));
await api("mode", { mode: "live" });
const live = await api("bootstrap");
assert.equal(live.demo, false);
assert.ok(live.offers.every((o) => o.source === "live"));
console.log(
  JSON.stringify(
    {
      passed: true,
      liveOffers: boot.offers.length,
      updated: sync.checked,
      cached: sync.cached,
      failed: sync.failed,
      bestTotal: opt.scenarios.at(-1).total,
      shippingAssumption: opt.shippingAssumption,
      modeIsolation: true,
      minimumOrder: true,
    },
    null,
    2,
  ),
);
