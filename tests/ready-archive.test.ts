import test from 'node:test';
import assert from 'node:assert/strict';
import sharp from 'sharp';
import {DatabaseSync} from 'node:sqlite';
import {readFileSync} from 'node:fs';
import {compactProductImage,safeImageUrl} from '../scripts/catalog/archive-images';
import {validateArchiveManifest,archiveObjectAllowed,imagePath} from '../src/lib/ready-archive';
import {COPY_ARCHIVE_BATCH_SQL,ACTIVATE_ARCHIVE_SQL} from '../src/lib/archive-batch-sql';
const id='00000000-0000-4000-8000-000000000001',cutoff='2026-10-25T01:00:00.000Z';
const manifest={version:1,id,cutoff,preparedAt:'2026-10-25T02:00:00.000Z',products:1,offers:1,candidates:3,imageBytes:4000,originalImageBytes:30000,chunks:[{file:`catalogs/${id}/0.json.gz`,sha256:'a'.repeat(64),bytes:1000,products:1}],stores:[{id:'ulutas',offers:1,fresh:1}]};
test('publication manifest requires complete chunks, exact counts and a coherent frozen version',()=>{
 assert.equal(validateArchiveManifest(manifest).offers,1);
 for(const change of [{offers:4},{products:2},{stores:[{id:'ulutas',offers:2,fresh:1}]},{chunks:[{...manifest.chunks[0],file:'catalogs/00000000-0000-4000-8000-000000000002/0.json.gz'}]},{preparedAt:'2026-10-24T01:00:00.000Z'}])assert.throws(()=>validateArchiveManifest({...manifest,...change}));
 assert.equal(archiveObjectAllowed('images/'+ 'a'.repeat(64)+'.webp'),true);assert.equal(archiveObjectAllowed('../secrets.json'),false);assert.equal(imagePath('images/'+'a'.repeat(64)+'.webp'),'/api/archive-image/'+'a'.repeat(64)+'.webp');
});
test('images are precompressed as WebP without enlargement, cropping or invented detail',async()=>{
 const input=await sharp({create:{width:1600,height:1000,channels:4,background:{r:33,g:117,b:72,alpha:0.7}}}).png().toBuffer();
 const packed=await compactProductImage(input),meta=await sharp(packed.bytes).metadata();assert.equal(meta.format,'webp');assert.equal(meta.width,800);assert.equal(meta.height,500);assert.ok(meta.hasAlpha);assert.ok(packed.bytes.length<input.length);assert.match(packed.key,/^images\/[a-f0-9]{64}\.webp$/);
 const small=await compactProductImage(await sharp({create:{width:40,height:20,channels:3,background:'#335544'}}).png().toBuffer());assert.equal(small.width,40);assert.equal(small.height,20);
 await assert.rejects(()=>compactProductImage(Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" width="1" height="1"></svg>')));
});
test('image downloader rejects private targets, generic logos and non-HTTPS inputs',()=>{
 for(const url of ['http://merchant.example/p.jpg','https://127.0.0.1/p.jpg','https://[::1]/p.jpg','https://private.local/p.jpg','https://user:secret@merchant.example/p.jpg','https://www.ozdisan.com/images/ozdisan-share-default.png'])assert.throws(()=>safeImageUrl(url));
 assert.equal(safeImageUrl('https://cdn.example.com/product.jpg').hostname,'cdn.example.com');
});
test('staging freezes observations; source updates and a failed newer publication do not change the active archive',()=>{
 const db=new DatabaseSync(':memory:');db.exec('CREATE TABLE catalog_snapshots(id TEXT,store_id TEXT,url TEXT,checked_at TEXT,payload TEXT);CREATE TABLE catalog_collection_runs(id TEXT PRIMARY KEY,updated_at TEXT,payload TEXT)');
 const migration=readFileSync('drizzle/0006_funny_lorna_dane.sql','utf8').split('--> statement-breakpoint').slice(0,4).join(';');db.exec(migration);
 db.prepare('INSERT INTO catalog_snapshots VALUES(?,?,?,?,?)').run('source','ulutas','https://store.example/p',cutoff,JSON.stringify({price:1788}));
 db.prepare(COPY_ARCHIVE_BATCH_SQL).run(id,id,cutoff);db.prepare('UPDATE catalog_snapshots SET payload=?').run(JSON.stringify({price:9999}));
 assert.equal(JSON.parse(String(db.prepare('SELECT payload FROM archive_batch_rows').get()!.payload)).price,1788);
 db.prepare(ACTIVATE_ARCHIVE_SQL).run(cutoff,JSON.stringify(manifest));
 db.exec('BEGIN');db.prepare(ACTIVATE_ARCHIVE_SQL).run(cutoff,JSON.stringify({...manifest,cutoff:'2026-10-26T01:00:00Z'}));db.exec('ROLLBACK');
 db.prepare(ACTIVATE_ARCHIVE_SQL).run(cutoff,JSON.stringify({...manifest,cutoff:'2026-10-24T01:00:00Z'}));
 assert.equal(JSON.parse(String(db.prepare('SELECT payload FROM catalog_collection_runs').get()!.payload)).cutoff,manifest.cutoff);db.close();
});


test('ready browser catalog verifies compressed files and never invents missing prices or images',async()=>{
 const {gzipSync}=await import('node:zlib');
 const {createHash}=await import('node:crypto');
 const {decodeReadyChunk,searchReadyProducts}=await import('../public/catalog/ready-search.js');
 const at=Date.parse('2026-10-25T15:00:00Z'),date='2026-10-24T10:00:00Z',url='https://store.example/kbu410';
 const product={key:'kbu410',name:'KBU410 4A 1000V',group:'Diyotlar',sources:[{url,storeId:'ulutas',name:'KBU410 4A 1000V'}],previews:[{url,key:'kbu410',price:1788,image:'/api/archive-image/'+'a'.repeat(64)+'.webp',checkedAt:date,stockStatus:'in_stock'}]};
 const bytes=gzipSync(JSON.stringify([product])),hash=createHash('sha256').update(bytes).digest('hex');
 assert.deepEqual(await decodeReadyChunk(bytes,hash),[product]);await assert.rejects(()=>decodeReadyChunk(bytes,'b'.repeat(64)));
 const options={query:'KBU410',group:'all',store:'all',page:0};
 const result=searchReadyProducts([product],options,at);assert.equal(result.count,1);assert.equal(result.previews[0].checkedAt,date);assert.equal(result.previews[0].archiveState,'expired');assert.equal(result.previews[0].price,1788);
 for(const change of [{price:null},{image:null},{image:'https://merchant.example/image.jpg'},{checkedAt:'2026-10-26T00:00:00Z'}])assert.equal(searchReadyProducts([{...product,previews:[{...product.previews[0],...change}]}],options,at).count,0);
 assert.equal(searchReadyProducts([product],{...options,store:'other'},at).count,0);
});


test('image preparation alternates hosts before revisiting a slow merchant',async()=>{
 const {fairImageQueue}=await import('../scripts/catalog/archive-image-queue');
 const input:[string,number][]=[['https://slow.example/1',1],['https://slow.example/2',2],['https://slow.example/3',3],['https://fast.example/1',4],['https://other.example/1',5]];
 assert.deepEqual(fairImageQueue(input).map(x=>x[1]),[1,4,5,2,3]);assert.equal(input[1][1],2);
});


test('price refreshes reuse prepared images indefinitely; missing assets require preparation',async()=>{
 const {reusableImage}=await import('../scripts/catalog/archive-image-queue');
 const old={key:'images/'+'a'.repeat(64)+'.webp',bytes:2916,original_bytes:4293,checked_at:'2020-01-01T00:00:00Z'};
 assert.equal(reusableImage(old),true);assert.equal(reusableImage(undefined),false);assert.equal(reusableImage({...old,key:'invalid'}),false);assert.equal(reusableImage({...old,bytes:0}),false);
});
