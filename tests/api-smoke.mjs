import assert from "node:assert/strict";
const base = process.env.TEST_BASE_URL || "http://localhost:5173";
function client() {
  const jar = new Map([["eub_data_mode", "demo"]]);
  return async (path, method = "GET", body, expected = 200) => {
    const r = await fetch(`${base}/api/${path}`, {
      method,
      headers: {
        "Content-Type": "application/json",
        Cookie: [...jar].map(([k, v]) => k + "=" + v).join("; "),
      },
      ...(body ? { body: JSON.stringify(body) } : {}),
    });
    for (const c of r.headers.getSetCookie()) {
      const [k, ...v] = c.split(";")[0].split("=");
      jar.set(k, v.join("="));
    }
    const data = await r.json();
    assert.equal(r.status, expected, JSON.stringify(data));
    return data;
  };
}
const a = client(),
  b = client(),
  c = client();
const boot = await a("bootstrap"),
  other = await b("bootstrap");
assert.notEqual(boot.user.id, other.user.id);
assert.equal(boot.cart.items.length, 8);
assert.ok(boot.products.length >= 30);
const cart = await a(
  "carts",
  "POST",
  { name: "API kabul testi", demo: true },
  201,
);
const optimized = await a(`carts/${cart.id}/optimize`, "POST", {});
assert.equal(optimized.optimal, true);
assert.ok(optimized.scenarios.length >= 3);
const saved = await a(`carts/${cart.id}/snapshot`, "POST", {});
assert.equal(saved.snapshots.length, 1);
assert.ok(JSON.parse(saved.snapshots[0].payload).items.length === 8);
const exactThree=optimized.exactScenarios.find(s=>s.storeCount===3);
assert.ok(exactThree);
const exactSaved=await a(`carts/${cart.id}/snapshot`,"POST",{planMode:"exact",scenarioCount:3,maxStores:3});
const exactSnapshot=exactSaved.snapshots.find(snapshot=>JSON.parse(snapshot.payload).planMode==="exact");
assert.equal(exactSnapshot.total,exactThree.total);
assert.equal(JSON.parse(exactSnapshot.payload).selectedScenario.groups.length,3);
await b(`carts/${cart.id}`, "GET", undefined, 403);
const share = await a(`carts/${cart.id}/share`, "POST", {
  role: "contributor",
});
const joined = await b("share/" + share.url.split("/").pop(), "POST", {});
assert.equal(joined.role, "contributor");
const shared = await b(`carts/${cart.id}/items`, "POST", {
  productId: "esp32",
  quantity: 3,
});
assert.equal(shared.items.length, 9);
assert.equal(shared.items.at(-1).added_by, other.user.id);
await b(
  `carts/${cart.id}/items/${cart.items[0].id}`,
  "PATCH",
  { quantity: 50 },
  403,
);
await b(`carts/${cart.id}/share`, "POST", { role: "editor" }, 403);
const viewShare = await a(`carts/${cart.id}/share`, "POST", { role: "viewer" });
await c("bootstrap");
const viewer = await c("share/" + viewShare.url.split("/").pop(), "POST", {});
assert.equal(viewer.role, "viewer");
await c(
  `carts/${cart.id}/items`,
  "POST",
  { productId: "esp32", quantity: 1 },
  403,
);
const reoptimized = await a(`carts/${cart.id}/optimize`, "POST", {});
assert.ok(reoptimized.scenarios.length);
const latest = await a(`carts/${cart.id}`);
assert.equal(latest.items.length, 9);
const copy = await a(
  "carts",
  "POST",
  { name: "Kopya", sourceIds: [cart.id] },
  201,
);
assert.equal(
  copy.items.reduce((n, x) => n + x.quantity, 0),
  latest.items.reduce((n, x) => n + x.quantity, 0),
);
const merged = await a(
  "carts",
  "POST",
  { name: "Birleşik", sourceIds: [cart.id, copy.id] },
  201,
);
assert.equal(
  merged.items.reduce((n, x) => n + x.quantity, 0),
  2 * latest.items.reduce((n, x) => n + x.quantity, 0),
);
await a(
  `carts/${cart.id}/items/${cart.items[0].id}`,
  "PATCH",
  { quantity: -1 },
  400,
);
await a(
  "admin/store",
  "PATCH",
  {
    id: "direnc",
    enabled: 0,
    shipping_base_price: 0,
    free_shipping_threshold: null,
  },
  403,
);
await a(
  `carts/${cart.id}/import`,
  "POST",
  { rows: [{ MPN: "NO-SUCH-PART", Quantity: 1 }] },
  422,
);
const imported = await a(`carts/${copy.id}/import`, "POST", {
  rows: [{ MPN: "STM32F103C8T6", Quantity: 2 }],
});
assert.equal(imported.imported, 1);
const refresh = await a("refresh", "POST", { productIds: ["esp32"] });
assert.equal(refresh.demo, true);
assert.equal(refresh.checked, 0);
await a(`carts/${cart.id}/shares`, "DELETE");
await c("share/" + share.url.split("/").pop(), "POST", {}, 404);
console.log(
  JSON.stringify(
    {
      passed: true,
      checks: 20,
      products: boot.products.length,
      offers: boot.offers.length,
      scenarios: optimized.scenarios.map((s) => ({
        maxStores: s.maxStores,
        actualStores: s.storeCount,
        total: s.total,
      })),
      sharedCartItems: latest.items.length,
    },
    null,
    2,
  ),
);
