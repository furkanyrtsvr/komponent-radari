import type {DatabaseSync} from 'node:sqlite';
import {normalizeCollectorUrl,type CollectorRequest} from '../../src/lib/collector-routing';
import {ensureCollectorRequestSchema} from './queue';
export function registerCollectorRequests(db:DatabaseSync,rows:CollectorRequest[],stores:{id:string;domain:string}[],generation:string,at=Date.now()){
 ensureCollectorRequestSchema(db);
 const accepted:CollectorRequest[]=[];
 for(const row of rows.slice(0,500)){
  const store=stores.find(s=>s.id===row.storeId),date=Date.parse(row.requestedAt);
  if(!store||!Number.isFinite(date)||date>at+60000||typeof row.id!=='string'||!/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i.test(row.id))continue;
  let url:string;
  try{url=normalizeCollectorUrl(row.url,store.domain);}catch{continue;}
   db.prepare(`INSERT INTO products(store_id,url,name,category,source_category,generation,active,priority,next_due,requested_at) VALUES(?,?,?,'Diğer','',?,1,20,'',?) ON CONFLICT(store_id,url) DO UPDATE SET active=1,priority=20,requested_at=excluded.requested_at,next_due=CASE WHEN COALESCE(last_attempt,'')<? THEN '' ELSE next_due END,uploaded_at=CASE WHEN checked_at>=? THEN NULL ELSE uploaded_at END`).run(store.id,url,'',generation,row.requestedAt,row.requestedAt,row.requestedAt);
   accepted.push({...row,url});
 }
 return accepted;
}
