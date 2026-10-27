import {spawn} from 'node:child_process';
import {appendFileSync} from 'node:fs';
const secret=process.env.CATALOG_INGEST_SECRET;if(!secret||secret.length<32)throw new Error('Toplayıcı bağlantısı gerekli.');
const site=process.env.ARCHIVE_SITE||'https://komponent-radari.equalwood4.chatgpt.site',deadline=Date.now()+Math.min(240,Math.max(1,Number(process.env.COLLECTION_SESSION_MINUTES||180)))*60000;
async function state(){const r=await fetch(site+'/api/archive-bootstrap',{headers:{authorization:'Bearer '+secret},signal:AbortSignal.timeout(30000)});if(!r.ok)throw new Error('Tarama durumu okunamadı: '+r.status);return (await r.json() as {job:null|{state:string}}).job;}
if(process.env.START_INITIAL_ARCHIVE==='true'){const r=await fetch(site+'/api/archive-bootstrap',{method:'POST',headers:{authorization:'Bearer '+secret,'content-type':'application/json'},body:JSON.stringify({action:'request'}),signal:AbortSignal.timeout(30000)});if(!r.ok)throw new Error('İlk tarama sürdürülemedi.');}
let job=await state(),initial=Boolean(job&&['running','queued'].includes(job.state)),round=0,lastPublish=0;
if(process.env.GITHUB_OUTPUT)appendFileSync(process.env.GITHUB_OUTPUT,'active='+initial+'\n');
if(!initial)process.exit(0);
do{
 console.log('Bağımsız fiyat toplama turu:',++round);
 await new Promise<void>((resolve,reject)=>{const child=spawn(process.execPath,['--import','tsx','scripts/catalog/run-bootstrap.ts'],{stdio:'inherit',env:{...process.env,GITHUB_OUTPUT:undefined,START_INITIAL_ARCHIVE:'false'}});child.on('error',reject);child.on('exit',code=>code===0?resolve():reject(new Error('Fiyat turu tamamlanamadı.')));});
 job=await state();
 if(process.env.GH_TOKEN&&Date.now()-lastPublish>=3600000){const r=await fetch('https://api.github.com/repos/furkanyrtsvr/komponent-radari/actions/workflows/archive-publish.yml/dispatches',{method:'POST',headers:{authorization:'Bearer '+process.env.GH_TOKEN,accept:'application/vnd.github+json','user-agent':'Komponent-Radari'},body:JSON.stringify({ref:'main',inputs:{minutes:'8'}}),signal:AbortSignal.timeout(30000)});if(r.ok)lastPublish=Date.now();else console.error('Ayrı yayın tetiklenemedi; fiyat ilerlemesi korundu. HTTP '+r.status);}
 if(job?.state==='running')break;
}while(job?.state==='queued'&&Date.now()+20*60000<deadline);
if(process.env.GITHUB_OUTPUT)appendFileSync(process.env.GITHUB_OUTPUT,'continue='+(job?.state==='queued')+'\n');
