/** Leave room for manual refresh and another open tab under the API request budget. */
export function previewWait(lastStarted:number,blockedUntil:number,at=Date.now()){
 return Math.max(0,lastStarted+2500-at,blockedUntil-at);
}
