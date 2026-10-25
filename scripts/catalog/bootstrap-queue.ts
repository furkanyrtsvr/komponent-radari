import type {DatabaseSync} from 'node:sqlite';
export function initialArchiveQueue(db:DatabaseSync,store:string,limit:number){return db.prepare('SELECT url FROM products WHERE store_id=? AND active=1 AND last_attempt IS NULL ORDER BY url LIMIT ?').all(store,limit) as {url:string}[];}
export function firstPassProgress(db:DatabaseSync,stores:string[]){return {stores:stores.map(storeId=>{const s=db.prepare('SELECT COUNT(*) AS indexed,COALESCE(SUM(last_attempt IS NOT NULL),0) AS attempted,COALESCE(SUM(payload IS NOT NULL),0) AS verified,COALESCE(SUM(error IS NOT NULL),0) AS failed,COALESCE(SUM(last_attempt IS NULL),0) AS unseen FROM products WHERE active=1 AND store_id=?').get(storeId) as Record<string,number>;return {storeId,...s};})};}

/** Full observations already live in the server archive. The resumable queue
 * needs their dates/revisions, not another copy of every product description. */
export function compactCollectorCheckpoint(db:DatabaseSync){db.exec("UPDATE products SET payload=json_object('checkedAt',checked_at,'readerRevision',COALESCE(json_extract(payload,'$.readerRevision'),2)) WHERE uploaded_at IS NOT NULL AND payload IS NOT NULL; VACUUM;");}
