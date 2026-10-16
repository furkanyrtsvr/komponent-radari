import test from 'node:test';
import assert from 'node:assert/strict';
import {snapshotUsable,validateSnapshot,snapshotProduct,SNAPSHOT_TTL_MS,SNAPSHOT_UPSERT_SQL,upgradeSnapshotReader} from '../src/lib/catalog-snapshot';
import {DatabaseSync} from 'node:sqlite';
import {isFresh,quoteOffer,LIVE_TTL_MS} from '../src/lib/pricing';
import {demoOffers} from '../src/lib/catalog';
const at=Date.parse('2026-10-03T12:00:00.000Z');
const record={storeId:'robotzade',checkedAt:'2026-10-03T11:00:00.000Z',product:{url:'https://www.robotzade.com/urun/hc-sr04-ultrasonik-sensor',name:'HC-SR04 Ultrasonik Sensör',mpn:'HC-SR04',model:'HC-SR04',manufacturer:'',image:null,price:3900,currency:'TRY',vatIncluded:true,vatRate:20,packageQuantity:1,stockStatus:'in_stock',stockQuantity:5,specifications:'{}',warnings:[],quantityVerified:true,minimumOrderQuantity:1,orderStep:1}};
const stores=[{id:'robotzade',domain:'www.robotzade.com'}];
test('dated snapshots never renew their control time and expire at exactly twelve hours',()=>{const r=validateSnapshot(record,stores,at);assert.equal(snapshotProduct(r).checkedAt,record.checkedAt);assert.equal(snapshotUsable(record.checkedAt,SNAPSHOT_TTL_MS,at),true);assert.equal(snapshotUsable(record.checkedAt,SNAPSHOT_TTL_MS,Date.parse(record.checkedAt)+SNAPSHOT_TTL_MS),false);assert.equal(snapshotUsable(record.checkedAt,SNAPSHOT_TTL_MS,Date.parse(record.checkedAt)-1),false);});
test('collector rejects foreign domains, credentials, missing VAT, unverified quantities, stale and future records',()=>{for(const p of [{url:'https://attacker.example/p'},{url:'https://test@www.robotzade.com/p'},{url:'http://www.robotzade.com/p'},{vatIncluded:false},{quantityVerified:false},{price:0},{currency:'USD'},{orderStep:0}])assert.throws(()=>validateSnapshot({...record,product:{...record.product,...p}},stores,at));for(const checkedAt of ['2026-10-02T12:00:00.000Z','2026-10-03T12:01:00.000Z'])assert.throws(()=>validateSnapshot({...record,checkedAt},stores,at));});
test('A keeps twenty-minute freshness; B can use a dated price for twelve hours without changing shipping or quantity math',()=>{const offer={...demoOffers[0],source:'live',last_checked_at:record.checkedAt,last_error:null,price_gross:3900,package_quantity:2,order_step:2,minimum_order_quantity:2,price_tiers:'[]'};assert.equal(isFresh(offer,at),false);assert.equal(isFresh({...offer,snapshot_max_age_ms:SNAPSHOT_TTL_MS},at),true);assert.equal(isFresh({...offer,snapshot_max_age_ms:SNAPSHOT_TTL_MS,last_error:'not verified'},at),false);assert.equal(isFresh({...offer,snapshot_max_age_ms:999999999},at),false);assert.equal(isFresh(offer,Date.parse(record.checkedAt)+LIVE_TTL_MS-1),true);assert.equal(quoteOffer(offer,3).cost,7800);});
test('reader corrections repair MOQ without advancing price time or overwriting a newer observation',()=>{
 const db=new DatabaseSync(':memory:');db.exec('CREATE TABLE catalog_snapshots(id TEXT,store_id TEXT,url TEXT,checked_at TEXT,payload TEXT,UNIQUE(store_id,url))');
 const write=(r:any)=>db.prepare(SNAPSHOT_UPSERT_SQL).run('record',r.storeId,r.product.url,r.checkedAt,JSON.stringify(r));
 write({...record,product:{...record.product,minimumOrderQuantity:541,orderStep:541}});
 write({...record,readerRevision:2});
 let saved=db.prepare('SELECT * FROM catalog_snapshots').get() as any;
 assert.equal(saved.checked_at,record.checkedAt);assert.equal(JSON.parse(saved.payload).product.minimumOrderQuantity,1);
 write({...record,checkedAt:'2026-10-03T11:01:00.000Z',readerRevision:2,product:{...record.product,price:4000}});
 write({...record,readerRevision:2});
 saved=db.prepare('SELECT * FROM catalog_snapshots').get() as any;assert.equal(JSON.parse(saved.payload).product.price,4000);assert.equal(saved.checked_at,'2026-10-03T11:01:00.000Z');db.close();
});
test('legacy IdeaSoft correction preserves the actual price/stock time and does not accept an unrelated feed',()=>{
 const input=validateSnapshot({...record,product:{...record.product,minimumOrderQuantity:541,orderStep:541,stockQuantity:null,warnings:['KDV dahil mağaza fiyatı ve satış birimi doğrulandı.']}},stores,at);
 const fixed=upgradeSnapshotReader(input)!;assert.equal(fixed.checkedAt,record.checkedAt);assert.equal(fixed.product.price,3900);assert.equal(fixed.product.minimumOrderQuantity,1);assert.equal(fixed.product.orderStep,1);assert.equal(fixed.product.stockQuantity,541);
 assert.equal(upgradeSnapshotReader({...input,product:{...input.product,warnings:[]}}),undefined);
 assert.equal(upgradeSnapshotReader(fixed),fixed);
});
