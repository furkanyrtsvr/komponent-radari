import {catalogIdentity} from './catalog-identity';
import {SNAPSHOT_TTL_MS,snapshotUsable,validateSnapshot,upgradeSnapshotReader} from './catalog-snapshot';
import type {CatalogPreview} from './server/catalog-preview';

export const ARCHIVE_PREVIEW_BATCH=120;
type Store={id:string;domain:string;enabled:boolean|number};
type Row={store_id:string;url:string;checked_at:string;payload:string};
function address(raw:string,domain:string){
 const url=new URL(raw);
 if(url.protocol!=='https:'||url.username||url.password||url.port||url.hostname.replace(/^www\./,'')!==domain.replace(/^www\./,''))throw new Error('Desteklenen mağaza bağlantısı gerekli.');
 url.hostname=domain.replace(/^www\./,'');url.hash='';return url.href;
}

/** Archive browsing has only a database reader: a miss cannot fall through to
 * a merchant adapter, enqueue a refresh, or advance an observation's date. */
export async function archivePreviews(urls:string[],stores:Store[],read:(urls:string[])=>Promise<Row[]>,at=Date.now()):Promise<CatalogPreview[]>{
 const targets=[...new Set(urls)].slice(0,ARCHIVE_PREVIEW_BATCH).map(url=>{
  const host=new URL(url).hostname.replace(/^www\./,'');
  const store=stores.find(s=>s.enabled&&s.domain.replace(/^www\./,'')===host);
  if(!store)throw new Error('Desteklenen mağaza bağlantısı gerekli.');
  return {url,store,key:store.id+':'+address(url,store.domain)};
 });
 const rows=await read(targets.map(t=>t.url));
 const latest=new Map<string,Row>();
 for(const row of rows){
  const store=stores.find(s=>s.id===row.store_id);if(!store)continue;
  try{const key=store.id+':'+address(row.url,store.domain),previous=latest.get(key);if(!previous||Date.parse(row.checked_at)>Date.parse(previous.checked_at))latest.set(key,row);}catch{/* Ignore an invalid stored address. */}
 }
 return targets.map(({url,store,key})=>{
  const row=latest.get(key);
  const empty:CatalogPreview={url,name:'',image:null,key:'',price:null,stockStatus:'unknown',checkedAt:row?.checked_at||'',maxAgeMs:SNAPSHOT_TTL_MS,archiveState:'missing',message:'Arşivde doğrulanmış fiyat kaydı yok. Otomatik tarama sırayla devam eder.'};
  if(!row)return empty;
  try{
   const parsed=JSON.parse(row.payload);
   // Validate schema, merchant, tax and quantity evidence even for expired rows.
   const valid=validateSnapshot(parsed,stores,Date.parse(row.checked_at));
   if(valid.storeId!==store.id||Date.parse(valid.checkedAt)!==Date.parse(row.checked_at))throw new Error('Arşiv kaydı tutarsız.');
   const record=upgradeSnapshotReader(valid);if(!record)throw new Error('Fiyat kanıtı geçersiz.');
   const p=record.product,fresh=snapshotUsable(row.checked_at,SNAPSHOT_TTL_MS,at);
   return {...empty,name:p.name,key:catalogIdentity(p),image:p.image?.startsWith('https://')?p.image:null,packageQuantity:p.packageQuantity,unitType:p.unitType,
    price:fresh?p.price:null,stockStatus:fresh?p.stockStatus:'unknown',archiveState:fresh?'fresh':'expired',
    message:fresh?'Arşiv fiyatı; mağazadaki son kontrol: '+row.checked_at:'Arşiv kaydı 12 saatlik kullanım süresinin dışında; fiyat gösterilmiyor.'};
  }catch{return {...empty,archiveState:'invalid',message:'Arşivdeki fiyat ve satış birimi doğrulanamadı; fiyat gösterilmiyor.'};}
 });
}
