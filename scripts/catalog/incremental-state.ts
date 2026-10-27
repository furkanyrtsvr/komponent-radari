import {DatabaseSync} from 'node:sqlite';
import {createHash} from 'node:crypto';
export const hash=(value:string|Uint8Array)=>createHash('sha256').update(value).digest('hex');
export const partition=(value:string)=>hash(value).slice(0,2);
export function openPublicationState(file:string){
 const db=new DatabaseSync(file);
 db.exec(`CREATE TABLE IF NOT EXISTS meta(key TEXT PRIMARY KEY,value TEXT NOT NULL);
 CREATE TABLE IF NOT EXISTS observations(source_id TEXT PRIMARY KEY,store_id TEXT NOT NULL,url TEXT NOT NULL,checked_at TEXT NOT NULL,payload TEXT NOT NULL,fingerprint TEXT NOT NULL,ready TEXT,retry_after INTEGER NOT NULL DEFAULT 0,failures INTEGER NOT NULL DEFAULT 0);
 CREATE TABLE IF NOT EXISTS images(url TEXT PRIMARY KEY,key TEXT NOT NULL,bytes INTEGER NOT NULL,original_bytes INTEGER NOT NULL,checked_at TEXT NOT NULL);
 CREATE TABLE IF NOT EXISTS objects(hash TEXT PRIMARY KEY,file TEXT NOT NULL,bytes INTEGER NOT NULL);`);
 return db;
}
export function putObservation(db:DatabaseSync,row:{source_id:string;store_id:string;url:string;checked_at:string;payload:string}){
 const previous=db.prepare('SELECT fingerprint,checked_at FROM observations WHERE source_id=?').get(row.source_id) as {fingerprint:string;checked_at:string}|undefined;
 const fingerprint=hash(JSON.stringify([row.store_id,row.url,row.checked_at,row.payload]));
 if(previous&&(previous.checked_at>row.checked_at||previous.fingerprint===fingerprint))return false;
 // A new unprepared observation must not erase the last complete price/image.
 db.prepare('INSERT INTO observations(source_id,store_id,url,checked_at,payload,fingerprint) VALUES(?,?,?,?,?,?) ON CONFLICT(source_id) DO UPDATE SET store_id=excluded.store_id,url=excluded.url,checked_at=excluded.checked_at,payload=excluded.payload,fingerprint=excluded.fingerprint,retry_after=0,failures=0').run(row.source_id,row.store_id,row.url,row.checked_at,row.payload,fingerprint);
 setMeta(db,'unpublished','1');
 return true;
}
export function pendingObservations(db:DatabaseSync,at=Date.now()){return db.prepare("SELECT * FROM observations WHERE (ready IS NULL OR json_extract(ready,'$.fingerprint')<>fingerprint) AND retry_after<=? ORDER BY source_id").all(at) as any[];}
export function deferObservation(db:DatabaseSync,id:string,at=Date.now()){db.prepare('UPDATE observations SET retry_after=?+MIN(43200000,3600000*(1<<MIN(failures,4))),failures=failures+1 WHERE source_id=?').run(at,id);}
export function getMeta(db:DatabaseSync,key:string){return (db.prepare('SELECT value FROM meta WHERE key=?').get(key) as {value:string}|undefined)?.value;}
export function setMeta(db:DatabaseSync,key:string,value:string){db.prepare('INSERT OR REPLACE INTO meta VALUES(?,?)').run(key,value);}
