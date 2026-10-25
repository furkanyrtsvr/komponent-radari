import type {CatalogPreview} from './server/catalog-preview';
type Store={id:string;domain:string;enabled?:boolean|number};
/** Enqueue exact merchant URLs; a request never becomes a new price observation. */
export async function refreshArchivePreviews(values:CatalogPreview[],stores:Store[],enqueue:(store:Store,url:string)=>Promise<{status:string;error?:string|null}|undefined>){
 const requested=new Map<string,CatalogPreview>();
 for(const p of values.slice(0,20)){
  if(p.archiveState==='fresh'||requested.has(p.url))continue;
  const u=new URL(p.url),store=stores.find(s=>s.enabled!==false&&s.enabled!==0&&s.domain.replace(/^www\./,'')===u.hostname.replace(/^www\./,''));
  if(!store||u.protocol!=='https:'||u.username||u.password||u.port)continue;
  try{const job=await enqueue(store,p.url),pending=job?.status==='collector_pending';
   requested.set(p.url,{...p,collectorPending:pending,collectorManaged:true,message:(p.price?'Kayıtlı fiyatın kontrol tarihi korunuyor. ':'Bu bağlantının doğrulanmış fiyatı henüz arşivde yok. ')+(pending?'Mağaza sayfası öncelikli otomatik toplama sırasına alındı; işlem tamamlanınca arşivi yeniden oku.':job?.error?'Son toplama hatası: '+job.error:'Yeniden toplama isteği bekleme süresinde.')});
  }catch{requested.set(p.url,{...p,message:p.message+' Toplama isteği kaydedilemedi; yeniden dene.'});}
 }
 return values.map(p=>requested.get(p.url)||p);
}
