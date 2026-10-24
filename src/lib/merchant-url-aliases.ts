const robotronikOld='/-max7219-dot-led-matrix-modul-8x8-kirmizi-a0470';
const robotronikCanonical='/max7219-dot-led-matrix-modul-8x8-kirmizi-a0470';
/** Only the checked A0470 address, never a fuzzy product replacement. */
export function canonicalMerchantPath(host:string,path:string){return host.replace(/^www\./,'')==='robotronik.com.tr'&&path===robotronikOld?robotronikCanonical:path;}
export function merchantPathAliases(host:string,path:string){const canonical=canonicalMerchantPath(host,path);return host.replace(/^www\./,'')==='robotronik.com.tr'&&canonical===robotronikCanonical?[robotronikOld,robotronikCanonical]:[path];}
