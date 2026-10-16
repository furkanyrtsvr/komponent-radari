import {jumperDetails} from '../lib/catalog-identity';
import {potentiometerDetails} from '../../public/catalog/product-identity.js';
import {evidenceAttributeConflict,evidenceFamily,evidenceRatings} from '../../public/catalog/product-evidence.js';
/** Call with the selected main Product.description and additionalProperty only.
 * Never scan the whole page, reviews or related products for contradictions. */
export function validateProductFacts(name:string,description:string,properties:{name?:unknown;value?:unknown}[]=[]) {
 const declared=evidenceAttributeConflict({name},{name,specifications:JSON.stringify({properties})});
 if(declared)throw new Error('Ürün başlığı ile teknik özellik tablosu çelişiyor: '+declared);
 const unit={resistor:'ohm',thermistor:'ohm',potentiometer:'ohm',capacitor:'pf',inductor:'uh'}[evidenceFamily(name)];
 const labels={ohm:/^(?:direnç(?: değeri)?|resistance|maksimum direnç)$/i,pf:/^(?:kapasite|kapasitans|capacitance)$/i,uh:/^(?:indüktans|inductance)$/i};
 const named=unit?evidenceRatings(name).filter(r=>r.endsWith(unit)):[];
 if(unit&&named?.length){const p=properties.find(p=>labels[unit as keyof typeof labels].test(String(p.name)));const rated=p&&evidenceRatings(String(p.value)).filter(r=>r.endsWith(unit));if(rated?.length&&!named.some(r=>rated.includes(r)))throw new Error('Ürün başlığı ile teknik elektrik değeri çelişiyor.');}
 const pot=potentiometerDetails({name}),intro=potentiometerDetails({name:description.replace(/<[^>]*>/g,' ').slice(0,100)});
 if(pot&&intro&&(pot.resistance!==intro.resistance||intro.kind==='trimpot'&&pot.kind!=='trimpot'))throw new Error('Ürün başlığı ile potansiyometre açıklamasındaki değer veya tür çelişiyor.');
 if(pot){
  const rated=properties.find(p=>/^(?:direnç(?: değeri)?|resistance|maksimum direnç)$/i.test(String(p.name)))?.value;
  const stated=rated?potentiometerDetails({name:String(rated)+' Potansiyometre'}):null;
  if(stated&&stated.resistance!==pot.resistance)throw new Error('Ürün başlığı ile teknik direnç değeri çelişiyor.');
 }
 const jumper=jumperDetails(name);
 if(jumper){
  // Ignore 2.54mm connector pitch. Explicit cable lengths are >=100mm.
  const lengths=[...description.matchAll(/\b(\d+(?:[.,]\d+)?)\s*(cm|mm)\b/gi)].map(m=>Number(m[1].replace(',','.'))*(m[2].toLowerCase()==='cm'?10:1)).filter(n=>n>=100);
  if(lengths.some(n=>n!==jumper.length))throw new Error('Ürün başlığı ile kablo açıklamasındaki uzunluk çelişiyor.');
 }
 const packageCode=(s:string)=>s.match(/\b(?:SOT|DIP|SOIC|SSOP|TSSOP|QFN|BGA)[- ]?\d+\b/i)?.[0].toUpperCase().replace(/[- ]/g,'');
 const namedPackage=packageCode(name);
 const actualPackage=properties.find(p=>/^(Kılıf\s*\/\s*Kasa|Package\s*\/\s*Case)$/i.test(String(p.name)))?.value;
 if(namedPackage&&actualPackage&&packageCode(String(actualPackage))&&namedPackage!==packageCode(String(actualPackage)))throw new Error('Ürün başlığı ile teknik kılıf bilgisi çelişiyor.');
 const output=properties.find(p=>/^(Çıkış Voltajı|Output Voltage)$/i.test(String(p.name)))?.value;
 const titleVolts=name.match(/\b(\d+)V(\d+)\b/i)||name.match(/\b(\d+(?:[.,]\d+)?)\s*V\b/i);
 const actualVolts=String(output||'').match(/^(\d+(?:[.,]\d+)?)\s*V$/i);
 const expected=titleVolts?Number(titleVolts[2]?`${titleVolts[1]}.${titleVolts[2]}`:titleVolts[1].replace(',','.')):null;
 if(expected!==null&&actualVolts&&expected!==Number(actualVolts[1].replace(',','.')))throw new Error('Ürün başlığı ile çıkış voltajı çelişiyor.');
}
