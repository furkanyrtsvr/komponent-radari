export const RETIRED_ROWS_SQL=`SELECT r.* FROM archive_batch_rows r WHERE r.batch_id=(
SELECT b.id FROM archive_batches b WHERE b.id<>? AND (
(b.state='published' AND json_extract(b.manifest,'$.sourceIndex.file') IS NOT NULL)
OR (b.state='building' AND b.cutoff<?))
AND EXISTS(SELECT 1 FROM archive_batch_rows pending WHERE pending.batch_id=b.id)
ORDER BY b.id LIMIT 1) ORDER BY r.source_id LIMIT 250`;
export async function backupBeforeRemoval<T>(rows:T[],backup:(rows:T[])=>Promise<void>,remove:(rows:T[])=>Promise<number>){if(!rows.length)return 0;await backup(rows);return remove(rows);}
