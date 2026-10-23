import { productIdentity, searchableText, ascii, matchBucket, catalogGroup, catalogQuery } from './product-identity.js?v=20261023-discovery2';
let manifest;
const loaded = new Map();
const matches = new Map();
function browseOrder(perStore){
 const lists=[...perStore.values()].map(list=>[...list.values()]),result=[],seen=new Set();
 for(let i=0;i<Math.max(0,...lists.map(list=>list.length));i++)for(const list of lists){const row=list[i];if(row&&!seen.has(row.key)){seen.add(row.key);result.push(row);}}
 return result;
}
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
  const groups = new Map(), browseRows = new Map(selected.map(s=>[s.id,new Map()]));
  const quota = limit+40;
  let processed=0,errors=0;
  async function publish(done) {
   const ordered=terms.length?[...groups.values()]:browseOrder(browseRows);
   const results = await resolveSources(ordered.slice(page*40,limit),store);
   if (requestId!==self.currentRequest) return;
   self.postMessage({requestId,done,results,count:terms.length&&done ? groups.size : null,progress:processed,chunks:chunks.length,errors,hasMore:ordered.length>limit||processed<chunks.length});
  }
  for (const {s,c} of chunks) {
   if (requestId!==self.currentRequest) return;
   if(!terms.length&&browseRows.get(s.id).size>=quota){processed++;continue;}
   try {
    const rows = await loadChunk(c.key);
    for (const [path,name,sourceCategory] of rows) {
     const actualGroup=catalogGroup(name,c.group);
     if(group!=='all'&&actualGroup!==group)continue;
     if (terms.length && !matchesQuery(name)) continue;
     const key = productIdentity({name,category:sourceCategory});
     let record = groups.get(key);
     if (!record) {
      if (!terms.length && browseRows.get(s.id).size>=quota) continue;
      record = {key,name,shortName:shortName(name,key),group:key.startsWith('model:xr2206:generator')?'Ölçüm ve Test':actualGroup,sources:[]};
      groups.set(key,record);
     }
     if(!terms.length&&!browseRows.get(s.id).has(key)&&browseRows.get(s.id).size<quota)browseRows.get(s.id).set(key,record);
     if (!record.sources.some(source=>source.url===s.base+path)) record.sources.push({storeId:s.id,url:s.base+path,sourceCategory,name});
    }
   } catch {errors++;}
   processed++;
   if (processed%8===0) await publish(false);
  }
  await publish(true);
 } catch(error) {
  if (requestId===self.currentRequest) self.postMessage({requestId,done:true,error:String(error)});
 }
}
self.onmessage = event => {self.currentRequest=event.data.requestId;void search(event.data);};
