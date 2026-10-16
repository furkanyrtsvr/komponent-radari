export const SHIPPING_TTL_MS = 24 * 60 * 60 * 1000;
export function verifiedShippingRule(row:{rules:string;last_updated:string;source_url?:string|null}, domain:string, at=Date.now()) {
  try {
    const age=at-Date.parse(row.last_updated);
    if(!Number.isFinite(age) || age<0 || age>=SHIPPING_TTL_MS) return null;
    const rule=JSON.parse(row.rules);
    const url=new URL(rule.source_url || row.source_url || "");
    if(rule.source!=="live" || url.protocol!=="https:" || url.username || url.password || url.port && url.port!=="443" || url.hostname.replace(/^www\./,"")!==domain.replace(/^www\./,"")) return null;
    const threshold=rule.free_shipping_threshold;
    if(threshold!==null && threshold!==undefined && (!Number.isSafeInteger(threshold) || threshold<0)) return null;
    return {free_shipping_threshold:threshold ?? null,source_url:url.href};
  } catch {return null;}
}
