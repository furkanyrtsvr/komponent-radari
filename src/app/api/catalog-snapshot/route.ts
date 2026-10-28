import {config,list,HttpError,insert,update} from '@/lib/server/db';
import {z} from 'zod';
import {storeCatalog} from '@/lib/catalog';
import {validateSnapshot} from '@/lib/catalog-snapshot';
import {saveSnapshots} from '@/lib/server/snapshot-write';
import {collectorWatchlist} from '@/lib/server/collector-watchlist';
import {validateCatalogMetadata} from '@/lib/catalog-metadata';
import {saveCatalogMetadata} from '@/lib/server/catalog-metadata';
import {pendingCollectorRequests,failCollectorRequest,completeCollectorRequests} from '@/lib/server/collector-requests';
export const dynamic='force-dynamic';
async function authorized(request:Request){
 const secret=config('CATALOG_INGEST_SECRET');
 if(secret.length<32||request.headers.get('authorization')!==`Bearer ${secret}`)throw new HttpError(401,'Yetkisiz veri toplayıcı.');
}
export async function GET(request:Request){try{
 await authorized(request);
 const [requests,watchlist]=await Promise.all([pendingCollectorRequests(),collectorWatchlist()]);
 return Response.json({requests,watchlist});
}catch(e){return Response.json({error:e instanceof Error?e.message:'Hata'},{status:e instanceof HttpError?e.status:500});}}
export async function POST(request:Request){try{
 await authorized(request);
 if(Number(request.headers.get('content-length'))>500000)return Response.json({error:'İstek çok büyük'},{status:413});
 const raw=await request.text();if(raw.length>500000)return Response.json({error:'İstek çok büyük'},{status:413});
 const body=JSON.parse(raw),input=body.records||[],images=body.metadata||[];
 if(!Array.isArray(input)||!Array.isArray(images)||input.length+images.length<1||input.length>100||images.length>100)throw new HttpError(400,'1–100 fiyat veya görsel kaydı gerekli.');
 const records=input.map((r:any)=>{const at=Date.parse(r?.checkedAt);if(!Number.isFinite(at)||at>Date.now())throw new HttpError(400,'Fiyat kontrol tarihi geçersiz.');return validateSnapshot(r,storeCatalog,at);}),metadata=images.map((r:unknown)=>validateCatalogMetadata(r,storeCatalog));
 for(const record of records){
  const url=new URL(record.product.url);url.hostname=storeCatalog.find(s=>s.id===record.storeId)!.domain;url.hash='';record.product.url=url.href;
 }
 const saved=await saveSnapshots(records),metadataSaved=await saveCatalogMetadata(metadata);
 await completeCollectorRequests(records.map(record=>({storeId:record.storeId,url:record.requestedUrl||record.product.url,checkedAt:record.checkedAt})));
 return Response.json({...saved,metadata:metadataSaved});
}catch(e){return Response.json({error:e instanceof Error?e.message:'Hata'},{status:e instanceof HttpError?e.status:400});}}
export async function PATCH(request:Request){try{
 await authorized(request);
 const raw=await request.text();if(raw.length>100000)throw new HttpError(413,'Durum kaydı çok büyük.');
 const body=z.object({failures:z.array(z.object({id:z.string().uuid(),requestedAt:z.string().datetime(),error:z.string().min(1).max(500)})).max(100)}).parse(JSON.parse(raw));
 for(const row of body.failures)await failCollectorRequest(row.id,row.requestedAt,row.error);
 return Response.json({acknowledged:body.failures.length});
}catch(e){return Response.json({error:e instanceof Error?e.message:'Hata'},{status:e instanceof HttpError?e.status:400});}}
export async function PUT(request:Request){try{
 await authorized(request);
 const raw=await request.text();if(raw.length>100000)throw new HttpError(413,'Durum kaydı çok büyük.');
 const payload=z.object({state:z.enum(['running','completed']),startedAt:z.string().datetime(),checked:z.number().int().nonnegative(),failed:z.number().int().nonnegative(),uploaded:z.number().int().nonnegative(),indexed:z.number().int().nonnegative(),stores:z.array(z.object({store_id:z.string().max(60),indexed:z.number(),verified:z.number(),error:z.string().max(500).nullable()})).max(25)}).parse(JSON.parse(raw));
 await insert('catalog_collection_runs',{id:'latest',updated_at:new Date().toISOString(),payload:JSON.stringify(payload)},true);
 await update('catalog_collection_runs',{updated_at:new Date().toISOString(),payload:JSON.stringify(payload)},{id:'latest'});
 return Response.json({saved:true});
}catch(e){return Response.json({error:e instanceof Error?e.message:'Hata'},{status:e instanceof HttpError?e.status:400});}}
