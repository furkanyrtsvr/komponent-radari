import type {DatabaseSync} from 'node:sqlite';
const ready=new WeakSet<DatabaseSync>();
export function ensureCollectorRequestSchema(db:DatabaseSync){
 if(ready.has(db))return;
 const columns=(db.prepare('PRAGMA table_info(products)').all() as {name:string}[]).map(c=>c.name);
 if(!columns.includes('requested_at'))db.exec('ALTER TABLE products ADD COLUMN requested_at TEXT');
 if(!columns.includes('error'))db.exec('ALTER TABLE products ADD COLUMN error TEXT');
 ready.add(db);
}
export const REFRESH_AFTER_MS=8*3600000;
/** Renew oldest observations first. Fresh watched records cannot repeatedly
 * jump ahead of an old price; explicit jobs and discovery have bounded shares. */
export function collectionQueue(db:DatabaseSync,store:string,limit:number,knownOnly=false,at=Date.now()){
 ensureCollectorRequestSchema(db);
 const now=new Date(at).toISOString(),refreshBefore=new Date(at-REFRESH_AFTER_MS).toISOString();
 const urgent=db.prepare(`SELECT url FROM products WHERE store_id=? AND active=1 AND priority>=20 AND next_due<=? ORDER BY COALESCE(requested_at,'') ASC,COALESCE(last_attempt,'') ASC,url LIMIT ?`).all(store,now,limit) as {url:string}[];
 const known=db.prepare(`SELECT url FROM products WHERE store_id=? AND active=1 AND priority<20 AND (payload IS NOT NULL OR priority>=10) AND (next_due<=? OR (payload IS NOT NULL AND error IS NULL AND json_extract(payload,'$.checkedAt')<=?)) ORDER BY COALESCE(json_extract(payload,'$.checkedAt'),last_attempt,'') ASC,priority DESC,url LIMIT ?`).all(store,now,refreshBefore,limit) as {url:string}[];
 const firstUrgent=urgent.slice(0,Math.max(1,Math.floor(limit/4))),reserve=knownOnly?0:Math.max(1,Math.floor(limit/5));
 const firstKnown=known.slice(0,Math.max(0,limit-firstUrgent.length-reserve));
 const unseen=knownOnly?[]:db.prepare(`SELECT url FROM products WHERE store_id=? AND active=1 AND payload IS NULL AND priority<10 AND next_due<=? ORDER BY COALESCE(last_attempt,'') ASC,url LIMIT ?`).all(store,now,limit-firstUrgent.length-firstKnown.length) as {url:string}[];
 return [...firstUrgent,...firstKnown,...unseen,...known.slice(firstKnown.length),...urgent.slice(firstUrgent.length)].slice(0,limit);
}
