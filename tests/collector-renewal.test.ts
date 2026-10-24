import test from 'node:test';
import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import {collectionQueue,REFRESH_AFTER_MS} from '../scripts/catalog/queue';
import {COLLECTOR_WATCHLIST_SQL} from '../src/lib/collector-watchlist';
const at=Date.parse('2026-10-24T18:00:00Z'),now=new Date(at).toISOString();
function database(){const db=new DatabaseSync(':memory:');db.exec('CREATE TABLE products(store_id TEXT,url TEXT,active INTEGER,payload TEXT,priority INTEGER,next_due TEXT,last_attempt TEXT,error TEXT)');return db;}
test('fresh watched records do not overtake old prices, and renewal starts before twelve-hour expiry',()=>{
 const db=database();try{
  const insert=db.prepare('INSERT INTO products VALUES(?,?,?,?,?,?,?,?)');
  insert.run('s','watched-fresh',1,JSON.stringify({checkedAt:new Date(at-2*3600000).toISOString()}),10,new Date(at+10*3600000).toISOString(),new Date(at-2*3600000).toISOString(),null);
  insert.run('s','old-unwatched',1,JSON.stringify({checkedAt:new Date(at-9*3600000).toISOString()}),0,new Date(at+3*3600000).toISOString(),new Date(at-9*3600000).toISOString(),null);
  insert.run('s','failed-backoff',1,JSON.stringify({checkedAt:new Date(at-24*3600000).toISOString()}),10,new Date(at+3600000).toISOString(),now,'blocked');
  assert.deepEqual(collectionQueue(db,'s',8,true,at).map(r=>r.url),['old-unwatched']);assert.ok(REFRESH_AFTER_MS<12*3600000);
 }finally{db.close();}
});
test('urgent floods leave renewal and discovery capacity, and spare capacity is filled',()=>{
 const db=database();try{
  const insert=db.prepare('INSERT INTO products VALUES(?,?,?,?,?,?,?,?)');
  for(let i=0;i<50;i++){insert.run('s','urgent'+i,1,null,20,'','',null);insert.run('s','known'+i,1,'{}',0,'','',null);insert.run('s','new'+i,1,null,0,'','',null);}
  const batch=collectionQueue(db,'s',40,false,at);assert.equal(batch.length,40);assert.equal(batch.filter(r=>r.url.startsWith('urgent')).length,10);assert.equal(batch.filter(r=>r.url.startsWith('known')).length,22);assert.equal(batch.filter(r=>r.url.startsWith('new')).length,8);
  db.exec("DELETE FROM products WHERE url LIKE 'new%' OR url LIKE 'urgent%'");assert.equal(collectionQueue(db,'s',40,false,at).length,40);
 }finally{db.close();}
});
test('collector watchlist excludes historical imports, disabled watches and demo-cart-only products',()=>{
 const db=new DatabaseSync(':memory:');try{
  db.exec(`CREATE TABLE carts(id TEXT,data_source TEXT);CREATE TABLE cart_items(cart_id TEXT,canonical_product_id TEXT);CREATE TABLE favorites(canonical_product_id TEXT);CREATE TABLE price_alerts(canonical_product_id TEXT,enabled INTEGER);CREATE TABLE stock_alerts(canonical_product_id TEXT,enabled INTEGER);CREATE TABLE store_offers(store_id TEXT,product_url TEXT,canonical_product_id TEXT,source TEXT);
   INSERT INTO carts VALUES('live','live'),('demo','demo');INSERT INTO cart_items VALUES('live','cart'),('demo','demo');INSERT INTO favorites VALUES('fav');INSERT INTO price_alerts VALUES('off',0),('watch',1);INSERT INTO stock_alerts VALUES('stock',1);`);
  const add=db.prepare('INSERT INTO store_offers VALUES(?,?,?,?)');for(const id of ['cart','demo','fav','off','watch','stock','historical'])add.run('s','https://s/'+id,id,'live');add.run('s','https://s/demo-only','fav','demo');
  assert.deepEqual(db.prepare(COLLECTOR_WATCHLIST_SQL).all().map(r=>r.url),['https://s/cart','https://s/fav','https://s/stock','https://s/watch']);
 }finally{db.close();}
});
