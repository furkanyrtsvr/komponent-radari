/** Read merchant data as data only. Never execute remote JavaScript. */
export function inlineObject(html: string, assignment: RegExp): Record<string, unknown> {
  const match=assignment.exec(html);
  if(!match)throw new Error('Mağazanın ana ürün verisi bulunamadı.');
  const start=match.index+match[0].length-1;
  let depth=0,quoted=false,escaped=false,end=-1;
  for(let i=start;i<html.length;i++){
    const c=html[i];
    if(quoted){if(escaped)escaped=false;else if(c==='\\')escaped=true;else if(c==='"')quoted=false;continue;}
    if(c==='"')quoted=true;
    else if(c==='{')depth++;
    else if(c==='}' && --depth===0){end=i+1;break;}
  }
  if(end<0)throw new Error('Eksik mağaza ürün verisi.');
  const raw=html.slice(start,end);let json='';quoted=false;escaped=false;
  for(let i=0;i<raw.length;i++){
    const c=raw[i];
    if(!quoted && /[A-Za-z_$]/.test(c)){
      const key=raw.slice(i).match(/^([A-Za-z_$][\w$]*)\s*:/);
      if(key){json+=JSON.stringify(key[1])+':';i+=key[0].length-1;continue;}
    }
    json+=c;
    if(quoted){if(escaped)escaped=false;else if(c==='\\')escaped=true;else if(c==='"')quoted=false;}
    else if(c==='"')quoted=true;
  }
  return JSON.parse(json) as Record<string,unknown>;
}
