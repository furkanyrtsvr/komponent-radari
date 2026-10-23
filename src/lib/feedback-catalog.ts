import {feedbackUrl,type FeedbackContext} from './feedback';
import type {CatalogPreview} from './server/catalog-preview';
export type FeedbackCatalogProduct={key:string;name:string;group:string;sources:{storeId:string;url:string;name?:string;sourceCategory:string}[]};
export function catalogFeedback(product:FeedbackCatalogProduct,previews:Record<string,CatalogPreview>,stores:{id:string;name:string}[],filters:{query:string;group:string;store:string;page:number}):FeedbackContext{
  const at=Date.now();
  return {source:'catalog',referenceUrl:feedbackUrl(product.sources[0]?.url||''),productName:product.name.slice(0,240),quantity:1,capturedAt:new Date(at).toISOString(),catalog:{...filters,query:filters.query.slice(0,300),productKey:product.key.slice(0,500)},
    offers:product.sources.slice(0,40).map(source=>{const p=previews[source.url],timestamp=Date.parse(p?.checkedAt||'');const observed=Boolean(p?.price&&p.key===product.key&&timestamp<=at&&at-timestamp<(p.maxAgeMs||20*60*1000));
      return {offerId:source.url.slice(0,200),store:(stores.find(s=>s.id===source.storeId)?.name||source.storeId).slice(0,100),title:(p?.name||source.name||product.name).slice(0,300),url:feedbackUrl(source.url),productTotal:observed?p.price:null,checkedAt:Number.isFinite(timestamp)?new Date(timestamp).toISOString():null,source:p?.collectorManaged?'collector' as const:observed?'direct' as const:'unknown' as const,state:observed&&p.stockStatus==='in_stock'?'included' as const:'unavailable' as const,note:([source.sourceCategory,p?.key&&p.key!==product.key?'Ürün kimliği seçilen kayıtla uyuşmadı.':'',p?.message||'',p?.stockStatus||''].filter(Boolean).join(' · ')).slice(0,500)};
    }),
  };
}
