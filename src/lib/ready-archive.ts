import {z} from 'zod';
export const archiveManifestSchema=z.object({
 sourceIndex:z.object({file:z.string().regex(/^catalogs\/[a-f0-9-]{36}\/snapshots-index(?:-[a-f0-9]{64})?\.json\.gz$/),sha256:z.string().regex(/^[a-f0-9]{64}$/),bytes:z.number().int().positive(),offers:z.number().int().positive()}).optional(),
 version:z.literal(1),id:z.string().uuid(),preparedAt:z.string().datetime(),cutoff:z.string().datetime(),products:z.number().int().positive(),offers:z.number().int().positive(),candidates:z.number().int().nonnegative(),imageBytes:z.number().int().nonnegative(),originalImageBytes:z.number().int().nonnegative(),
 chunks:z.array(z.object({file:z.string().regex(/^(?:catalogs\/[a-f0-9-]{36}\/\d+|objects\/[a-f0-9]{64})\.json\.gz$/),sha256:z.string().regex(/^[a-f0-9]{64}$/),bytes:z.number().int().positive(),products:z.number().int().positive()})).min(1).max(2000),
 stores:z.array(z.object({id:z.string(),offers:z.number().int().nonnegative(),fresh:z.number().int().nonnegative()})).max(20),
});
export type ReadyArchive= z.infer<typeof archiveManifestSchema>;
export const archiveImageKey=(key:string)=>/^images\/[a-f0-9]{64}\.webp$/.test(key);
export const contentObject=(file:string,sha:string)=>file===`objects/${sha}.json.gz`;
export function archiveObjectAllowed(key:string){return /^objects\/[a-f0-9]{64}\.json\.gz$/.test(key)||/^catalogs\/[a-f0-9-]{36}\/(?:snapshots-index(?:-[a-f0-9]{64})?|snapshots\/[a-f0-9]{3})\.json\.gz$/.test(key)||archiveImageKey(key)||/^catalogs\/[a-f0-9-]{36}\/\d+\.json\.gz$/.test(key);}
export const imagePath=(key:string)=>'/api/archive-image/'+key.slice('images/'.length);
export function validateArchiveManifest(input:unknown){
 const m=archiveManifestSchema.parse(input);if(m.sourceIndex?.file.includes('/snapshots-index-')&&!m.sourceIndex.file.endsWith('-'+m.sourceIndex.sha256+'.json.gz'))throw new Error('Katalog indeks özeti uyuşmuyor.');if(m.sourceIndex&&(m.sourceIndex.offers!==m.offers||!m.sourceIndex.file.startsWith('catalogs/'+m.id+'/')))throw new Error('Tam ürün kayıtları sürümle uyuşmuyor.');if(m.cutoff>m.preparedAt||Date.parse(m.preparedAt)>Date.now()+60000||m.offers>m.candidates||m.products>m.offers||m.chunks.some(c=>!c.file.startsWith('catalogs/'+m.id+'/')&&!contentObject(c.file,c.sha256))||new Set(m.chunks.map(c=>c.file)).size!==m.chunks.length||m.chunks.reduce((s,c)=>s+c.products,0)!==m.products||m.stores.reduce((s,c)=>s+c.offers,0)!==m.offers)throw new Error('Hazır katalog sayıları veya tarihleri tutarsız.');return m;
}
