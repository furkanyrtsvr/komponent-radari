import {z} from 'zod';
import type {ExtractedProduct} from '../stores/types';
export const SNAPSHOT_TTL_MS=12*60*60*1000;
export const snapshotRecord=z.object({
 readerRevision:z.number().int().min(1).max(2).optional(),
 storeId:z.string().max(60),checkedAt:z.string().datetime(),
 product:z.object({unitType:z.enum(['adet','metre','set']).optional(),url:z.string().url().max(2000),name:z.string().min(1).max(500),mpn:z.string().max(300),manufacturer:z.string().max(300),model:z.string().max(300),image:z.string().url().max(2000).nullable(),price:z.number().int().positive().max(10000000000),currency:z.literal('TRY'),vatIncluded:z.literal(true),vatRate:z.number().min(0).max(100).nullable(),packageQuantity:z.number().int().positive().max(1000000),stockStatus:z.enum(['in_stock','out_of_stock','unknown']),stockQuantity:z.number().int().nonnegative().nullable(),specifications:z.string().max(20000),warnings:z.array(z.string().max(1000)).max(50),quantityVerified:z.literal(true),minimumOrderQuantity:z.number().int().positive(),orderStep:z.number().int().positive(),priceNet:z.number().nonnegative().nullable().optional(),priceTiers:z.array(z.object({minimum:z.number().int().positive(),maximum:z.number().int().positive().nullable(),price:z.number().int().positive(),netUnitPriceMicros:z.number().int().positive().optional(),vatBasisPoints:z.number().int().min(0).max(10000).optional(),rounding:z.literal('net-subtotal').optional()})).max(50).optional()})
});
// Corrections to the reader may replace the same observation, but never a
// later page observation. Neither branch invents a newer control timestamp.
export const SNAPSHOT_UPSERT_SQL='INSERT INTO catalog_snapshots(id,store_id,url,checked_at,payload) VALUES(?,?,?,?,?) ON CONFLICT(store_id,url) DO UPDATE SET checked_at=excluded.checked_at,payload=excluded.payload WHERE excluded.checked_at>catalog_snapshots.checked_at OR (excluded.checked_at=catalog_snapshots.checked_at AND COALESCE(json_extract(excluded.payload,\'$.readerRevision\'),0)>COALESCE(json_extract(catalog_snapshots.payload,\'$.readerRevision\'),0))';
export type SnapshotRecord=z.infer<typeof snapshotRecord>;
/** Earlier IdeaSoft observations stored the stock ceiling as the Piece sales
 * increment. Its public Piece cart control accepts one package in steps of one.
 * Repair only that known reader signature; preserve its price and observation. */
export function upgradeSnapshotReader(row:SnapshotRecord):SnapshotRecord|undefined{
 if(!['robotzade','robitshop'].includes(row.storeId)||row.readerRevision===2)return row;
 const p=row.product;
 if(!p.warnings.includes('KDV dahil mağaza fiyatı ve satış birimi doğrulandı.')||p.minimumOrderQuantity!==p.orderStep||p.stockQuantity!==null)return undefined;
 return {...row,readerRevision:2,product:{...p,minimumOrderQuantity:p.packageQuantity,orderStep:p.packageQuantity,stockQuantity:p.stockStatus==='in_stock'?p.minimumOrderQuantity:null}};
}
export function snapshotUsable(checkedAt:string,maxAge=SNAPSHOT_TTL_MS,at=Date.now()) {const age=at-Date.parse(checkedAt);return age>=0&&age<maxAge;}
export function validateSnapshot(input:unknown,stores:{id:string;domain:string}[],at=Date.now()):SnapshotRecord {
 const row=snapshotRecord.parse(input),store=stores.find(s=>s.id===row.storeId),url=new URL(row.product.url);
 if(!store||url.protocol!=='https:'||url.username||url.password||url.port||url.hostname.replace(/^www\./,'')!==store.domain.replace(/^www\./,''))throw new Error('Mağaza adresi geçersiz.');
 if(!snapshotUsable(row.checkedAt,SNAPSHOT_TTL_MS,at))throw new Error('Fiyat kontrol zamanı geçersiz veya 12 saatten eski.');
 url.hostname=store.domain;url.hash='';row.product.url=url.href;
 row.checkedAt=new Date(row.checkedAt).toISOString();
 return row;
}
export function snapshotProduct(row:SnapshotRecord):ExtractedProduct {return {...row.product,checkedAt:row.checkedAt,readMethod:'snapshot'};}
