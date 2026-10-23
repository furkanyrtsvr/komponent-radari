import {catalogIdentity} from './catalog-identity';
/** Model-name discovery candidates are not confirmed product counterparts. */
export function matchedCatalogSources<T extends {url:string;name?:string}>(sources:T[],key:string,observed:Record<string,{key:string}>){
  return [...new Map(sources.filter(source=>{
    const observedKey=observed[source.url]?.key;
    if(observedKey)return observedKey===key;
    return Boolean(source.name&&catalogIdentity({name:source.name})===key);
  }).map(source=>[source.url,source])).values()];
}
