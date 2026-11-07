import {binding,one} from './db';
import {archiveBucket} from './ready-archive';
import {RETIRED_ROWS_SQL,backupBeforeRemoval} from '../archive-retention';

// Only retired staging copies are eligible. Prices, carts, images, the active
// version and its resumable build remain untouched. The object is durable first.
export async function retireArchivePage(){
 const active=await one<{payload:string}>('catalog_collection_runs',{id:'archive-active'});
 if(!active)return {removed:0};
 const rows=(await binding().prepare(RETIRED_ROWS_SQL).bind(JSON.parse(active.payload).id).all<Record<string,unknown>>()).results;
 if(!rows.length)return {removed:0};
 let key='';const removed=await backupBeforeRemoval(rows,async rows=>{
 const bytes=new TextEncoder().encode(JSON.stringify({version:1,rows}));
 const digest=[...new Uint8Array(await crypto.subtle.digest('SHA-256',bytes))].map(x=>x.toString(16).padStart(2,'0')).join('');
 key='retired-staging/'+digest+'.json';
 await archiveBucket().put(key,bytes,{sha256:digest,httpMetadata:{contentType:'application/json'},customMetadata:{sha256:digest}});
 const object=await archiveBucket().head(key);
 if(!object||object.size!==bytes.length||object.customMetadata?.sha256!==digest)throw new Error('Hazırlık yedeği doğrulanamadı; kayıtlar korunuyor.');
 },async rows=>{const results=await binding().batch(rows.map(row=>binding().prepare('DELETE FROM archive_batch_rows WHERE id=? AND batch_id=?').bind(row.id,row.batch_id)));return results.reduce((n,r)=>n+(r.meta.changes||0),0);});
 return {removed,backup:key};
}
