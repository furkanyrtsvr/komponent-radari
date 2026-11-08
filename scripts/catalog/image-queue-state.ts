import {DatabaseSync} from 'node:sqlite';
export function openImageQueue(file:string){const db=new DatabaseSync(file);db.exec(`PRAGMA journal_mode=WAL;
 CREATE TABLE IF NOT EXISTS missing_sources(source_id TEXT PRIMARY KEY);
 CREATE TABLE IF NOT EXISTS meta(key TEXT PRIMARY KEY,value TEXT NOT NULL);
 CREATE TABLE IF NOT EXISTS jobs(source TEXT PRIMARY KEY,source_id TEXT NOT NULL,store_id TEXT NOT NULL,origin TEXT NOT NULL,last_attempt INTEGER NOT NULL DEFAULT 0,next_attempt INTEGER NOT NULL DEFAULT 0,attempts INTEGER NOT NULL DEFAULT 0,error TEXT NOT NULL DEFAULT '',key TEXT,bytes INTEGER,original_bytes INTEGER,indexed INTEGER NOT NULL DEFAULT 0,blob BLOB);
 CREATE INDEX IF NOT EXISTS image_queue_origin ON jobs(origin,next_attempt,last_attempt);
 CREATE INDEX IF NOT EXISTS image_queue_due ON jobs(next_attempt,last_attempt);`);return db;}
export function queueMeta(db:DatabaseSync,key:string){return (db.prepare('SELECT value FROM meta WHERE key=?').get(key) as any)?.value;}
export function setQueueMeta(db:DatabaseSync,key:string,value:string){db.prepare('INSERT OR REPLACE INTO meta VALUES(?,?)').run(key,value);}
export function discoverImage(db:DatabaseSync,row:{source_id:string;store_id:string;source:string|null}){
 if(row.store_id==='ozdisan'||!row.source)return false;
 const url=new URL(row.source);if(url.protocol!=='https:'||url.username||url.password||url.port)return false;
 db.prepare('INSERT INTO jobs(source,source_id,store_id,origin) VALUES(?,?,?,?) ON CONFLICT(source) DO UPDATE SET source_id=excluded.source_id,store_id=excluded.store_id').run(row.source,row.source_id,row.store_id,url.origin);return true;
}
export function dueImages(db:DatabaseSync,at=Date.now(),limit=1000){const staged=db.prepare('SELECT * FROM jobs WHERE key IS NOT NULL AND indexed<>1 AND next_attempt<=? ORDER BY last_attempt LIMIT ?').all(at,limit) as any[];if(staged.length>=limit)return staged;const origins=db.prepare('SELECT origin,MIN(last_attempt) oldest FROM jobs WHERE key IS NULL AND next_attempt<=? GROUP BY origin ORDER BY oldest,origin LIMIT 100').all(at) as {origin:string}[];if(!origins.length)return staged;const take=Math.max(1,Math.ceil((limit-staged.length)/origins.length)),read=db.prepare('SELECT * FROM jobs WHERE origin=? AND key IS NULL AND next_attempt<=? ORDER BY last_attempt,source LIMIT ?');return [...staged,...origins.flatMap(row=>read.all(row.origin,at,take))] as any[];}
export function rememberImage(db:DatabaseSync,source:string,image:{key:string;bytes:number;original_bytes:number;indexed?:boolean;durable?:boolean},blob?:Uint8Array){db.prepare("UPDATE jobs SET key=?,bytes=?,original_bytes=?,indexed=?,blob=?,error='',next_attempt=0 WHERE source=?").run(image.key,image.bytes,image.original_bytes,image.indexed===false?(image.durable?2:0):1,blob||null,source);}
export function deferImage(db:DatabaseSync,source:string,error:unknown,infrastructure:boolean,at=Date.now()){
 const row=db.prepare('SELECT attempts FROM jobs WHERE source=?').get(source) as any;if(!row)return;
 // Infrastructure failures do not penalize the merchant or discard downloaded bytes.
 const attempts=infrastructure?row.attempts:row.attempts+1,delay=infrastructure?60000:Math.min(7*86400000,3600000*2**Math.min(attempts-1,7));
 db.prepare('UPDATE jobs SET last_attempt=?,next_attempt=?,attempts=?,error=? WHERE source=?').run(at,at+delay,attempts,String(error).slice(0,200),source);
}
export function queueStats(db:DatabaseSync){return db.prepare('SELECT COUNT(*) total,COALESCE(SUM(key IS NOT NULL AND blob IS NULL AND indexed>0),0) ready,COALESCE(SUM(key IS NULL AND attempts=0),0) pending,COALESCE(SUM(key IS NULL AND attempts>0),0) retry,COALESCE(SUM(key IS NOT NULL AND indexed<>1),0) indexedPending,COALESCE(SUM(CASE WHEN key IS NOT NULL THEN bytes ELSE 0 END),0) bytes FROM jobs').get() as any;}
