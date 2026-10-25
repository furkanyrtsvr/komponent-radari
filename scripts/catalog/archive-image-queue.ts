/** Interleave image hosts so one slow merchant cannot occupy every worker. */
export function fairImageQueue<T>(entries:[string,T][]):[string,T][]{
 const hosts=new Map<string,[string,T][]>();
 for(const entry of entries){let host:string;try{host=new URL(entry[0]).origin;}catch{host=entry[0];}const group=hosts.get(host)||[];group.push(entry);hosts.set(host,group);}
 const result:[string,T][]=[],groups=[...hosts.values()];let index=0;
 for(;;){let remaining=false;for(const group of groups)if(index<group.length){result.push(group[index]);remaining=true;}if(!remaining)break;index++;}
 return result;
}
