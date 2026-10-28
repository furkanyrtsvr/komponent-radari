export class TransferError extends Error{readonly retryable=true;}
export function transientTransfer(error:unknown){return error instanceof TransferError||error instanceof Error&&(['AbortError','TimeoutError'].includes(error.name)||/fetch failed|ECONNRESET|ETIMEDOUT|HTTP (?:408|429|5\d\d)/i.test(error.message));}
type Options={fetch?:typeof fetch;sleep?:(ms:number)=>Promise<void>;timeoutMs?:number;attempts?:number};
export async function retryNetwork<T>(action:()=>Promise<T>,sleep:(ms:number)=>Promise<void>=ms=>new Promise(r=>setTimeout(r,ms))){for(let n=0;;n++)try{return await action();}catch(e){if(n>=2||!transientTransfer(e))throw e;await sleep(1000*2**n);}}
/** Each acknowledgement is committed separately; a timeout can replay safely. */
export async function transferRecords<T>(records:T[],url:string,headers:Record<string,string>,ack:(rows:T[])=>void,options:Options={}){
 const request=options.fetch||fetch,sleep=options.sleep||(ms=>new Promise(r=>setTimeout(r,ms))),attempts=options.attempts||3;
 let saved=0;
 async function send(rows:T[]):Promise<void>{let last:unknown;let retryable=true;
  for(let n=0;n<attempts;n++)try{const response=await request(url,{method:'POST',headers:{...headers,'content-type':'application/json'},body:JSON.stringify({records:rows}),signal:AbortSignal.timeout(options.timeoutMs||60000)});if(!response.ok){retryable=response.status===408||response.status===429||response.status>=500;if(response.status===413)break;if(!retryable)throw new Error('Fiyat aktarımı HTTP '+response.status);throw new TransferError('Fiyat aktarımı HTTP '+response.status);}const result=await response.json() as {saved:number;ignored:number};if(result.saved+result.ignored!==rows.length){retryable=false;throw new Error('Aktarım onayı kayıt sayısıyla uyuşmuyor.');}ack(rows);saved+=rows.length;return;}catch(e){last=e;if(!retryable)throw e;if(n+1<attempts)await sleep(Math.min(30000,1000*2**n));}
  if(rows.length>1){const split=Math.ceil(rows.length/2);await send(rows.slice(0,split));await send(rows.slice(split));return;}
  throw new TransferError('Fiyat aktarımı ertelendi; onaysız kayıt kontrol noktasında korunuyor. '+(last instanceof Error?last.message:'Sunucu yanıt vermedi.'));
 }
 let batch:T[]=[];let bytes=16;
 for(const record of records){const size=Buffer.byteLength(JSON.stringify(record))+1;if(batch.length&&(batch.length>=10||bytes+size>200000)){await send(batch);batch=[];bytes=16;}batch.push(record);bytes+=size;}
 if(batch.length)await send(batch);return saved;
}
