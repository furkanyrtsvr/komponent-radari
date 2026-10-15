// Waiting on a shared read must respect the caller's deadline without cancelling
// the shared read for other callers. Always attach rejection handlers to it.
export function waitForSignal<T>(promise:Promise<T>,signal:AbortSignal):Promise<T>{
  if(signal.aborted){void promise.catch(()=>{});return Promise.reject(signal.reason);}
  return new Promise((resolve,reject)=>{
    const abort=()=>{cleanup();reject(signal.reason);};
    const cleanup=()=>signal.removeEventListener("abort",abort);
    signal.addEventListener("abort",abort,{once:true});
    promise.then(value=>{cleanup();resolve(value);},error=>{cleanup();reject(error);});
  });
}

// Each basket product gets its first candidate before another gets its second.
export function fairRefreshQueue<T extends {productId:string}>(sources:T[],priority:(source:T)=>number){
  const groups=new Map<string,T[]>();
  for(const source of sources){const group=groups.get(source.productId)||[];group.push(source);groups.set(source.productId,group);}
  for(const group of groups.values())group.sort((a,b)=>priority(a)-priority(b));
  const ordered:T[]=[];
  for(let round=0;round<Math.max(0,...[...groups.values()].map(group=>group.length));round++)
    for(const group of groups.values())if(group[round])ordered.push(group[round]);
  return ordered;
}
