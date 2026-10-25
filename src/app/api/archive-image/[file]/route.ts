import {archiveBucket} from '@/lib/server/ready-archive';
export const dynamic='force-dynamic';
export async function GET(request:Request,context:{params:Promise<{file:string}>}){
 const file=(await context.params).file;if(!/^[a-f0-9]{64}\.webp$/.test(file))return new Response('Not found',{status:404});
 const object=await archiveBucket().get('images/'+file);if(!object)return new Response('Not found',{status:404});
 if(request.headers.get('if-none-match')===object.httpEtag)return new Response(null,{status:304,headers:{ETag:object.httpEtag}});
 return new Response(object.body,{headers:{'Content-Type':'image/webp','Cache-Control':'public, max-age=31536000, immutable','ETag':object.httpEtag,'X-Content-Type-Options':'nosniff'}});
}
