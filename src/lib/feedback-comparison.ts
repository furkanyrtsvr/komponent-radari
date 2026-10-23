import type {LinkResult} from '../components/shopping-panels';
import {feedbackUrl,type FeedbackContext} from './feedback';
export function comparisonFeedback(result:LinkResult|null,referenceUrl:string):FeedbackContext{
  const offers=[...(result?.quotes||[]).map(q=>({...q,state:q.variantConflict?'conflict' as const:'included' as const})),...(result?.excludedQuotes||[]).map(q=>({...q,state:'excluded' as const}))];
  return {source:'comparison',referenceUrl:feedbackUrl(referenceUrl),productName:(result?.product.name||'').slice(0,240),quantity:result?.quantity||1,capturedAt:new Date().toISOString(),
    offers:[...offers.map(q=>({offerId:q.offerId.slice(0,200),store:q.store.slice(0,100),title:q.title.slice(0,300),url:feedbackUrl(q.url),productTotal:q.productTotal,checkedAt:Number.isFinite(Date.parse(q.checkedAt))?new Date(q.checkedAt).toISOString():null,source:q.fromCollector?'collector' as const:'direct' as const,state:q.state,note:(q.variantConflict||'').slice(0,500)})),
      ...(result?.availability||[]).filter(q=>!offers.some(o=>o.url===q.url)).map(q=>({offerId:'',store:q.store.slice(0,100),title:'Stok / erişim sonucu',url:feedbackUrl(q.url),productTotal:q.price>0?q.price:null,checkedAt:null,source:'unknown' as const,state:'unavailable' as const,note:q.status.slice(0,500)}))].slice(0,40),
  };
}
