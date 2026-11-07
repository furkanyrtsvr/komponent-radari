import {decodeReadyChunk,searchReadyProducts,indexReadyProducts} from './ready-search.js?v=priced-20261107-3';
const editions=new Map(),loading=new Map();let latest=0,active=null;
function partial(state){if(state.failed||!active||active.manifest.id!==state.id)return;const found=searchReadyProducts(state.parts.filter(Boolean).flat(),active);self.postMessage({requestId:active.requestId,...found,count:null,hasMore:false,done:false,progress:state.finished,chunks:state.parts.length});}
async function loadEdition(manifest){
 let existing=editions.get(manifest.id);if(existing){const state=loading.get(manifest.id);if(state)partial(state);return existing;}
 const state={id:manifest.id,parts:new Array(manifest.chunks.length),finished:0,failed:false};loading.set(manifest.id,state);
 const task=(async()=>{let index=0;
  await Promise.all(Array.from({length:4},async()=>{for(;;){const i=index++;if(i>=manifest.chunks.length)return;const chunk=manifest.chunks[i];
   if(!(chunk.file==='objects/'+chunk.sha256+'.json.gz'||chunk.file.startsWith('catalogs/'+manifest.id+'/')&&/\/\d+\.json\.gz$/.test(chunk.file)))throw new Error('Geçersiz katalog sürümü.');
   const response=await fetch(chunk.file.startsWith('objects/')?'/api/archive-object/'+chunk.sha256:'/api/archive-file/'+manifest.id+'/'+chunk.file.split('/').at(-1),{cache:'force-cache',signal:AbortSignal.timeout(60000)});if(!response.ok)throw new Error('Hazır katalog dosyası alınamadı.');
   const products=await decodeReadyChunk(await response.arrayBuffer(),chunk.sha256);if(products.length!==chunk.products)throw new Error('Katalog ürün sayısı uyuşmuyor.');state.parts[i]=indexReadyProducts(products);state.finished++;
   if(state.finished===1||state.finished%4===0)partial(state);else if(!state.failed&&active?.manifest.id===manifest.id)self.postMessage({requestId:active.requestId,progress:state.finished,chunks:manifest.chunks.length});
  }}));return state.parts.flat();})();
 editions.set(manifest.id,task);if(editions.size>2)editions.delete(editions.keys().next().value);task.catch(()=>{state.failed=true;if(editions.get(manifest.id)===task)editions.delete(manifest.id);});task.finally(()=>{if(loading.get(manifest.id)===state)loading.delete(manifest.id);}).catch(()=>{});return task;
}
self.onmessage=async({data:m})=>{latest=m.requestId;active=m;try{const products=await loadEdition(m.manifest);if(latest!==m.requestId)return;self.postMessage({requestId:m.requestId,done:true,...searchReadyProducts(products,m)});}catch(e){if(latest===m.requestId)self.postMessage({requestId:m.requestId,error:e.message||'Hazır katalog okunamadı.'});}};
