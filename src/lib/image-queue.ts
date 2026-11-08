export const IMAGE_LOOKUP_LIMIT=20,IMAGE_REGISTER_LIMIT=10,IMAGE_DISCOVERY_LIMIT=1000;
export const IMAGE_LOOKUP_SQL='SELECT url,image_key AS key,bytes,original_bytes FROM archive_image_cache WHERE url IN (SELECT value FROM json_each(?))';
export const IMAGE_CACHE_CHANGES_SQL='SELECT rowid AS seq,url,image_key AS key,bytes,original_bytes FROM archive_image_cache WHERE rowid>? ORDER BY rowid LIMIT 1000';
export const IMAGE_DISCOVERY_SQL="SELECT id AS source_id,store_id,url,checked_at,json_extract(payload,'$.product.image') AS source FROM catalog_snapshots WHERE id>=? AND id<? AND id>? ORDER BY id LIMIT 1000";
export const IMAGE_SOURCE_CHANGES_SQL="SELECT c.seq,s.id AS source_id,s.store_id,s.url,s.checked_at,json_extract(s.payload,'$.product.image') AS source FROM catalog_archive_changes c JOIN catalog_snapshots s ON s.id=c.source_id WHERE c.seq>? ORDER BY c.seq LIMIT 1000";
export function imagePrefixRange(prefix:string){if(!/^[0-9a-f]$/.test(prefix))throw Error('Geçersiz görsel keşif bölümü.');return [prefix,prefix==='f'?'g':(parseInt(prefix,16)+1).toString(16)];}
export function imageInfrastructureError(error:unknown){return /overloaded|Too many resources|database is locked|Exceeded maximum DB size|D1.*timeout|HTTP (?:408|429|5\d\d)|fetch failed|ECONNRESET|ETIMEDOUT/i.test(String(error));}

export async function imageSourcePath(source:string|null|undefined){if(!source?.startsWith('https://'))return null;const bytes=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(source));return '/api/archive-image-source/'+[...new Uint8Array(bytes)].map(n=>n.toString(16).padStart(2,'0')).join('')+'.webp';}
