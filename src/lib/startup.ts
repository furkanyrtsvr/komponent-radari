import {waitForSignal} from "./async-deadline";

/** Share initialization, but release a failed or stalled attempt for retry. */
export function startupGate(start:()=>Promise<void>,timeoutMs=15000){
  let pending:Promise<void>|undefined;
  return ()=>{
    if(!pending){
      const attempt=waitForSignal(Promise.resolve().then(start),AbortSignal.timeout(timeoutMs));
      pending=attempt.catch(error=>{
        pending=undefined;
        if(error instanceof Error && error.name==="TimeoutError")
          throw new Error("Veritabanı hazırlığı zamanında tamamlanamadı. Yeniden deneyin.");
        throw error;
      });
    }
    return pending;
  };
}

export function requestError(error:unknown){
  if(error instanceof Error && error.name==="TimeoutError")
    return new Error("Sunucu zamanında yanıt vermedi. Yeniden deneyin.");
  return error;
}

/** Only the public configuration GET uses this reader. Never replay writes or
 * authentication failures. Share/cache success within this page; release errors. */
export function startupReader<T>(read:(signal:AbortSignal)=>Promise<T>,timeoutMs=20000){
 let pending:Promise<T>|undefined;
 return (onRetry?:()=>void)=>{
  if(!pending)pending=(async()=>{
   for(let attempt=0;attempt<2;attempt++){
    try{const signal=AbortSignal.timeout(timeoutMs);return await waitForSignal(Promise.resolve().then(()=>read(signal)),signal);}
    catch(error){
     const status=error&&typeof error==='object'&&'status' in error?error.status:undefined;
     const retryable=error instanceof TypeError||error instanceof Error&&error.name==='TimeoutError'||[408,502,503,504].includes(Number(status));
     if(attempt||!retryable)throw requestError(error);
     onRetry?.();
    }
   }
   throw new Error('Uygulama ayarları alınamadı.');
  })().catch(error=>{pending=undefined;throw error;});
  return pending;
 };
}
