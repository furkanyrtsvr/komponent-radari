import {binding,isSupabase,supabase} from './db';
import {SNAPSHOT_UPSERT_SQL,type SnapshotRecord} from '../catalog-snapshot';
export async function saveSnapshot(record:SnapshotRecord){return (await saveSnapshots([record])).saved>0;}
export async function saveSnapshots(records:SnapshotRecord[]){let saved=0;
 if(isSupabase()){for(const record of records){const url=new URL(record.requestedUrl||record.product.url);url.hash='';const {data,error}=await supabase().rpc('eub_save_catalog_snapshot',{snapshot:{id:crypto.randomUUID(),store_id:record.storeId,url:url.href,checked_at:record.checkedAt,payload:JSON.stringify(record)}});if(error)throw error;if(data)saved++;}return {saved,ignored:records.length-saved};}
 for(let offset=0;offset<records.length;offset+=10){const statements=records.slice(offset,offset+10).map(record=>{const url=new URL(record.requestedUrl||record.product.url);url.hash='';return binding().prepare(SNAPSHOT_UPSERT_SQL).bind(crypto.randomUUID(),record.storeId,url.href,record.checkedAt,JSON.stringify(record));});const results=await binding().batch(statements);saved+=results.filter(r=>r.meta.changes>0).length;}return {saved,ignored:records.length-saved};
}
