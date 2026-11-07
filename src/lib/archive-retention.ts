export const RETIRED_ROWS_SQL=`SELECT r.* FROM archive_batch_rows r JOIN archive_batches b ON b.id=r.batch_id
WHERE b.state='published' AND b.id<>? AND json_extract(b.manifest,'$.sourceIndex.file') IS NOT NULL ORDER BY r.id LIMIT 250`;
export async function backupBeforeRemoval<T>(rows:T[],backup:(rows:T[])=>Promise<void>,remove:(rows:T[])=>Promise<number>){if(!rows.length)return 0;await backup(rows);return remove(rows);}
