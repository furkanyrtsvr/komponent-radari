import {activeArchive} from '@/lib/server/ready-archive';
import {cookies} from 'next/headers';
export const dynamic='force-dynamic';
export async function GET(request:Request){const archive=await activeArchive();if(archive)(await cookies()).set('eub_archive_version',archive.id,{httpOnly:true,sameSite:'lax',secure:new URL(request.url).protocol==='https:',path:'/',maxAge:2*86400});return Response.json(archive||{error:'İlk hazır B kataloğu hazırlanıyor.'},{status:archive?200:503,headers:{'Cache-Control':'private, no-store'}});}
