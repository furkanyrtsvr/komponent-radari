export const COLLECTOR_STORES=['robotistan','robotzade','robitshop','ulutas','f1depo'] as const;
export const usesCollector=(storeId:string)=>COLLECTOR_STORES.some(id=>id===storeId);
export const COLLECTOR_TTL_MS=12*60*60*1000;
export const COLLECTOR_RETRY_MS=15*60*1000;
export type CollectorRequest={id:string;storeId:string;url:string;requestedAt:string};
export type CollectorJob={id:string;store_id:string;url:string;status:string;error:string|null;created_at:string;finished_at:string|null};
export class CollectorReadError extends Error{constructor(message:string,public pending:boolean){super(message);this.name='CollectorReadError';}}
export function needsCollectorRequest(job:CollectorJob|undefined,at=Date.now()){
 return !job||job.status!=='collector_pending'&&(!job.finished_at||at-Date.parse(job.finished_at)>=COLLECTOR_RETRY_MS);
}
export function collectorLabel(checkedAt:string){return 'Toplayıcı arşivi · son kontrol '+new Date(checkedAt).toLocaleString('tr-TR');}
export function collectorResultMatches(job:CollectorJob,requestedAt:string){return job.status==='collector_pending'&&job.created_at===requestedAt;}
export function normalizeCollectorUrl(raw:string,domain:string){
 const u=new URL(raw);if(u.protocol!=='https:'||u.username||u.password||u.port||u.hostname.replace(/^www\./,'')!==domain.replace(/^www\./,''))throw new Error('Toplayıcı mağaza adresi geçersiz.');
 u.hostname=domain;u.hash='';return u.href;
}
