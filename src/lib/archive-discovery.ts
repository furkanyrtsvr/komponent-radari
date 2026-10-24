import {catalogGroup,catalogQuery} from '../../public/catalog/product-identity.js';
import {SNAPSHOT_TTL_MS} from './catalog-snapshot';
import type {CatalogPreview} from './server/catalog-preview';
export function displayablePreview(p:CatalogPreview|undefined,at=Date.now()):p is CatalogPreview{
 return Boolean(p?.price&&p.price>0&&Number.isFinite(p.price)&&Date.parse(p.checkedAt)<=at&&(p.archiveState?p.archiveState==='fresh'||p.archiveState==='expired':at-Date.parse(p.checkedAt)<(p.maxAgeMs||20*60*1000)));
}
export function oldArchivePrice(p:CatalogPreview,at=Date.now()){
 return Boolean(p.archiveState&&at-Date.parse(p.checkedAt)>=SNAPSHOT_TTL_MS);
}
export type ArchiveProduct={key:string;name:string;group:string;sources:{storeId:string;url:string;name:string;sourceCategory:string}[];previews:CatalogPreview[]};
/** Group only identities backed by the merchant observation, never a name-only candidate. */
export function archiveProducts(items:{storeId:string;preview:CatalogPreview}[],at=Date.now()){
 const groups=new Map<string,ArchiveProduct>();
 for(const {storeId,preview:original} of items.sort((a,b)=>Date.parse(b.preview.checkedAt)-Date.parse(a.preview.checkedAt))){
  const p=original.canonicalUrl?{...original,url:original.canonicalUrl}:original;
  if(!displayablePreview(p,at)||!p.key||!p.name)continue;
  let group=groups.get(p.key);
  if(!group){group={key:p.key,name:p.name,group:catalogGroup(p.name),sources:[],previews:[]};groups.set(p.key,group);}
  if(group.sources.some(s=>s.url===p.url))continue;
  group.sources.push({storeId,url:p.url,name:p.name,sourceCategory:group.group});group.previews.push(p);
 }
 return [...groups.values()];
}
export function archivePage(products:ArchiveProduct[],options:{query:string;group:string;store:string;page:number}){
 const matches=catalogQuery(options.query);
 const filtered=products.map(p=>{
  const sources=p.sources.filter(s=>options.store==='all'||s.storeId===options.store),urls=new Set(sources.map(s=>s.url));
  return {...p,sources,previews:p.previews.filter(v=>urls.has(v.url))};
 }).filter(p=>p.sources.length&&p.previews.some(v=>v.image?.startsWith('https://'))&&(options.group==='all'||p.group===options.group)&&(!options.query||p.sources.some(s=>matches(s.name))||matches(p.name)));
 const chosen=filtered.slice(options.page*40,(options.page+1)*40);
 return {results:chosen.map(({previews,...product})=>product),previews:chosen.flatMap(p=>p.previews),count:filtered.length,hasMore:filtered.length>(options.page+1)*40};
}
