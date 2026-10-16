import {catalogIdentity,matchesCatalogRequirement,candidateKey,relatedRegulatorModule} from "./catalog-identity";
import catalogueMatches from "./generated/catalog-matches.json";
import {nameCandidateKeys,nameMatchScore} from '../../public/catalog/product-identity.js';
import {productRoleConflict,productRole} from './product-role';
type CatalogSource = {storeId:string;url:string;name:string};
const catalogueIndex = catalogueMatches as Record<string,CatalogSource[]>;
export function catalogueSources(product:{name:string;manufacturer?:string;specifications?:string},includeRelated=false) {
  const identity=catalogIdentity(product);
  const exact=catalogueIndex[identity] || [];
  const broad=catalogueIndex[candidateKey(product) || ''] || [];
  // Sitemaps often abbreviate names. Such addresses are only discovery hints;
  // checkSource validates the actual merchant product before accepting a quote.
  const parts=identity.split(':'), traits=new Set((parts[4]||'').split(','));
  const compatible=broad.filter(s=>{
    if(parts[0]==='potentiometer')return matchesCatalogRequirement(product,s);
    if(identity.startsWith('model:lm2596:module:'))return relatedRegulatorModule(product,s);
    const source=catalogIdentity({name:s.name}).split(':');
    if(parts[0]==="passive") return source[0]==="passive" && parts[1]===source[1] && parts[2]===source[2];
    if(parts[0]==="cable") return source[0]==="cable" ? identity===catalogIdentity({name:s.name}) : candidateKey({name:s.name})===candidateKey(product);
    if(source[0]!=='model') return false;
    if(parts[2]==='ic' && source[2]==='module' || parts[2]==='camera-board' && source[2]!=='camera-board' || parts[2]==='servo' && source[2]!=='servo')return false;
    const features=(source[4]||'').split(',');
    if(parts[2]==='servo' && features.some(f=>/^(continuous|positional)$/.test(f) && !traits.has(f)))return false;
    const camera=features.find(f=>/^ov\d+/.test(f));
    if(camera && [...traits].some(f=>/^ov\d+/.test(f)) && !traits.has(camera))return false;
    return true;
  }).sort((a,b)=>{
    const match=(s:CatalogSource)=>Number(matchesCatalogRequirement(product,{name:s.name}));
    const score=(s:CatalogSource)=>catalogIdentity({name:s.name}).split(':')[4]?.split(',').filter(f=>traits.has(f)).length || 0;
    return match(b)-match(a) || score(b)-score(a) || a.url.localeCompare(b.url);
  });
  // Abbreviated sitemap titles remain discovery hints. Prioritize a compatible
  // item before the merchant candidate limit; only the read page can confirm it.
  const roleScore=(s:CatalogSource)=>productRoleConflict(product,s)?0:productRole(s)==='unknown'?1:2;
  const related=includeRelated ? nameCandidateKeys(product).flatMap(key=>catalogueIndex[key] || []).filter(source=>nameMatchScore(product,source)>=0.65).sort((a,b)=>roleScore(b)-roleScore(a) || nameMatchScore(product,b)-nameMatchScore(product,a) || a.url.localeCompare(b.url)) : [];
  const candidates=[...exact,...compatible,...related].filter((s,i,all)=>all.findIndex(x=>x.url===s.url)===i);
  const counts=new Map<string,number>();
  return candidates.filter(s=>{const n=counts.get(s.storeId)||0;counts.set(s.storeId,n+1);return n<(includeRelated?6:4);});
}
