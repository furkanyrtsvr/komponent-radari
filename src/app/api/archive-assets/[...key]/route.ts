import {isWebpAsset} from '@/lib/archive-asset-format';
import {authorizeCollector} from '@/lib/server/collector-auth';
import {archiveBucket} from '@/lib/server/ready-archive';
import {archiveObjectAllowed,archiveImageKey} from '@/lib/ready-archive';
import {HttpError} from '@/lib/server/db';
export const dynamic='force-dynamic';
export async function PUT(request:Request,context:{params:Promise<{key:string[]}>}){try{
 authorizeCollector(request);const key=(await context.params).key.join('/');if(!archiveObjectAllowed(key))throw new HttpError(400,'Geçersiz katalog dosyası.');
 const bytes=await request.arrayBuffer(),image=archiveImageKey(key);if(bytes.byteLength>(image?500000:2000000)||!bytes.byteLength)throw new HttpError(413,'Dosya boyutu geçersiz.');
 const digest=[...new Uint8Array(await crypto.subtle.digest('SHA-256',bytes))].map(b=>b.toString(16).padStart(2,'0')).join('');
 if(image){if(!isWebpAsset(new Uint8Array(bytes))||key!==`images/${digest}.webp`)throw new HttpError(400,'WebP dosyası doğrulanamadı.');}
 else{const magic=new Uint8Array(bytes);if(magic[0]!==31||magic[1]!==139)throw new HttpError(400,'Sıkıştırılmış katalog gerekli.');}
 if(key.includes('/snapshots-index-')&&!key.endsWith('-'+digest+'.json.gz'))throw new HttpError(400,'İndeks dosyası özeti uyuşmuyor.');
 if(key.startsWith('objects/')&&key!==`objects/${digest}.json.gz`)throw new HttpError(400,'Katalog dosyası özeti uyuşmuyor.');
 const previous=await archiveBucket().head(key);if(previous&&previous.customMetadata?.sha256!==digest)throw new HttpError(409,'Yayımlanabilir dosyalar değiştirilemez.');
 if(!previous)await archiveBucket().put(key,bytes,{httpMetadata:{contentType:image?'image/webp':'application/json',cacheControl:'public, max-age=31536000, immutable',...(image?{}:{contentEncoding:'gzip'})},customMetadata:{sha256:digest}});
 return Response.json({key,sha256:digest,bytes:bytes.byteLength});
}catch(e){return Response.json({error:e instanceof Error?e.message:'Dosya kaydedilemedi.'},{status:e instanceof HttpError?e.status:400});}}
