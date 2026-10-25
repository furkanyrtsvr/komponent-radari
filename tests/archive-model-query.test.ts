import test from 'node:test';
import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import {archiveModelQuery,ARCHIVE_MODEL_ROWS_SQL} from '../src/lib/archive-model-query';
test('model search limits snapshot reads while keeping suffixes, spaced titles, URL matches and separate variants',()=>{
 const db=new DatabaseSync(':memory:');db.exec('CREATE TABLE catalog_snapshots(id TEXT,store_id TEXT,url TEXT,checked_at TEXT,payload TEXT)');
 const insert=db.prepare('INSERT INTO catalog_snapshots VALUES(?,?,?,?,?)');
 for(const [id,name,url] of [['1','MAX 7219 8x8 Modül','/one'],['2','MAX7219 4lü Modül','/two'],['3','STM32F103C6T6 Geliştirme Kartı','/stm32f103c6t6'],['4','8x8 matrix','/max7219'],['5','MAX7221 Modül','/five']])insert.run(id,'store',url,'2026-10-25T08:00:00Z',JSON.stringify({product:{name}}));
 const model=archiveModelQuery('MAX7219 8x8'),rows=db.prepare(ARCHIVE_MODEL_ROWS_SQL).all('','%'+model+'%','%'+model+'%');
 assert.deepEqual(rows.map(r=>r.id),['1','2','4']);assert.deepEqual(db.prepare(ARCHIVE_MODEL_ROWS_SQL).all('1','%max7219%','%max7219%').map(r=>r.id),['2','4']);
 assert.equal(archiveModelQuery('STM32F103C6T6'),'stm32f103c6t6');assert.equal(archiveModelQuery('100 ohm direnç'),'');assert.equal(archiveModelQuery("%'; DELETE FROM catalog_snapshots;--"),'');db.close();
});
