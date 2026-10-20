import test from 'node:test';
import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import {collectionQueue} from '../scripts/catalog/queue';
test('archive queue reserves room for new products, honors retry time and resumes without starvation',()=>{
 const db=new DatabaseSync(':memory:');
 try{
  db.exec(`CREATE TABLE products(store_id TEXT,url TEXT,active INTEGER,payload TEXT,priority INTEGER,next_due TEXT,last_attempt TEXT)`);
  const insert=db.prepare('INSERT INTO products VALUES(?,?,?,?,?,?,?)');
  for(let i=0;i<20;i++)insert.run('s','known-'+i,1,'{}',10,'','2026-10-18T00:00:00Z');
  for(let i=0;i<20;i++)insert.run('s','new-'+i,1,null,0,'','');
  insert.run('s','backoff',1,null,0,'2030-01-01T00:00:00Z','');
  const at=Date.parse('2026-10-20T00:00:00Z'),first=collectionQueue(db,'s',8,false,at);
  assert.equal(first.filter(r=>r.url.startsWith('known')).length,4);
  assert.equal(first.filter(r=>r.url.startsWith('new')).length,4);
  assert.ok(!first.some(r=>r.url==='backoff'));
  for(const row of first)db.prepare('UPDATE products SET next_due=?,last_attempt=? WHERE url=?').run('2026-10-20T12:00:00Z','2026-10-20T00:00:00Z',row.url);
  const second=collectionQueue(db,'s',8,false,at);
  assert.ok(second.every(row=>!first.some(before=>before.url===row.url)));
  assert.ok(collectionQueue(db,'s',8,true,at).every(row=>row.url.startsWith('known')));
 }finally{db.close();}
});
