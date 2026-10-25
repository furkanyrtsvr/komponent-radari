/** A broad, ASCII model prefix can reduce reads; final catalog matching still decides results. */
export function archiveModelQuery(query:string){
 return query.toLowerCase().match(/\b[a-z]{2,8}\d[a-z0-9]{1,18}\b/)?.[0]||'';
}
// Parameters remain bound. JSON string escapes for Turkish i are irrelevant to
// the ASCII model code; spacing/hyphens in merchant titles do not exclude a hit.
export const ARCHIVE_MODEL_ROWS_SQL=`SELECT id,store_id,url,checked_at,payload FROM catalog_snapshots WHERE id>? AND (CASE WHEN json_valid(payload) THEN replace(replace(lower(json_extract(payload,'$.product.name')),' ',''),'-','') ELSE '' END LIKE ? OR replace(replace(lower(url),' ',''),'-','') LIKE ?) ORDER BY id LIMIT 500`;
