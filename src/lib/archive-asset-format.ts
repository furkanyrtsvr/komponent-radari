export function isWebpAsset(bytes:Uint8Array){return bytes.length>=12&&bytes[0]===82&&bytes[1]===73&&bytes[2]===70&&bytes[3]===70&&bytes[8]===87&&bytes[9]===69&&bytes[10]===66&&bytes[11]===80;}
export function imagePreparationAllowed(cached:boolean,deadline:number,at=Date.now()){return cached||at<deadline;}
