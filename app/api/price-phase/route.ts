import {cookies} from 'next/headers';
import {snapshotStatus} from '@/lib/server/snapshots';
import {checkOrigin} from '@/lib/server/auth';
export const dynamic='force-dynamic';
export async function GET(){return Response.json(await snapshotStatus());}
export async function POST(request:Request){try{checkOrigin(request);const {phase}=await request.json() as {phase:string};if(!['A','B'].includes(phase))return Response.json({error:'Geçersiz aşama'},{status:400});(await cookies()).set('eub_price_phase',phase,{httpOnly:true,sameSite:'lax',secure:new URL(request.url).protocol==='https:',path:'/',maxAge:30*86400});return Response.json({phase});}catch{return Response.json({error:'Aşama değiştirilemedi.'},{status:400});}}
