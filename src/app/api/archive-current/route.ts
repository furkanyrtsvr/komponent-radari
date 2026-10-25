import {activeArchive} from '@/lib/server/ready-archive';
export const dynamic='force-dynamic';
export async function GET(){const archive=await activeArchive();return Response.json(archive||{error:'İlk hazır B kataloğu hazırlanıyor.'},{status:archive?200:503,headers:{'Cache-Control':'public, max-age=30'}});}
