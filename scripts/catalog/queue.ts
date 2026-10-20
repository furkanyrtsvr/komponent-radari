import type {DatabaseSync} from 'node:sqlite';
/** Reserve discovery capacity: an old known-price backlog cannot starve new URLs. */
export function collectionQueue(db:DatabaseSync,store:string,limit:number,knownOnly=false,at=Date.now()){
 const now=new Date(at).toISOString(),hourAgo=new Date(at-3600000).toISOString();
 const known=db.prepare(`SELECT url FROM products WHERE store_id=? AND active=1 AND (payload IS NOT NULL OR priority>=10) AND (next_due<=? OR priority>=10 AND COALESCE(last_attempt,'')<?) ORDER BY priority DESC,COALESCE(last_attempt,'') ASC,url LIMIT ?`).all(store,now,hourAgo,knownOnly?limit:Math.ceil(limit/2)) as {url:string}[];
 if(knownOnly)return known;
 const unseen=db.prepare(`SELECT url FROM products WHERE store_id=? AND active=1 AND payload IS NULL AND priority<10 AND next_due<=? ORDER BY COALESCE(last_attempt,'') ASC,url LIMIT ?`).all(store,now,limit-known.length) as {url:string}[];
 return [...known,...unseen];
}
