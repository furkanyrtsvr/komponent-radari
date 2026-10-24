import {insert,update,listIn,binding,isSupabase,pages} from './db';
import {addressAliases} from './snapshots';
import {mergeCatalogMetadata,type CatalogMetadata} from '../catalog-metadata';
type Row={id:string;store_id:string;url:string;raw_data:string};
export async function catalogMetadataImages(){
 if(!isSupabase())return (await binding().prepare(`SELECT store_id,url,json_extract(raw_data,'$.catalogMetadata') AS metadata FROM store_products WHERE CASE WHEN json_valid(raw_data) THEN json_type(raw_data,'$.catalogMetadata')='object' ELSE 0 END`).all<{store_id:string;url:string;metadata:string}>()).results;
 const result:{store_id:string;url:string;metadata:string}[]=[];
 for await(const batch of pages<Row>('store_products'))for(const row of batch){try{const metadata=JSON.parse(row.raw_data).catalogMetadata;if(metadata)result.push({store_id:row.store_id,url:row.url,metadata:JSON.stringify(metadata)});}catch{/* Ignore malformed metadata. */}}
 return result;
}
export async function saveCatalogMetadata(records:CatalogMetadata[]){
 const previous=await listIn<Row>('store_products','url',records.flatMap(r=>addressAliases(r.url)));let saved=0;
 for(const record of records){
  const row=previous.find(p=>p.store_id===record.storeId&&addressAliases(record.url).includes(p.url));
  let raw:Record<string,any>|undefined;try{if(row)raw=JSON.parse(row.raw_data);}catch{continue;}
  const next=mergeCatalogMetadata(raw,record);if(!next)continue;
  if(row)await update('store_products',{raw_data:JSON.stringify(next)},{id:row.id});
  else await insert('store_products',{id:crypto.randomUUID(),store_id:record.storeId,url:record.url,title:record.name,mpn:'',raw_data:JSON.stringify(next)},true);
  saved++;
 }
 return {saved,ignored:records.length-saved};
}
