import {config,list,HttpError} from '@/lib/server/db';
import {storeCatalog} from '@/lib/catalog';
import {validateSnapshot} from '@/lib/catalog-snapshot';
import {saveSnapshots} from '@/lib/server/snapshots';
export const dynamic='force-dynamic';
async function authorized(request:Request){
 const secret=config('CATALOG_INGEST_SECRET');
 if(secret.length<32||request.headers.get('authorization')!==`Bearer ${secret}`)throw new HttpError(401,'Yetkisiz veri toplayıcı.');
}
export async function GET(request:Request){try{
 await authorized(request);
 const products=await list<{store_id:string;url:string}>('store_products',{},2000);
 return Response.json({watchlist:products.map(p=>({storeId:p.store_id,url:p.url}))});
}catch(e){return Response.json({error:e instanceof Error?e.message:'Hata'},{status:e instanceof HttpError?e.status:500});}}
export async function POST(request:Request){try{
 await authorized(request);
 if(Number(request.headers.get('content-length'))>500000)return Response.json({error:'İstek çok büyük'},{status:413});
 const raw=await request.text();if(raw.length>500000)return Response.json({error:'İstek çok büyük'},{status:413});
 const body=JSON.parse(raw);if(!Array.isArray(body.records)||!body.records.length||body.records.length>100)throw new HttpError(400,'1–100 kayıt gerekli.');
 const records=body.records.map((r:unknown)=>validateSnapshot(r,storeCatalog));
 for(const record of records){
  const url=new URL(record.product.url);url.hostname=storeCatalog.find(s=>s.id===record.storeId)!.domain;url.hash='';record.product.url=url.href;
 }
 return Response.json(await saveSnapshots(records));
}catch(e){return Response.json({error:e instanceof Error?e.message:'Hata'},{status:e instanceof HttpError?e.status:400});}}
