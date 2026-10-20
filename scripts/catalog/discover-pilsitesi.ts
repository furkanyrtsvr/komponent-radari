/** Public navigation fallback; never retries or works around a denied XML endpoint. */
import {load} from 'cheerio';
import {existsSync,mkdirSync,readFileSync,writeFileSync} from 'node:fs';
import {pathToFileURL} from 'node:url';
import {robotsAllowed} from '../../src/stores/base';
const origin='https://www.pilsitesi.com';
function address(raw:string,from:string){try{const u=new URL(raw,from);if(u.protocol!=='https:'||u.username||u.password||u.hostname.replace(/^www\./,'')!=='pilsitesi.com')return null;u.hostname='www.pilsitesi.com';u.hash='';return u.href;}catch{return null;}}
export function listingEvidence(html:string,url:string){const $=load(html);return {
 products:[...new Set($('.productItem a.detailLink[href]').map((_,e)=>address($(e).attr('href')!,url)).get().filter(Boolean))],
 pages:[...new Set($('.newHeaderNavigation a[href],a[href*="sayfa="]').map((_,e)=>address($(e).attr('href')!,url)).get().filter(Boolean))],
};}
async function run(){
 mkdirSync('work/catalog',{recursive:true});
 const robotsResponse=await fetch(origin+'/robots.txt',{signal:AbortSignal.timeout(15000)});if(!robotsResponse.ok)throw new Error('Pil Sitesi robots kuralları alınamadı.');const robots=await robotsResponse.text();
 const delay=Math.max(3100,...[...robots.matchAll(/^\s*Crawl-delay:\s*([\d.]+)/gim)].map(m=>Number(m[1])*1000));
 const limit=Math.max(1,Math.min(300,Number(process.argv.find(a=>a.startsWith('--limit='))?.slice(8)||150)));if(!Number.isInteger(limit))throw new Error('Geçersiz sayfa sınırı.');
 const filename='work/catalog/pilsitesi-children.json',previous=existsSync(filename)?JSON.parse(readFileSync(filename,'utf8')):[],records=new Map<string,{url:string;kind:string;locs:string[]}>(previous.map((r:any)=>[r.url,{...r,kind:'product'}]));
 const queue=[origin+'/'],seen=new Set<string>(),errors:{url:string;status:number}[]=[];
 while(queue.length&&seen.size<limit){const url=queue.shift()!;if(seen.has(url))continue;seen.add(url);if(!robotsAllowed(robots,new URL(url).pathname+new URL(url).search))continue;
  await new Promise(r=>setTimeout(r,delay));const response=await fetch(url,{redirect:'error',headers:{'user-agent':'EUB-PriceComparison/1.0 (+public product listing index)'},signal:AbortSignal.timeout(20000)});
  if(!response.ok){errors.push({url,status:response.status});if(response.status===403||response.status===429)break;continue;}
  const html=await response.text();if(html.length>2000000)throw new Error('Liste sayfası boyut sınırını aşıyor.');const found=listingEvidence(html,url);
  records.set(url,{url,kind:'product',locs:found.products});for(const next of found.pages)if(!seen.has(next)&&!queue.includes(next))queue.push(next);
  writeFileSync(filename,JSON.stringify([...records.values()]));
 }
 writeFileSync('work/catalog/pilsitesi-discovery.json',JSON.stringify({complete:false,pages:seen.size,remaining:queue.length,errors,reason:'XML ürün site haritası yerine herkese açık menü ve sayfalama bağlantılarından kısmi keşif.'},null,2));
 console.log(JSON.stringify({pages:seen.size,products:new Set([...records.values()].flatMap(r=>r.locs)).size,remaining:queue.length,errors}));
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href)await run();
