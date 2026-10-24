/** Normalize the main product's merchant-provided image, never a substitute
 * photograph from a similar item or an invented image. */
export function productImage(raw:unknown,pageUrl:string,fallback?:unknown):string|null{
 const values=Array.isArray(raw)?raw:[raw];
 for(let value of [...values,fallback]){
  if(value&&typeof value==='object')value=(value as {url?:unknown;contentUrl?:unknown}).url||(value as {contentUrl?:unknown}).contentUrl;
  if(typeof value!=='string'||!value.trim())continue;
  try{const url=new URL(value,pageUrl);if(url.protocol==='https:'&&!url.username&&!url.password&&!url.port&&!/no[-_]?image|placeholder|\/logo[.\-_]/i.test(url.pathname))return url.href;}catch{/* Try the page's own product metadata. */}
 }
 return null;
}
