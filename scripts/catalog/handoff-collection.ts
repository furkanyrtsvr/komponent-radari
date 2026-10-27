// One-time safe transition: ask the old worker to checkpoint, never cancel it.
export {};
const site=process.env.ARCHIVE_SITE||'https://komponent-radari.equalwood4.chatgpt.site',secret=process.env.CATALOG_INGEST_SECRET,token=process.env.GH_TOKEN;
if(!secret||!token)throw new Error('Güvenli geçiş bağlantısı gerekli.');
async function api(body?:unknown){const r=await fetch(site+'/api/archive-bootstrap',{method:body?'POST':'GET',headers:{authorization:'Bearer '+secret,...(body?{'content-type':'application/json'}:{})},body:body?JSON.stringify(body):undefined,signal:AbortSignal.timeout(30000)});if(!r.ok)throw new Error('Geçiş API HTTP '+r.status);return (await r.json() as any).job;}
const before=await api();if(!before||!['running','queued'].includes(before.state))throw new Error('Devralınacak etkin ilk tarama yok; otomatik yeniden başlatılmadı.');
if(before.state==='running'){
 await api({action:'handoff'});const deadline=Date.now()+10*60000;let after=await api();
 while(after?.id===before.id&&after.state==='running'&&Date.now()<deadline){await new Promise(r=>setTimeout(r,5000));after=await api();}
 if(after?.id!==before.id||after?.state!=='paused'||!after.checkpointAt||after.checkpointAt===before.checkpointAt||after.lastError)throw new Error('Yeni güvenli kontrol noktası doğrulanamadı; eski iş zorla durdurulmadı.');
 const run=String(before.workerUrl||'').match(/^https:\/\/github\.com\/furkanyrtsvr\/komponent-radari\/actions\/runs\/(\d+)$/)?.[1];
 if(run){const deadline=Date.now()+3*60000;let completed=false;while(Date.now()<deadline){const r=await fetch('https://api.github.com/repos/furkanyrtsvr/komponent-radari/actions/runs/'+run,{headers:{authorization:'Bearer '+token,accept:'application/vnd.github+json','user-agent':'Komponent-Radari'},signal:AbortSignal.timeout(30000)});if(!r.ok)throw new Error('Eski işin kayıt durumu okunamadı.');if((await r.json() as any).status==='completed'){completed=true;break;}await new Promise(r=>setTimeout(r,5000));}if(!completed)throw new Error('Görsel önbelleğinin kaydedilmesi henüz tamamlanmadı.');}
}
const resumed=await api({action:'request'});if(resumed?.id!==before.id||resumed.lastAttempted<before.lastAttempted)throw new Error('Önceki tarama ilerlemesi doğrulanamadı.');
const r=await fetch('https://api.github.com/repos/furkanyrtsvr/komponent-radari/actions/workflows/catalog-archive.yml/dispatches',{method:'POST',headers:{authorization:'Bearer '+token,accept:'application/vnd.github+json','user-agent':'Komponent-Radari'},body:JSON.stringify({ref:'main',inputs:{limit:'250'}}),signal:AbortSignal.timeout(30000)});if(!r.ok)throw new Error('Yeni fiyat işçisi tetiklenemedi: '+r.status);
console.log(JSON.stringify({handoff:'checkpoint-preserved',job:resumed.id,attempted:resumed.lastAttempted,checkpointAt:resumed.checkpointAt}));
