import {test} from 'node:test';
import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import sharp from 'sharp';
import {randomBytes,createHash} from 'node:crypto';
import {openImageQueue,discoverImage,dueImages,rememberImage,deferImage,queueStats} from '../scripts/catalog/image-queue-state';
import {stageQueuedImage} from '../scripts/catalog/image-queue-transfer';
import {IMAGE_LOOKUP_SQL,IMAGE_DISCOVERY_SQL,IMAGE_SOURCE_CHANGES_SQL,IMAGE_CACHE_CHANGES_SQL,imagePrefixRange,imageInfrastructureError,imageSourcePath} from '../src/lib/image-queue';
import {compactProductImage} from '../scripts/catalog/archive-images';
import {openPublicationState,putObservation} from '../scripts/catalog/incremental-state';
import {preparePriceCatalog} from '../scripts/catalog/price-catalog';
import {searchReadyProducts} from '../public/catalog/ready-search.js';
const source='https://cdn.example.com/product.jpg',key='images/'+'a'.repeat(64)+'.webp',image={key,bytes:80,original_bytes:500},seed={source_id:'source',store_id:'ulutas',source};

test('image lookups and discovery use bounded indexed queries without scanning archived JSON',()=>{
 const db=new DatabaseSync(':memory:');db.exec('CREATE TABLE archive_image_cache(url TEXT PRIMARY KEY,image_key TEXT,bytes INTEGER,original_bytes INTEGER);CREATE TABLE catalog_snapshots(id TEXT PRIMARY KEY,store_id TEXT,url TEXT,checked_at TEXT,payload TEXT);CREATE TABLE catalog_archive_changes(seq INTEGER PRIMARY KEY,source_id TEXT)');
 const plan=db.prepare('EXPLAIN QUERY PLAN '+IMAGE_LOOKUP_SQL).all(JSON.stringify([source])).map(r=>r.detail).join(' ');assert.match(plan,/INDEX.*url|sqlite_autoindex_archive_image_cache/);assert.ok(!IMAGE_LOOKUP_SQL.includes('payload'));assert.ok(!IMAGE_LOOKUP_SQL.includes('archive_batch_rows'));
 for(let i=0;i<1005;i++){const id='a'+String(i).padStart(6,'0');db.prepare('INSERT INTO catalog_snapshots VALUES(?,?,?,?,?)').run(id,'ulutas','https://example.com/'+i,'old',JSON.stringify({product:{image:source}}));db.prepare('INSERT INTO catalog_archive_changes VALUES(?,?)').run(i+1,id);}
 const range=imagePrefixRange('a'),rows=db.prepare(IMAGE_DISCOVERY_SQL).all(...range,'');assert.equal(rows.length,1000);assert.equal(db.prepare(IMAGE_DISCOVERY_SQL).all(...range,rows.at(-1)!.source_id).length,5);assert.match(db.prepare('EXPLAIN QUERY PLAN '+IMAGE_DISCOVERY_SQL).all(...range,'').map(r=>r.detail).join(' '),/INDEX.*id|sqlite_autoindex_catalog_snapshots/);assert.equal(db.prepare(IMAGE_SOURCE_CHANGES_SQL).all(1000).length,5);db.prepare('INSERT INTO archive_image_cache VALUES(?,?,?,?)').run(source,key,80,500);assert.equal(db.prepare(IMAGE_CACHE_CHANGES_SQL).all(0).length,1);assert.equal(db.prepare(IMAGE_CACHE_CHANGES_SQL).all(1).length,0);assert.deepEqual(imagePrefixRange('f'),['f','g']);db.close();
});

test('queue deduplicates image URLs and preserves completed images when products or prices change',()=>{
 const db=openImageQueue(':memory:');discoverImage(db,seed);rememberImage(db,source,image);discoverImage(db,{...seed,source_id:'new-observation'});assert.equal(queueStats(db).ready,1);assert.equal(dueImages(db).length,0);assert.equal(db.prepare('SELECT key FROM jobs').get()!.key,key);assert.equal(discoverImage(db,{...seed,store_id:'ozdisan'}),false);assert.equal(discoverImage(db,{...seed,source:null}),false);db.close();
});

test('one large merchant cannot starve other image hosts and repeated bad URLs yield to untouched sources',()=>{
 const db=openImageQueue(':memory:');for(let i=0;i<1500;i++)discoverImage(db,{...seed,source:'https://large.example.com/'+i+'.jpg'});discoverImage(db,{...seed,source:'https://small.example.com/one.jpg'});assert.ok(dueImages(db,100,20).some(row=>row.origin==='https://small.example.com'));const bad='https://large.example.com/0.jpg';deferImage(db,bad,'HTTP 404',false,100);assert.ok(!dueImages(db,101,2000).some(r=>r.source===bad));assert.equal((db.prepare('SELECT attempts FROM jobs WHERE source=?').get(bad) as any).attempts,1);db.close();
});

test('database overload preserves downloaded bytes and does not penalize the merchant',()=>{
 const db=openImageQueue(':memory:');discoverImage(db,seed);rememberImage(db,source,{...image,indexed:false},Buffer.from('saved-image'));deferImage(db,source,'D1 DB is overloaded',true,100);const row=db.prepare('SELECT * FROM jobs').get() as any;assert.equal(row.attempts,0);assert.equal(Buffer.from(row.blob).toString(),'saved-image');assert.equal(row.key,key);assert.equal(row.next_attempt,60100);assert.ok(imageInfrastructureError('D1_ERROR: Too many resources consumed within a 10 second window'));db.close();
});

test('failed upload retries its saved file; registration failure and known mappings never redownload',async()=>{
 const db=openImageQueue(':memory:');discoverImage(db,seed);let downloads=0,uploads=0;const hooks={prepare:async()=>{downloads++;return {key,bytes:Buffer.from('webp'),originalBytes:100};},upload:async()=>{if(++uploads===1)throw Error('HTTP 503');}};
 await assert.rejects(stageQueuedImage(db,source,hooks));assert.equal(downloads,1);await stageQueuedImage(db,source,hooks);assert.equal(downloads,1);assert.equal(uploads,2);deferImage(db,source,'database is locked',true,100);await stageQueuedImage(db,source,hooks);assert.equal(downloads,1);assert.equal(uploads,2);rememberImage(db,source,{...image,indexed:false,durable:true});assert.equal(queueStats(db).ready,1);assert.equal(queueStats(db).indexedPending,1);await stageQueuedImage(db,source,hooks);assert.equal(downloads,1);rememberImage(db,source,image);await stageQueuedImage(db,source,hooks);assert.equal(downloads,1);db.close();
});

test('pending downloaded files are transferred before untouched merchant images',()=>{
 const db=openImageQueue(':memory:');for(let i=0;i<100;i++)discoverImage(db,{...seed,source:'https://fresh.example.com/'+i+'.jpg'});discoverImage(db,seed);rememberImage(db,source,{...image,indexed:false},Buffer.from('downloaded'));db.prepare('UPDATE jobs SET last_attempt=50 WHERE source=?').run(source);assert.equal(dueImages(db,100,20)[0].source,source);assert.ok((dueImages(db,100,20)[0] as any).blob);db.close();
});

test('new WebP images stay below 0.12 MB without upscaling or cropping, and GIF is supported',async()=>{
 const input=await sharp(randomBytes(1400*900*3),{raw:{width:1400,height:900,channels:3}}).png().toBuffer(),packed=await compactProductImage(input),meta=await sharp(packed.bytes).metadata();assert.ok(packed.bytes.length<=120000);assert.equal(meta.format,'webp');assert.ok(Number(meta.width)<=800);assert.ok(Math.abs(Number(meta.width)/Number(meta.height)-1400/900)<0.01);const gif=await sharp({create:{width:40,height:25,channels:4,background:{r:10,g:80,b:120,alpha:0}}}).gif().toBuffer(),small=await compactProductImage(gif),s=await sharp(small.bytes).metadata();assert.equal(s.width,40);assert.equal(s.height,25);assert.equal(s.format,'webp');assert.ok(s.hasAlpha);assert.ok(small.bytes.length<=120000);await assert.rejects(compactProductImage(Buffer.from('<html>blocked</html>')));
});

test('price-only aliases are deterministic and do not pretend a missing photograph is a store image',async()=>{
 const expected='/api/archive-image-source/'+createHash('sha256').update(source).digest('hex')+'.webp';assert.equal(await imageSourcePath(source),expected);assert.equal(await imageSourcePath(null),null);const db=openPublicationState(':memory:'),date='2026-11-01T00:00:00.000Z',url='https://www.ulutaselektronik.com/urun/kbu410';putObservation(db,{source_id:'p',store_id:'ulutas',url,checked_at:date,payload:JSON.stringify({storeId:'ulutas',checkedAt:date,product:{url,name:'KBU410 4A 1000V Köprü Diyot',mpn:'KBU410',manufacturer:'',model:'',image:source,price:1788,currency:'TRY',vatIncluded:true,vatRate:20,packageQuantity:1,stockStatus:'in_stock',stockQuantity:10,specifications:'',warnings:[],quantityVerified:true,minimumOrderQuantity:1,orderStep:1}})});await preparePriceCatalog(db,'2026-11-08T00:00:00.000Z');const view=JSON.parse(String(db.prepare('SELECT entry FROM priced_catalog').get()!.entry));assert.equal(view.preview.image,expected);assert.equal(view.preview.imagePending,true);assert.equal(view.checked_at,date);assert.equal(view.preview.price,1788);const result=searchReadyProducts([{key:view.preview.key,name:view.preview.name,group:'Diğer',sources:[{url:view.preview.url,storeId:'ulutas',name:view.preview.name}],previews:[view.preview]}],{query:'KBU410',store:'all',group:'all',page:0});assert.equal(result.count,1);assert.equal(result.previews[0].price,1788);assert.equal(result.previews[0].archiveState,'expired');db.close();
});
