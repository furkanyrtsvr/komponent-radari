import { productIdentity, ascii,matchingName,regulatorModuleDetails,potentiometerDetails,evidenceAttributeConflict } from "../public/catalog/product-identity.js";
import {productRoleConflict,productRole} from './product-role';
export { productIdentity as catalogIdentity, jumperDetails, candidateKey } from "../public/catalog/product-identity.js";
/** Broader discovery may list these pages, but a known different part cannot
 * silently become the cheapest quote for the requested electrical variant. */
export function variantConflict(a:{name:string;specifications?:string},b:{name:string;specifications?:string}){
 const roleConflict=productRoleConflict(a,b);
 if(roleConflict)return roleConflict;
 const declared=evidenceAttributeConflict(a,b);if(declared)return declared;
 const potA=potentiometerDetails(a),potB=potentiometerDetails(b);
 if(potA&&potB){
  if(potA.resistance!==potB.resistance)return 'Potansiyometre direnç değeri farklı';
  if(potA.kind!==potB.kind || potA.pins!==potB.pins || potA.switched!==potB.switched)return 'Potansiyometre yapısı, bacak sayısı veya anahtarı farklı';
  for(const field of ['taper','power','dimensions','model'] as const)if(potA[field]!=='?'&&potB[field]!=='?'&&potA[field]!==potB[field])return 'Potansiyometrenin belirtilen elektrik veya mekanik özelliği farklı';
  // High-power wire/industrial potentiometers are not ordinary signal pots.
  if((potA.power!=='?'&&Number(potA.power.replace('d','.'))>=1)!==(potB.power!=='?'&&Number(potB.power.replace('d','.'))>=1))return 'Güç potansiyometresi / standart sinyal potansiyometresi farklı';
 }
 const regulatorA=regulatorModuleDetails(a),regulatorB=regulatorModuleDetails(b);
 if(regulatorA&&regulatorB&&regulatorA.mode!=='unknown'&&regulatorB.mode!=='unknown'){
  if(regulatorA.mode!==regulatorB.mode||regulatorA.features.filter(f=>f!=='mini'&&f!=='standard').join(',')!==regulatorB.features.filter(f=>f!=='mini'&&f!=='standard').join(','))return 'Regülatör çıkışı veya ek donanımı farklı';
 }
 const left=productIdentity(a).split(':'),right=productIdentity(b).split(':');
 if(left[0]==='passive'&&right[0]==='passive'){
  if(left[1]!==right[1]||left[2]!==right[2])return 'Pasif bileşenin türü veya elektrik değeri farklı';
  const critical=left[1]==='resistor'?[3,5,6]:[3,4,5,6,7];
  if(critical.some(i=>left[i]!=='?'&&right[i]!=='?'&&left[i]!==right[i]))return 'Pasif bileşenin belirtilen güç, kılıf veya teknik özelliği farklı';
 }
 // A secondary USB/driver chip shared by two boards does not replace the
 // board's own processor/model (Nano vs Uno vs ESP32, for example).
 if(left[0]==='model'&&right[0]==='model'&&left[1]!==right[1]&&(['board','camera-board'].includes(left[2])||['board','camera-board'].includes(right[2])||/^arduino-|^esp|^stm32|^rp2040/.test(left[1])&&/^arduino-|^esp|^stm32|^rp2040/.test(right[1])))return 'Ana ürün modeli farklı; ortak çip aynı ürünü göstermez';
 const textA=ascii(matchingName(a)),textB=ascii(matchingName(b));
 if(left[0]==='model'&&right[0]==='model'&&left[1]!==right[1]){
  const family=(code:string)=>code.match(/^((?:[a-z]{1,8}\d{2,}|\d{1,3}[a-z]{1,3}\d{2,}))([a-z0-9]{0,8})$/);
  const x=family(left[1]),y=family(right[1]);
  if(x&&y&&(x[1]!==y[1] || x[2]&&y[2]&&x[2]!==y[2]))return 'Model veya belirtilen alt sürümü farklı';
 }
 const roleA=productRole(a),roleB=productRole(b);
 if(roleA===roleB && ['development-board','regulator'].includes(roleA)){
  const display=(s:string)=>/\b(?:lcd\w*|oled|ekran\w*|display|gosterge\w*|voltmetre\w*)\b/.test(s);
  if(display(textA)!==display(textB))return 'Ekranlı / ekransız donanım farklı';
 }
 const oppositeFeatures=[[/\b(?:korumali|protected)\b/,/\b(?:korumasiz|unprotected)\b/],[/\b(?:izoleli|isolated)\b/,/\b(?:izolesiz|non\s+isolated)\b/],[/\b(?:yukseltici|boost|step\s+up)\b/,/\b(?:dusurucu|buck|step\s+down)\b/]];
 for(const [positive,negative] of oppositeFeatures)if(positive.test(textA)&&!negative.test(textA)&&negative.test(textB)||positive.test(textB)&&!negative.test(textB)&&negative.test(textA))return 'Belirtilen çalışma özelliği farklı';
 const bareIc=(parts:string[],text:string)=>parts[2]==='ic'||(!/\b(?:modul|module|kart|karti|board|kit)\b/.test(text)&&/\b(?:smd|dpak|d2pak|entegre|chip|ic|sot\d+|soic\d+|to\s*-?\s*\d+)\b/.test(text));
 // Family suffixes such as LM2596S/LM2596T do not turn a bare IC into a board.
 const loose=['diode','transistor','led','inductor','thermistor','crystal','connector','switch','fuse','battery'];
 if(left[0]==='model'&&right[0]==='model'&&!(roleA===roleB&&loose.includes(roleA))&&bareIc(left,textA)!==bareIc(right,textB))return 'Entegre / modül türü farklı';
 if((left[0]==='cable'&&/\b(?:flat|serit|ribbon)\b/.test(textB))||(right[0]==='cable'&&/\b(?:flat|serit|ribbon)\b/.test(textA)))return 'Jumper / şerit kablo türü farklı';
 if(left[0]==='model'&&right[0]==='model'&&left[1].startsWith('combo-')!==right[1].startsWith('combo-'))return 'Tek modül / birleşik modül donanımı farklı';
 if(/\b(?:ams|lm)1117/.test(textA)&&/\b(?:ams|lm)1117/.test(textB)){
  const adjustable=(s:string)=>/\b(?:ams|lm)1117adj\b|\badj\b|\bayarlanabilir\b/.test(s);
  if(adjustable(textA)!==adjustable(textB)&&(left[4]||right[4]||'').split(',').some(s=>/^(?:out)?\d+(?:d\d+)?v$/.test(s)))return 'Sabit çıkış / ayarlanabilir regülatör farklı';
 }
 if((left[2]==='camera-board')!==(right[2]==='camera-board'))return 'Kamera kartı / ürün türü farklı';
 if(left[0]==='accessory' || right[0]==='accessory')return left.join(':')===right.join(':')?'':'Aksesuar / ürün türü farklı';
 if(left[0]==='cable'&&right[0]==='cable'&&left.join(':')!==right.join(':'))return 'Kablo bağlantısı, uzunluğu veya pin sayısı farklı';
 if(left[0]==='model'&&right[0]==='model'&&left[1]===right[1]){
  if((left[2]==='ic')!==(right[2]==='ic'))return 'Entegre / modül türü farklı';
  for(const pattern of [/^(?:out)?\d+(?:d\d+)?v$/,/^\d+(?:d\d+)?a$/,/^(?:sot|dip|sop|ssop|tssop|soic|qfn|bga|to)\d+$/,/^\d+pin$/,/^(?:cp210\w*|ch34\w*|ft232\w*)$/,/^(?:continuous|positional)$/,/^(?:cam|ov\d+)$/,/^(?:usb-c|micro-usb|mini-usb)$/]){
   const x=(left[4]||'').split(',').filter(s=>pattern.test(s)),y=(right[4]||'').split(',').filter(s=>pattern.test(s));
   if(x.length&&y.length&&x.join(',')!==y.join(','))return 'Elektrik değeri veya donanım varyantı farklı';
  }
 }
 return '';
}
export function relatedRegulatorModule(a:{name:string},b:{name:string}){
  const expected=regulatorModuleDetails(a),actual=regulatorModuleDetails(b);
  return Boolean(expected && actual && expected.mode!=="unknown" && expected.mode===actual.mode && expected.quantity===actual.quantity && expected.features.filter(f=>f!=="mini" && f!=="standard").join(',')===actual.features.filter(f=>f!=="mini" && f!=="standard").join(','));
}
export function canMergeCatalogProducts(a: {name:string;manufacturer?:string}, b: {name:string;manufacturer?:string}) {
  const key=productIdentity(a);
  if (key!==productIdentity(b)) return false;
  if(variantConflict(a,b))return false;
  return !key.includes(":ic:") || !a.manufacturer || !b.manufacturer || ascii(a.manufacturer)===ascii(b.manufacturer);
}
/** A merchant may provide additional ratings for a generic IC requirement.
 * Voltage and footprint still need explicit, identical evidence on both sides. */
export function matchesCatalogRequirement(a:{name:string;manufacturer?:string;specifications?:string},b:{name:string;manufacturer?:string;specifications?:string}) {
  if(variantConflict(a,b))return false;
  if(canMergeCatalogProducts(a,b))return true;
  const potA=potentiometerDetails(a),potB=potentiometerDetails(b);
  if(potA&&potB)return potA.resistance===potB.resistance&&potA.kind===potB.kind&&potA.pins===potB.pins&&potA.switched===potB.switched&&(['taper','power','dimensions','model'] as const).every(field=>potA[field]==='?'||potA[field]===potB[field]);
  const expected=productIdentity(a).split(':'),actual=productIdentity(b).split(':');
  if(expected[0]==="passive" && expected[1]===actual[1] && expected[2]===actual[2]) {
    const quantityIndex=expected.length-1;
    // Sale-pack count is accounted for by quoteOffer. Specified electrical
    // requirements remain mandatory; a missing rating never proves a match.
    const critical=expected[1]==="resistor" ? [3,5] : [3,4,5];
    if(critical.some(index=>expected[index]==="?" || expected[index]==="smd-unknown" || expected[index]!==actual[index])) return false;
    return expected.every((value,index)=>index===quantityIndex || value==="?" || value===actual[index]);
  }
  if(expected[0]!=='model' || expected[2]!=='ic' || expected.slice(0,4).join(':')!==actual.slice(0,4).join(':'))return false;
  if(a.manufacturer && b.manufacturer && ascii(a.manufacturer)!==ascii(b.manufacturer))return false;
  const required=(expected[4]||'').split(','),provided=(actual[4]||'').split(',');
  const packagePattern=/^(sot|dip|sop|ssop|tssop|soic|qfn|bga)\d+/;
  const packages=required.filter(v=>packagePattern.test(v));
  const voltage=required.filter(v=>/^\d+(?:d\d+)?v$/.test(v));
  if(!packages.length || !voltage.length)return false;
  if(packages.join(',')!==provided.filter(v=>packagePattern.test(v)).join(',') || voltage.join(',')!==provided.filter(v=>/^\d+(?:d\d+)?v$/.test(v)).join(','))return false;
  return required.every(v=>provided.includes(v));
}
