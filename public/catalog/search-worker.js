import { productIdentity, searchableText, ascii, matchBucket, catalogGroup, catalogQuery } from './product-identity.js';
let manifest;
const loaded = new Map();
const matches = new Map();
async function loadChunk(key) {
 if (loaded.has(key)) return loaded.get(key);
 const response = await fetch(`/catalog/${key}`);
 if (!response.ok) throw Error(`${key}: ${response.status}`);
 const rows = await response.json();
 // Bound browser memory when searching very large supplier catalogues.
 if (loaded.size >= 60) loaded.delete(loaded.keys().next().value);
 loaded.set(key,rows);
 return rows;
}
function shortName(name,key) {
 if (key === 'model:hcsr04:sensor:1:') return 'HC-SR04 Mesafe Sensörü';
 if (key.startsWith('model:xr2206:generator:1:')) return 'XR2206 Sinyal Jeneratörü';
 if (key.startsWith('model:xr2206:ic:1:')) return 'XR2206 Entegre';
 if (key === 'cable:jumper:male-male:40:200mm') return '40 Pin 20 cm Erkek-Erkek Jumper Kablo';
 const clean = name.replace(/\s+/g,' ').trim();
 return clean.length <= 46 ? clean : `${clean.slice(0,46).replace(/\s+\S*$/,'').trim() || clean.slice(0,43)}…`;
}
async function resolveSources(rows,store) {
 await Promise.all([...new Set(rows.map(row=>matchBucket(row.key)))].map(async bucket=>{
  if (!matches.has(bucket)) {
   const response = await fetch(`/catalog/matches/${bucket}.json`);
   if (!response.ok) throw Error('Mağaza eşleşmeleri yüklenemedi.');
   matches.set(bucket,await response.json());
  }
 }));
 return rows.map(row=>({...row,sources:(matches.get(matchBucket(row.key))[row.key] || row.sources).filter(source=>store==='all'||source.storeId===store)}));
}
async function search(message) {
 const {requestId,query='',group='all',store='all',page=0} = message;
 try {
  manifest ||= await (await fetch('/catalog/manifest.json')).json();
  const terms = searchableText(query).split(' ').filter(Boolean);
  const matchesQuery = catalogQuery(query);
  const selected = manifest.stores.filter(s=>store==='all'||s.id===store);
  const perStore = selected.map(s=>s.chunks.filter(c=>group==='all'||c.group===group).map(c=>({s,c})));
  const chunks = [];
  for (let i=0;i<Math.max(0,...perStore.map(x=>x.length));i++) for (const list of perStore) if (list[i]) chunks.push(list[i]);
  const hint = /xr2206|sinyal.jenerator/.test(ascii(query)) ? 'Ölçüm ve Test' : /esp32|arduino|stm32/.test(ascii(query)) ? 'Geliştirme Kartları' : null;
  if (hint) chunks.sort((a,b)=>Number(b.c.group===hint)-Number(a.c.group===hint));
  const limit = (page+1)*40;
  const groups = new Map(), browseCounts = new Map(), seen = new Set();
  const quota = Math.max(4,Math.ceil((limit+40)/Math.max(1,selected.length)));
  let processed=0,errors=0;
  async function publish(done) {
   const results = await resolveSources([...groups.values()].slice(page*40,limit),store);
   if (requestId!==self.currentRequest) return;
   self.postMessage({requestId,done,results,count:terms.length&&done ? groups.size : null,progress:processed,chunks:chunks.length,errors,hasMore:groups.size>limit||processed<chunks.length});
  }
  for (const {s,c} of chunks) {
   if (requestId!==self.currentRequest) return;
   try {
    const rows = await loadChunk(c.key);
    for (const [path,name,sourceCategory] of rows) {
     if (terms.length && !matchesQuery(name)) continue;
     const key = productIdentity({name,category:sourceCategory});
     let record = groups.get(key);
     if (!record) {
      if (!terms.length && (browseCounts.get(s.id)||0)>=quota) continue;
      record = {key,name,shortName:shortName(name,key),group:key.startsWith('model:xr2206:generator')?'Ölçüm ve Test':catalogGroup(name,c.group),sources:[]};
      groups.set(key,record);
      browseCounts.set(s.id,(browseCounts.get(s.id)||0)+1);
     }
     if (!record.sources.some(source=>source.url===s.base+path)) record.sources.push({storeId:s.id,url:s.base+path,sourceCategory,name});
    }
   } catch {errors++;}
   processed++; seen.add(s.id);
   if (processed%8===0) await publish(false);
   if (!terms.length && groups.size>=limit+40 && seen.size>=selected.length) break;
  }
  await publish(true);
 } catch(error) {
  if (requestId===self.currentRequest) self.postMessage({requestId,done:true,error:String(error)});
 }
}
self.onmessage = event => {self.currentRequest=event.data.requestId;void search(event.data);};
