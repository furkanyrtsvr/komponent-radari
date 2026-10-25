import {catalogQuery} from './product-identity.js';
export async function decodeReadyChunk(bytes,expected){
 const hash=[...new Uint8Array(await crypto.subtle.digest('SHA-256',bytes))].map(x=>x.toString(16).padStart(2,'0')).join('');if(hash!==expected)throw new Error('Hazır katalog dosyası doğrulanamadı.');
 const text=await new Response(new Blob([bytes]).stream().pipeThrough(new DecompressionStream('gzip'))).text(),products=JSON.parse(text);if(!Array.isArray(products))throw new Error('Hazır katalog biçimi geçersiz.');return products;
}
export function searchReadyProducts(products,options,at=Date.now()){
 const matches=catalogQuery(options.query),filtered=[];
 for(const p of products){
  if(options.group!=='all'&&p.group!==options.group)continue;
  const sources=p.sources.filter(s=>options.store==='all'||s.storeId===options.store),urls=new Set(sources.map(s=>s.url));
  const previews=p.previews.filter(v=>urls.has(v.url)&&v.key===p.key&&Number.isInteger(v.price)&&v.price>0&&Date.parse(v.checkedAt)<=at&&/^\/api\/archive-image\/[a-f0-9]{64}\.webp$/.test(v.image||''));
  const readyUrls=new Set(previews.map(v=>v.url)),readySources=sources.filter(s=>readyUrls.has(s.url));
  if(!readySources.length||options.query&&!matches(p.name)&&!readySources.some(s=>matches(s.name)))continue;
  filtered.push({...p,sources:readySources,previews:previews.map(v=>({...v,archiveState:at-Date.parse(v.checkedAt)<12*3600000?'fresh':'expired'}))});
 }
 const selected=filtered.slice(options.page*40,(options.page+1)*40);
 return {results:selected.map(({previews,...p})=>p),previews:selected.flatMap(p=>p.previews),count:filtered.length,hasMore:filtered.length>(options.page+1)*40};
}
