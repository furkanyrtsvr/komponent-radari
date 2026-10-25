import {user,requireAdmin,checkOrigin} from '@/lib/server/auth';
import {bootstrapView,startBootstrap,pauseBootstrap} from '@/lib/server/archive-bootstrap';
import {HttpError} from '@/lib/server/db';
export const dynamic='force-dynamic';
export async function GET(request:Request){try{requireAdmin(await user(request));return Response.json(await bootstrapView(),{headers:{'Cache-Control':'private, no-store'}});}catch(e){return failure(e);}}
export async function POST(request:Request){try{checkOrigin(request);requireAdmin(await user(request));const {action}=await request.json() as {action:string};if(action!=='start'&&action!=='pause')throw new HttpError(400,'Geçersiz işlem.');return Response.json(await (action==='start'?startBootstrap():pauseBootstrap()));}catch(e){return failure(e);}}
function failure(e:unknown){return Response.json({error:e instanceof Error?e.message:'Arşiv işi açılamadı.'},{status:e instanceof HttpError?e.status:500});}
