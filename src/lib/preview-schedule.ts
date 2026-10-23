/** Leave room for manual refresh and another open tab under the API request budget. */
export function previewWait(lastStarted:number,blockedUntil:number,at=Date.now()){
 return Math.max(0,lastStarted+2500-at,blockedUntil-at);
}

export function previewBatch(urls:string[],attempted:Set<string>,phase:'A'|'B'){
 const remaining=[...new Set(urls)].filter(url=>!attempted.has(url));
 return phase==='B'?remaining.slice(0,120):remaining.filter((url,index,all)=>all.findIndex(other=>new URL(other).hostname===new URL(url).hostname)===index).slice(0,4);
}
