import {z} from 'zod';
import {storeCatalog} from './catalog';

export const feedbackKinds={matching:'Yanlış ürün eşleşmesi',price:'Fiyat / stok hatası',specification:'Teknik özellik / paket hatası',feature:'Özellik önerisi',other:'Diğer'} as const;
export const feedbackStatuses={open:'Alındı',reviewing:'İnceleniyor',resolved:'Çözüldü'} as const;
// Keep only public merchant links. Query strings can contain personal tokens.
export function feedbackUrl(raw:string){
  try{const u=new URL(raw);if(u.protocol!=='https:'||u.username||u.password||u.port)return '';
    if(!storeCatalog.some(s=>s.domain.replace(/^www\./,'')===u.hostname.replace(/^www\./,'')))return '';
    u.search='';u.hash='';return u.href;
  }catch{return '';}
}
const safeUrl=z.string().max(2000).refine(value=>value===''||feedbackUrl(value)===value,'Desteklenen mağazanın herkese açık HTTPS bağlantısını kullanın.');
const text=(length:number)=>z.string().trim().min(1).max(length);
export const feedbackContextSchema=z.object({
  source:z.enum(['comparison','general']),referenceUrl:safeUrl,
  productName:z.string().max(240),quantity:z.number().int().min(1).max(100000),
  capturedAt:z.string().datetime(),
  offers:z.array(z.object({offerId:z.string().max(200),store:text(100),title:text(300),url:safeUrl,
    productTotal:z.number().int().nonnegative().max(1000000000).nullable(),
    checkedAt:z.string().datetime().nullable(),source:z.enum(['collector','direct','unknown']),
    state:z.enum(['included','excluded','conflict','unavailable']),note:z.string().max(500),
  })).max(40),
});
export type FeedbackContext=z.infer<typeof feedbackContextSchema>;
export const createFeedbackSchema=z.object({id:z.string().uuid(),title:text(140),kind:z.enum(['matching','price','specification','feature','other']),message:text(4000),context:feedbackContextSchema});
export const feedbackMessageSchema=z.object({id:z.string().uuid(),message:text(4000)});
export type FeedbackReport={id:string;user_id:string;title:string;kind:keyof typeof feedbackKinds;status:keyof typeof feedbackStatuses;context:string;created_at:string;updated_at:string};
export type FeedbackMessage={id:string;report_id:string;author_id:string;author_role:'reporter'|'admin';body:string;created_at:string};
export type FeedbackDetail={report:FeedbackReport;messages:FeedbackMessage[]};

export function emptyFeedbackContext():FeedbackContext{return {source:'general',referenceUrl:'',productName:'',quantity:1,capturedAt:new Date().toISOString(),offers:[]};}
