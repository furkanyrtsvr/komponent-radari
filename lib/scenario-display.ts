import type {Scenario} from './domain';
/** Equal basket totals are represented by the plan needing the fewest merchants. */
export function distinctScenarios(scenarios:Scenario[]) {
 const totals=new Map<number,Scenario>();
 for(const s of [...scenarios].sort((a,b)=>a.storeCount-b.storeCount||a.maxStores-b.maxStores))if(!totals.has(s.total))totals.set(s.total,s);
 return [...totals.values()].sort((a,b)=>a.maxStores-b.maxStores);
}
