import {archiveBucket} from '@/lib/server/ready-archive';
export const dynamic='force-dynamic';
export async function GET(_request:Request,context:{params:Promise<{sha:string}>}){
 const {sha}=await context.params;if(!/^[a-f0-9]{64}$/.test(sha))return new Response('Not found',{status:404});
 const object=await archiveBucket().get('objects/'+sha+'.json.gz');if(!object||object.customMetadata?.sha256!==sha)return new Response('Not found',{status:404});
 return new Response(object.body,{headers:{'Content-Type':'application/gzip','Cache-Control':'public, max-age=31536000, immutable','ETag':object.httpEtag,'X-Content-Type-Options':'nosniff'}});
}
