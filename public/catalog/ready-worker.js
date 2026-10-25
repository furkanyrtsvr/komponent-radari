import {decodeReadyChunk,searchReadyProducts} from './ready-search.js';
const editions=new Map();let latest=0;
async function loadEdition(manifest,requestId){
 let existing=editions.get(manifest.id);if(existing)return existing;
 const task=(async()=>{const parts=new Array(manifest.chunks.length);let index=0,finished=0;
  await Promise.all(Array.from({length:4},async()=>{for(;;){const i=index++;if(i>=manifest.chunks.length)return;const chunk=manifest.chunks[i];
   if(!chunk.file.startsWith('catalogs/'+manifest.id+'/')||!/\/\d+\.json\.gz$/.test(chunk.file))throw new Error('Geçersiz katalog sürümü.');
   const response=await fetch('/api/archive-file/'+manifest.id+'/'+chunk.file.split('/').at(-1),{cache:'force-cache',signal:AbortSignal.timeout(60000)});if(!response.ok)throw new Error('Hazır katalog dosyası alınamadı.');
   parts[i]=await decodeReadyChunk(await response.arrayBuffer(),chunk.sha256);if(parts[i].length!==chunk.products)throw new Error('Katalog ürün sayısı uyuşmuyor.');finished++;self.postMessage({requestId,progress:finished,chunks:manifest.chunks.length});
  }}));return parts.flat();})();
 editions.set(manifest.id,task);if(editions.size>2)editions.delete(editions.keys().next().value);task.catch(()=>editions.delete(manifest.id));return task;
}
self.onmessage=async({data:m})=>{latest=m.requestId;try{const products=await loadEdition(m.manifest,m.requestId);if(latest!==m.requestId)return;self.postMessage({requestId:m.requestId,done:true,...searchReadyProducts(products,m)});}catch(e){if(latest===m.requestId)self.postMessage({requestId:m.requestId,error:e.message||'Hazır katalog okunamadı.'});}};
