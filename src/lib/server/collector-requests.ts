import {one,list,insert,update} from './db';
import {accountId} from '../account';
import {safeStoreUrl} from '../../stores/base';
import {storeCatalog} from '../catalog';
import {needsCollectorRequest,collectorResultMatches,type CollectorJob,type CollectorRequest} from '../collector-routing';
export async function requestCollectorRefresh(store:{id:string;domain:string},raw:string){
 const domain=storeCatalog.find(s=>s.id===store.id)?.domain||store.domain;
 const u=safeStoreUrl(raw,domain);u.hostname=domain;u.hash='';
 const id=await accountId('collector:'+store.id+':'+u.href),job=await one<CollectorJob>('scrape_jobs',{id});
 if(needsCollectorRequest(job)){
  const row={id,store_id:store.id,url:u.href,status:'collector_pending',error:null,created_at:new Date().toISOString(),finished_at:null};
  if(!job)await insert('scrape_jobs',row,true);
  else await update('scrape_jobs',{status:row.status,error:null,created_at:row.created_at,finished_at:null},{id,status:job.status,created_at:job.created_at});
 }
 return await one<CollectorJob>('scrape_jobs',{id});
}
export async function pendingCollectorRequests():Promise<CollectorRequest[]>{
 const jobs=await list<CollectorJob>('scrape_jobs',{status:'collector_pending'},500);
 return jobs.sort((a,b)=>a.created_at.localeCompare(b.created_at)).flatMap(job=>{
  const store=storeCatalog.find(s=>s.id===job.store_id);if(!store)return [];
  try{const u=safeStoreUrl(job.url,store.domain);u.hostname=store.domain;return [{id:job.id,storeId:job.store_id,url:u.href,requestedAt:job.created_at}];}catch{return [];}
 });
}
export async function failCollectorRequest(id:string,requestedAt:string,error:string){
 const job=await one<CollectorJob>('scrape_jobs',{id});
 if(job&&collectorResultMatches(job,requestedAt))await update('scrape_jobs',{status:'collector_failed',error:error.slice(0,500),finished_at:new Date().toISOString()},{id,status:'collector_pending',created_at:requestedAt});
}
export async function completeCollectorRequest(storeId:string,url:string,checkedAt:string){
 const id=await accountId('collector:'+storeId+':'+url),job=await one<CollectorJob>('scrape_jobs',{id});
 if(job&&['collector_pending','collector_failed'].includes(job.status)&&checkedAt>=job.created_at)await update('scrape_jobs',{status:'collector_completed',error:null,finished_at:checkedAt},{id,status:job.status,created_at:job.created_at});
}
export async function collectorRequestStatus(){
 const [pending,failed]=await Promise.all([list<CollectorJob>('scrape_jobs',{status:'collector_pending'},10000),list<CollectorJob>('scrape_jobs',{status:'collector_failed'},10000)]);
 return {pending:pending.length,failed:failed.length,stores:storeCatalog.map(store=>({storeId:store.id,pending:pending.filter(j=>j.store_id===store.id).length,failed:failed.filter(j=>j.store_id===store.id).length}))};
}
