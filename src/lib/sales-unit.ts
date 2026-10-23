/** Quantity and package size are measured in this base unit, never inferred from a URL. */
export type SalesUnit = 'adet' | 'metre' | 'set';
export type UnitEvidence = {unitType?:string;unit_type?:string};
export function salesUnit(p:UnitEvidence):SalesUnit {return p.unitType==='metre'||p.unit_type==='metre'?'metre':p.unitType==='set'||p.unit_type==='set'?'set':'adet';}
export function unitConflict(a:UnitEvidence,b:UnitEvidence){return (salesUnit(a)==='metre')!==(salesUnit(b)==='metre');}
