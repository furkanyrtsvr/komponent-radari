import {catalogQuery,prepareCatalogSearchTitle} from './product-identity.js?v=priced-20261107-3';
const titles=new WeakMap();
export function indexReadyProducts(products){for(const p of products){if(!titles.has(p))titles.set(p,prepareCatalogSearchTitle(p.name));for(const source of p.sources)if(!titles.has(source))titles.set(source,source.name===p.name?titles.get(p):prepareCatalogSearchTitle(source.name));}return products;}
function matchesTitle(matches,item){let value=titles.get(item);if(!value){value=prepareCatalogSearchTitle(item.name);titles.set(item,value);}return matches.prepared(value);}
export async function decodeReadyChunk(bytes,expected){
 const hash=[...new Uint8Array(await crypto.subtle.digest('SHA-256',bytes))].map(x=>x.toString(16).padStart(2,'0')).join('');if(hash!==expected)throw new Error('Hazır katalog dosyası doğrulanamadı.');
 const text=await new Response(new Blob([bytes]).stream().pipeThrough(new DecompressionStream('gzip'))).text(),products=JSON.parse(text);if(!Array.isArray(products))throw new Error('Hazır katalog biçimi geçersiz.');return products;
}
export function searchReadyProducts(products,options,at=Date.now()){
 const matches=catalogQuery(options.query),selected=[];let count=0;const offset=options.page*40;
 for(const p of products){
  if(options.group!=='all'&&p.group!==options.group)continue;
  const sources=p.sources.filter(s=>options.store==='all'||s.storeId===options.store);
  if(options.query&&!matchesTitle(matches,p)&&!sources.some(s=>matchesTitle(matches,s)))continue;
  const urls=new Set(sources.map(s=>s.url));
  const previews=p.previews.filter(v=>urls.has(v.url)&&v.key===p.key&&Number.isInteger(v.price)&&v.price>0&&Date.parse(v.checkedAt)<=at&&(/^\/api\/archive-image\/[a-f0-9]{64}\.webp$/.test(v.image||'')||v.image===null&&v.imagePending===true));
  const readyUrls=new Set(previews.map(v=>v.url)),readySources=sources.filter(s=>readyUrls.has(s.url));
  if(!readySources.length||options.query&&!matchesTitle(matches,p)&&!readySources.some(s=>matchesTitle(matches,s)))continue;
  if(count>=offset&&selected.length<40)selected.push({...p,sources:readySources,previews:previews.map(v=>({...v,archiveState:at-Date.parse(v.checkedAt)<12*3600000?'fresh':'expired'}))});count++;
 }
 return {results:selected.map(({previews,...p})=>p),previews:selected.flatMap(p=>p.previews),count,hasMore:count>(options.page+1)*40};
}
