import {publishedArchive,archiveBucket} from '@/lib/server/ready-archive';
export const dynamic='force-dynamic';
export async function GET(_request:Request,context:{params:Promise<{id:string;file:string}>}){
 const {id,file}=await context.params;if(!/^[a-f0-9-]{36}$/.test(id)||!/^\d+\.json\.gz$/.test(file))return new Response('Not found',{status:404});
 const archive=await publishedArchive(id),key=`catalogs/${id}/${file}`;if(!archive?.chunks.some(c=>c.file===key))return new Response('Not found',{status:404});
 const object=await archiveBucket().get(key);if(!object)return new Response('Not found',{status:404});
 return new Response(object.body,{headers:{'Content-Type':'application/gzip','Cache-Control':'public, max-age=31536000, immutable','ETag':object.httpEtag,'X-Content-Type-Options':'nosniff'}});
}
