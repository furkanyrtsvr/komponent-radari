import {randomUUID,createHash} from 'node:crypto';
import {retryNetwork,TransferError} from './reliable-transfer';
const hash=(b:Uint8Array)=>createHash('sha256').update(b).digest('hex');
export const CHECKPOINT_PART_BYTES=24*1024*1024;
export async function loadPublicationCheckpoint(url:string,headers:Record<string,string>){
 const response=await fetch(url+'?descriptor=1',{headers,signal:AbortSignal.timeout(60000)});if(response.status===404)return null;if(!response.ok)throw new TransferError('Yayın kaydı HTTP '+response.status);
 const pointer=await response.json() as any;
 const parts:Buffer[]=[];
 for(const part of pointer.chunks||[pointer]){const r=await retryNetwork(async()=>{const r=await fetch(url+(pointer.chunks?'?chunk='+encodeURIComponent(part.key):''),{headers:{...headers,'accept-encoding':'identity'},signal:AbortSignal.timeout(180000)});if(!r.ok)throw new TransferError('Yayın parçası HTTP '+r.status);const bytes=Buffer.from(await r.arrayBuffer());if(hash(bytes)!==part.sha256)throw new TransferError('Yayın parçası doğrulanamadı.');return bytes;});parts.push(r);}
 const bytes=Buffer.concat(parts);if(hash(bytes)!==pointer.sha256)throw new Error('Yayın kaydı bütünlüğü uyuşmuyor.');return bytes;
}
export async function savePublicationCheckpoint(url:string,headers:Record<string,string>,bytes:Buffer){
 const id=randomUUID(),chunks:{key:string;sha256:string;bytes:number}[]=[];
 for(let at=0;at<bytes.length;at+=CHECKPOINT_PART_BYTES){const part=bytes.subarray(at,at+CHECKPOINT_PART_BYTES),sha256=hash(part),key='publisher/parts/'+id+'-'+chunks.length+'.gz';
 await retryNetwork(async()=>{const r=await fetch(url+'?chunk='+encodeURIComponent(key),{method:'PUT',headers:{...headers,'content-type':'application/octet-stream','x-checkpoint-sha256':sha256},body:part as unknown as BodyInit,signal:AbortSignal.timeout(180000)});if(!r.ok)throw new TransferError('Yayın parçası kaydedilemedi HTTP '+r.status);});chunks.push({key,sha256,bytes:part.length});}
 await retryNetwork(async()=>{const r=await fetch(url,{method:'POST',headers:{...headers,'content-type':'application/json'},body:JSON.stringify({action:'checkpoint',chunks,sha256:hash(bytes),bytes:bytes.length}),signal:AbortSignal.timeout(60000)});if(!r.ok)throw new TransferError('Yayın kontrol noktası HTTP '+r.status);});
}
