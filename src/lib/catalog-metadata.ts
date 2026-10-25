import {z} from 'zod';
import {catalogIdentity} from './catalog-identity';
import type {CatalogPreview} from './server/catalog-preview';
export const catalogMetadataSchema=z.object({storeId:z.string().max(60),url:z.string().url().max(2000),name:z.string().trim().min(3).max(500),image:z.string().url().max(2000).nullable(),observedAt:z.string().datetime(),reason:z.string().min(1).max(500)}).strict();
export type CatalogMetadata=z.infer<typeof catalogMetadataSchema>;
export function validateCatalogMetadata(input:unknown,stores:{id:string;domain:string}[],at=Date.now()){
 const p=catalogMetadataSchema.parse(input),store=stores.find(s=>s.id===p.storeId),url=new URL(p.url);
 if(!store||url.protocol!=='https:'||url.username||url.password||url.port||url.hostname.replace(/^www\./,'')!==store.domain.replace(/^www\./,''))throw new Error('Görsel kaydının mağaza adresi geçersiz.');
 if(Date.parse(p.observedAt)>at||at-Date.parse(p.observedAt)>12*3600000)throw new Error('Görsel gözlem tarihi geçersiz.');
 if(p.image){const image=new URL(p.image);if(image.protocol!=='https:'||image.username||image.password||image.port)throw new Error('Görsel adresi geçersiz.');
  if(image.hostname.replace(/^www\./,'')==='ozdisan.com'&&image.pathname.toLowerCase()==='/images/ozdisan-share-default.png')throw new Error('Özdisan genel paylaşım resmi ürün fotoğrafı değildir.');
 }
 url.hostname=store.domain;url.hash='';return {...p,url:url.href};
}
/** An image-only observation cannot add a price or change its check date. */
export function mergeCatalogMetadata(previous:Record<string,any>|undefined,metadata:CatalogMetadata):Record<string,any>|undefined{
 if(previous?.name&&catalogIdentity({name:previous.name})!==catalogIdentity({name:metadata.name}))return undefined;
 if(previous?.catalogMetadata?.observedAt>=metadata.observedAt)return undefined;
 return previous?{...previous,catalogMetadata:metadata}:{url:metadata.url,name:metadata.name,image:metadata.image,price:null,currency:'',quantityVerified:false,catalogMetadata:metadata};
}
export function enrichCatalogPreview(preview:CatalogPreview,input:unknown,stores:{id:string;domain:string}[],at=Date.now()){
 try{
  const parsed=catalogMetadataSchema.parse(input),metadata=validateCatalogMetadata(parsed,stores,Date.parse(parsed.observedAt));
  const normalize=(raw:string)=>{const url=new URL(raw);url.hostname=url.hostname.replace(/^www\./,'');url.hash='';return url.href;};
  if(Date.parse(metadata.observedAt)>at||normalize(metadata.url)!==normalize(preview.url))return preview;
  const key=catalogIdentity({name:metadata.name});if(preview.key&&preview.key!==key)return preview;
  return {...preview,name:preview.name||metadata.name,key:preview.key||key,image:preview.image||metadata.image,metadataOnly:!preview.price,metadataObservedAt:metadata.observedAt,message:preview.price?preview.message:'Fiyat doğrulanamadı: '+metadata.reason,archiveState:preview.price?preview.archiveState:'invalid' as const};
 }catch{return preview;}
}
