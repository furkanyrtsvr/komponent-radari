import type {DatabaseSync} from 'node:sqlite';
const ready=new WeakSet<DatabaseSync>();
export function ensureCollectorRequestSchema(db:DatabaseSync){
 if(ready.has(db))return;
 if(!(db.prepare('PRAGMA table_info(products)').all() as {name:string}[]).some(c=>c.name==='requested_at'))db.exec('ALTER TABLE products ADD COLUMN requested_at TEXT');
 ready.add(db);
}
/** Reserve discovery capacity: an old known-price backlog cannot starve new URLs. */
export function collectionQueue(db:DatabaseSync,store:string,limit:number,knownOnly=false,at=Date.now()){
 ensureCollectorRequestSchema(db);
 const now=new Date(at).toISOString(),hourAgo=new Date(at-3600000).toISOString();
 const urgent=db.prepare(`SELECT url FROM products WHERE store_id=? AND active=1 AND priority>=20 AND next_due<=? ORDER BY COALESCE(requested_at,'') ASC,COALESCE(last_attempt,'') ASC,url LIMIT ?`).all(store,now,limit) as {url:string}[];
 const remaining=limit-urgent.length;
 const known=db.prepare(`SELECT url FROM products WHERE store_id=? AND active=1 AND priority<20 AND (payload IS NOT NULL OR priority>=10) AND (next_due<=? OR priority>=10 AND COALESCE(last_attempt,'')<?) ORDER BY priority DESC,COALESCE(last_attempt,'') ASC,url LIMIT ?`).all(store,now,hourAgo,knownOnly?remaining:Math.ceil(remaining/2)) as {url:string}[];
 if(knownOnly)return [...urgent,...known];
 const unseen=db.prepare(`SELECT url FROM products WHERE store_id=? AND active=1 AND payload IS NULL AND priority<10 AND next_due<=? ORDER BY COALESCE(last_attempt,'') ASC,url LIMIT ?`).all(store,now,remaining-known.length) as {url:string}[];
 return [...urgent,...known,...unseen];
}
