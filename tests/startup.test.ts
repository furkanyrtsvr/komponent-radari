import test from "node:test";
import assert from "node:assert/strict";
import {DatabaseSync} from "node:sqlite";
import {readFileSync,readdirSync} from "node:fs";
import {startupGate,requestError,startupReader} from "../src/lib/startup";
import {seedEntries,seedProducts,seedReady,changedDemoOffers} from "../src/lib/seed-plan";
import {demoOffers,storeCatalog} from "../src/lib/catalog";

test("cold initialization shares one attempt and a failed attempt can be retried",async()=>{
  let calls=0;
  const ready=startupGate(async()=>{if(++calls===1)throw new Error("database unavailable");});
  const a=ready(),b=ready();
  assert.equal(a,b);
  await assert.rejects(a,/database unavailable/);
  await ready();await ready();
  assert.equal(calls,2);
});

test('startup configuration retries a cold timeout once, shares success and ignores the late response',async()=>{
 let calls=0,retries=0,late!:(value:string)=>void;
 const keepAlive=setTimeout(()=>{},200);
 const read=startupReader(()=>++calls===1?new Promise<string>(resolve=>{late=resolve;}):Promise.resolve('ready'),10);
 try{
  const a=read(()=>retries++),b=read();assert.equal(a,b);
  assert.equal(await a,'ready');assert.equal(retries,1);assert.equal(calls,2);
  late('stale');await new Promise(resolve=>setImmediate(resolve));
  assert.equal(await read(),'ready');assert.equal(calls,2);
 }finally{clearTimeout(keepAlive);}
});

test('startup retries only transient reads, releases terminal failure and never loops indefinitely',async()=>{
 for(const status of [401,403,404,429]){
  let calls=0;const read=startupReader(async()=>{calls++;throw Object.assign(new Error('denied'),{status});});
  await assert.rejects(read(),/denied/);assert.equal(calls,1);
 }
 for(const error of [new TypeError('network'),Object.assign(new Error('unavailable'),{status:503})]){
  let calls=0;const read=startupReader(async()=>{calls++;throw error;});
  await assert.rejects(read());assert.equal(calls,2);
  await assert.rejects(read());assert.equal(calls,4);
 }
});
test("a stalled initialization expires and its late error cannot poison the retry",async()=>{
  let calls=0,fail!:(error:Error)=>void;
  const keepAlive=setTimeout(()=>{},200);
  const ready=startupGate(()=>++calls===1?new Promise<void>((_,reject)=>{fail=reject;}):Promise.resolve(),10);
  try{
    await assert.rejects(ready(),/Veritabanı hazırlığı/);
    await ready();
    fail(new Error("late failure"));
    await new Promise(resolve=>setImmediate(resolve));
    await ready();assert.equal(calls,2);
  }finally{clearTimeout(keepAlive);}
});
test("seed batches satisfy real foreign keys and preserve existing store settings and live prices",()=>{
  const db=new DatabaseSync(":memory:");
  try{
    db.exec("PRAGMA foreign_keys=ON");
    for(const file of readdirSync("drizzle").filter(file=>file.endsWith(".sql")).sort())db.exec(readFileSync(`drizzle/${file}`,"utf8"));
    const insert=()=>{
      const entries=seedEntries();
      for(let i=0;i<entries.length;i+=80){
        db.exec("BEGIN");
        for(const {table,row} of entries.slice(i,i+80)){
          const values=Object.entries(row);
          db.prepare(`INSERT OR IGNORE INTO ${table} (${values.map(([key])=>key).join(",")}) VALUES (${values.map(()=>"?").join(",")})`).run(...values.map(([,value])=>value));
        }
        db.exec("COMMIT");
      }
    };
    insert();
    db.prepare("UPDATE stores SET shipping_base_price=4321 WHERE id=?").run(storeCatalog[0].id);
    db.prepare("UPDATE store_offers SET source='live',price_gross=12345 WHERE id=?").run(demoOffers[0].id);
    insert();
    assert.equal(db.prepare("SELECT shipping_base_price FROM stores WHERE id=?").get(storeCatalog[0].id)?.shipping_base_price,4321);
    assert.equal(db.prepare("SELECT price_gross FROM store_offers WHERE id=?").get(demoOffers[0].id)?.price_gross,12345);
    assert.deepEqual(db.prepare("PRAGMA foreign_key_check").all(),[]);
  }finally{db.close();}
});
test("readiness notices missing non-first offers, products and changed demo unit prices",()=>{
  assert.ok(seedReady(storeCatalog,seedProducts,demoOffers));
  assert.equal(seedReady(storeCatalog,seedProducts,demoOffers.slice(0,-1)),false);
  assert.equal(seedReady(storeCatalog,seedProducts.slice(0,-1),demoOffers),false);
  const offers=demoOffers.map((offer,i)=>i===demoOffers.length-1?{...offer,unit_price:offer.unit_price+1}:offer);
  assert.equal(seedReady(storeCatalog,seedProducts,offers),false);
  assert.deepEqual(changedDemoOffers(offers).map(offer=>offer.id),[demoOffers.at(-1)!.id]);
  const error=requestError(new DOMException("signal timed out","TimeoutError"));
  assert.ok(error instanceof Error);
  assert.equal(error.message,"Sunucu zamanında yanıt vermedi. Yeniden deneyin.");
});
