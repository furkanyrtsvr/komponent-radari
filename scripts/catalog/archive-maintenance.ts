import {retryNetwork,TransferError} from './reliable-transfer';
export async function maintainArchive(site:string,headers:Record<string,string>,maxPages=Infinity){
 let total=0;
 for(let i=0;i<maxPages;i++){const page=await retryNetwork(async()=>{const r=await fetch(site+'/api/archive-build',{method:'POST',headers:{...headers,'content-type':'application/json'},body:JSON.stringify({action:'retire'}),signal:AbortSignal.timeout(90000)});if(!r.ok){const detail=await r.json().catch(()=>({})) as {error?:string};throw new TransferError('Arşiv bakım HTTP '+r.status+' · '+String(detail.error||'').slice(0,300));}return await r.json() as {removed:number;done?:boolean};});
 total+=page.removed;if(total%10000===0||page.done)console.log(JSON.stringify({phase:'retired-staging-backed-up',rows:total}));if(page.done===true)return;
 }
}
