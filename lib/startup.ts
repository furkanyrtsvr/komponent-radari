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
