/** Shared by browsing, imports and previews. Images never establish identity. */
import {productEvidence,evidenceAttributeConflict,evidenceDiscoveryKey,isDiscoveryModel} from './product-evidence.js';
export {productEvidence,evidenceAttributeConflict} from './product-evidence.js';
export const ascii = value => String(value || '').toLocaleLowerCase('tr-TR').replace(/ı/g,'i').normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-z0-9]+/g,' ').trim();
const number = value => Number(String(value).replace('d','.'));
const token = value => String(value).replace('.','d');
const textCache=new Map();
/** @returns {string} */
function technicalText(value){
 const raw=String(value||'');if(textCache.has(raw))return textCache.get(raw);
 const result=computeTechnicalText(raw);if(textCache.size>=5000)textCache.delete(textCache.keys().next().value);textCache.set(raw,result);return result;
}
function computeTechnicalText(value) {
 return ascii(String(value || '').replace(/Ω/gi,' ohm ').replace(/[µμ]/g,'u').replace(/(\d)[.,](\d)/g,'$1d$2'))
  .replace(/\b(\d+(?:d\d+)?)\s*(k|m)\s*ohm\b/g,'$1$2')
  .replace(/\b(?:potansiyometrte|potansiyomtre|potansiyometr|potans|potentiometers?)(?=\b|\d)/g,'potansiyometre')
  .replace(/\b(?:trimmer|trim\s+pot)\b/g,'trimpot')
  .replace(/\bpot\b/g,'potansiyometre')
  .replace(/\b(\d+)v(\d+)\b/g,'$1d$2v')
  .replace(/\bhc\s*sr\s*0?4\b/g,'hcsr04')
  .replace(/\bhc\s*0([56])\b/g,'hc0$1')
  .replace(/\b(mpu|dht|ds|bmp|bme|ne|sg|mg|ams|lm|ina|rc|mfrc)\s+(\d+[a-z0-9]*)\b/g,'$1$2')
  .replace(/\bstm32\s+(f[a-z0-9]+)\b/g,'stm32$1')
  .replace(/\besp\s+32\b/g,'esp32')
  .replace(/\besp32cam\b/g,'esp32 cam').replace(/\bsg90servo\b/g,'sg90 servo')
  .replace(/\bmfrc522\b/g,'rc522').replace(/\bi2cspi\b/g,'i2c spi');
}
function descriptionOf(value){
 if(!value.specifications)return '';
 try{const specs=JSON.parse(value.specifications||'{}');return String(specs.description||'').replace(/<[^>]*>/g,' ').replace(/&nbsp;|&#160;/g,' ').split(/benzer ürün|related products|tavsiye edilen|faydalı link/i)[0].slice(0,1600);}catch{return '';}
}
/** Only a product's own introductory name can expand an abbreviated title.
 * Navigation, recommended items and incidental components are not evidence. */
export function matchingName(value){
 const title=String(value.name||'');
 if(!value.specifications)return title;
 return productEvidence(value).name;
}
function resistanceOf(text){
 const s=technicalText(text).replace(/\b[ab](\d+(?:d\d+)?\s*[krm])\b/g,'$1');
 const scale={r:1,ohm:1,k:1000,kohm:1000,m:1000000,mohm:1000000};
 const embedded=s.match(/\b(\d+)([rkm])(\d+)\b/),value=s.match(/\b(\d+(?:d\d+)?)\s*(kohm|mohm|ohm|k|m|r)\b/);
 const n=embedded?Number(`${embedded[1]}.${embedded[3]}`)*scale[embedded[2]]:value?number(value[1])*scale[value[2]]:null;
 return n!==null&&n>0?n:null;
}
/** Electrical value and physical construction, independently of URL wording. */
export function potentiometerDetails(value){
 const key=String(value.name||'')+'\0'+String(value.specifications||'');
 if(potCache.has(key))return potCache.get(key);
 const result=readPotentiometerDetails(value);if(potCache.size>=3000)potCache.delete(potCache.keys().next().value);potCache.set(key,result);return result;
}
const potCache=new Map();
function readPotentiometerDetails(value){
 const title=technicalText(matchingName(value));
 if(!/\b(?:potansiyometre\w*|trimpot|reosta|rheostat)\b/.test(title))return null;
 if(/\b(?:dugme\w*|knob|kapak\w*|somun|pul|seti|kit)\b/.test(title))return null;
 let resistance=resistanceOf(title);
 const desc=technicalText(descriptionOf(value));
 // The opening product name (before prose) can supply a missing rating.
 const intro=desc.match(/^(.{0,90}?(?:potansiyometre\w*|trimpot))/)?.[1]||'';
 if(resistance===null)resistance=resistanceOf(intro);
 if(resistance===null)return null;
 const corroborated=Boolean(intro&&resistanceOf(intro)===resistance);
 const evidence=title+(corroborated?' '+desc:'');
 const kind=/\b(?:trimpot|preset)\b/.test(title)?'trimpot':/\b(?:dijital|digital)\b/.test(title)?'digital':/\b(?:reosta|rheostat)\b/.test(title)?'rheostat':/\b(?:surgu\w*|slide\w*|fader)\b/.test(title)?'slide':/\b(?:sonsuz|encoder|enkoder)\b/.test(title)?'encoder':/\b(?:cok\s*tur\w*|multi\s*turn|3590)\b/.test(title)?'multiturn':/\b(?:modul\w*|module|kart\w*|board)\b/.test(title)?'module':/\b(?:telli|wirewound)\b/.test(title)?'wirewound':/\b(?:yatik|yatay|pcb\s*tip)\b|\b12\s*x\s*2\s*mm\b/.test(title)?'pcb-disc':'rotary';
 const taper=/\b(?:logaritmik|logarithmic|audio)\b|\ba\d+(?:d\d+)?[krm]\b/.test(title)?'log':/\b(?:lineer|linear)\b|\bb\d+(?:d\d+)?[krm]\b/.test(title)?'linear':'?';
 const pins=evidence.match(/\b(\d+)\s*(?:pin|bacak)\b/)?.[1]||(/\b(?:stereo|dual|cift)\b/.test(title)?'6':'3');
 const switched=/\b(?:anahtarli|switch\w*)\b/.test(title);
 const power=title.match(/\b(\d+(?:d\d+)?)\s*w\b/)?.[1]||'?';
 const dimensions=title.match(/\b\d+(?:d\d+)?\s*x\s*\d+(?:d\d+)?(?:\s*x\s*\d+(?:d\d+)?)?\s*mm\b/)?.[0].replace(/\s/g,'')||'?';
 const model=title.match(/\b(?:wh\d+|wx\d+|wth\d+|rv\d+\w*|r\d+gs|la\d+\w*)\b/)?.[0]||'?';
 return {resistance,kind,taper,pins,switched,power,dimensions,model,quantity:quantity(title),corroborated};
}
function potentiometerIdentity(value){
 const p=potentiometerDetails(value);
 return p?`potentiometer:${p.resistance}:${p.kind}:${p.pins}:${p.switched?'switch':'plain'}:${p.taper}:${p.power}:${p.dimensions}:${p.model}:${p.quantity}`:null;
}
const models = /\b(?:xr\d{4,}|stm32[a-z0-9]{6,}|esp32(?:\s*[sc]\s*\d+)?[a-z0-9]*|esp8266|mpu\d{4,}|ne555[a-z0-9]*|(?:sg|mg)\d+[rs]?|hcsr04|hc0[56]|ams1117(?:adj)?|lm\d{3,4}[a-z]?|ds18b20|ds3231|ds1307|dht\d+|vl53l0x|rc522|l298n|l293d|tb6612fng|a4988|drv8825|bmp\d+|bme\d+|ina\d+|tcs\d+|hmc5883l?|qmc5883l?|aht20|bno055)\b/g;
function modelCodes(name) { return [...new Set((name.match(models)||[]).map(code=>code.replace(/\s/g,'')))]; }
// Discovery is deliberately broader than canonical identity. These keys never
// merge catalog records; buyers can remove individual offers in their cart.
const nameStopWords=new Set('modul module modulu modulun kart karti board pil batarya battery sarj charger sensor sensör motor voltaj voltage regulator regülatör power supply guc mini mikro ayarlanabilir adjustable icin ile ve the with for adet paket pcs set seti kit lipo liion lithium lityum dc ac smd dip sot to pin ohm watt'.split(' ').map(ascii));
function discoveryModels(value){
 const text=technicalText(matchingName(value)).replace(/\b([a-z]{2,6})\s+(\d{2,}[a-z0-9]*)\b/g,(all,prefix,rating)=>/^\d+(?:d\d+)?(?:ohm|kohm|mohm|pf|nf|uf|uh|mh|mm|cm|ma|a|v|w|hz|khz|mhz|k|r)$/.test(rating)?all:prefix+rating);
 const codes=[...modelCodes(text),...(text.match(/\b(?:[a-z]{1,6}\d{2,}|\d{1,3}[a-z]{1,3}\d{2,})[a-z0-9]*\b/g)||[])].map(code=>code.replace(/(red|blue|green|black|white)$/,'')).filter(isDiscoveryModel);
 return [...new Set(codes.flatMap(code=>[code,...(code.match(/^([a-z]{1,6}\d{2,})[a-z]+$/)?.slice(1)||[])]))];
}
function discoveryWords(value){return [...new Set(technicalText(matchingName(value)).split(' ').filter(word=>word.length>=4 && !nameStopWords.has(word) && !/^\d/.test(word)))];}
export function nameCandidateKeys(value){
 const pot=potentiometerDetails(value);
 if(pot)return [`name-potentiometer:${pot.resistance}:${pot.kind}`];
 const ambiguous=adjustableResistanceHint(value);
 if(ambiguous!==null)return [`name-potentiometer:${ambiguous}:rotary`,`name-potentiometer:${ambiguous}:trimpot`];
 const passive=passiveIdentity(matchingName(value));
 if(passive)return ['name-passive:'+passive.split(':').slice(1,3).join(':')];
 const codes=discoveryModels(value);
 if(!codes.length){const family=evidenceDiscoveryKey(value);if(family)return [family];}
 return codes.length ? codes.map(code=>'name-model:'+code) : discoveryWords(value).slice(0,5).map(word=>'name-word:'+word);
}
export function nameMatchScore(a,b){
 const potA=potentiometerDetails(a),potB=potentiometerDetails(b);
 if(potA||potB){
  if(potA&&potB)return potA.resistance===potB.resistance&&potA.kind===potB.kind?0.95:0;
  const known=potA||potB,unknown=potA?b:a;
  return adjustableResistanceHint(unknown)===known.resistance?0.7:0;
 }
 const passiveA=passiveIdentity(matchingName(a)),passiveB=passiveIdentity(matchingName(b));
 if(passiveA||passiveB)return passiveA&&passiveB&&passiveA.split(':').slice(0,3).join(':')===passiveB.split(':').slice(0,3).join(':') ? 0.9 : 0;
 const textA=technicalText(a.name),textB=technicalText(b.name);
 // A test-point connector can reuse a charger chip's number; the titles
 // explicitly describe unrelated goods even in name-based discovery.
 const unrelated=/test\s*point|pc\s*test\s*point|gaz\s+desarj/;
 if(unrelated.test(textA)!==unrelated.test(textB))return 0;
 const codesA=discoveryModels(a),codesB=discoveryModels(b);
 if(codesA.length && codesB.length)return codesA.some(code=>codesB.includes(code)) ? 0.9 : 0;
 const familyA=evidenceDiscoveryKey(a),familyB=evidenceDiscoveryKey(b);
 if(familyA||familyB)return familyA&&familyA===familyB ? 0.85 : 0;
 const wordsA=discoveryWords(a),wordsB=new Set(discoveryWords(b));
 const shared=wordsA.filter(word=>wordsB.has(word)).length;
 if(!shared)return 0;
 const normalizedA=technicalText(a.name),normalizedB=technicalText(b.name);
 if(normalizedA===normalizedB)return 1;
 return shared>=2 ? shared/Math.max(2,Math.min(wordsA.length,wordsB.size)) : 0;
}
function quantity(name) {return name.match(/\b(\d+)\s*(?:adet|pcs|li|lu)\b/)?.[1] || name.match(/\b(\d+)\s*x\s*(?:sg|mg)/)?.[1] || '1';}
function adjustableResistanceHint(value){
 const title=technicalText(value.name);
 return /\b(?:ayarli\s+direnc|variable\s+resistor)\b/.test(title)&&!/\b(?:modul\w*|kart\w*|board|kit|potansiyometre\w*|trimpot)\b/.test(title)?resistanceOf(title):null;
}
export function regulatorModuleDetails(value) {
 const name=technicalText(value.name);
 if(modelCodes(name).length!==1 || !/\blm2596\b/.test(name) || !/\b(modul\w*|module|kart\w*|board|power\s+su\w*|dc\s+dc)\b/.test(name) || /\b(entegre|tssop|to\s*263|to\s*220)\b/.test(name))return null;
 let description='';try{description=technicalText(JSON.parse(value.specifications || '{}').description);}catch{}
 const titleAdjustable=/\b(ayarlanabilir|adjustable|adj)\b/.test(name);
 const fixed=!titleAdjustable?(name.match(/\blm2596\s+(\d+(?:d\d+)?)\s*v?\b/)?.[1] || name.match(/^(\d+(?:d\d+)?)\s*v\b/)?.[1]):null;
 const adjustable=titleAdjustable || !fixed && /\b(ayarlanabilir|adjustable|trimpot)\b/.test(description);
 const mode=adjustable?'adjustable':fixed?`fixed-${fixed}v`:'unknown';
 const features=[/\bmini\b/.test(name)?'mini':'standard'];
 if(/\b(segment\w*|display|ekran\w*|gosterge\w*|voltmetre\w*|dijital)\b/.test(name))features.push('display');
 if(/\bkablolu\b/.test(name))features.push('wired');
 if(/\bklemens\w*|screw\s*terminal/.test(name))features.push('terminal');
 if(/\bcok\s*cikis\w*|\b(?:multi|multiple|dual)\s*(?:output|cikis)/.test(name))features.push('multi-output');
 if(/\byukseltici\b|\bboost\b|\bstep\s*up\b/.test(name))features.push('boost');
 if(/\busb\b/.test(name))features.push('usb');
 const current=name.match(/\b(\d+(?:d\d+)?)\s*a\b/)?.[1];
 if(current && current!=='3')features.push(`rating-${current}a`);
 if(/\bcc\s*cv\b|akim\s*(?:ayar|kontrol|sinir)/.test(name))features.push('current-control');
 return {mode,features,quantity:quantity(name)};
}
export function jumperDetails(name) {
 const s = technicalText(name);
 if (!/\bjumper\b/.test(s)) return null;
 const count = s.match(/\b(\d+)\s*(?:pin|li|lu|adet|pcs)\b/)?.[1];
 const lengths=[...s.matchAll(/\b(\d+(?:d\d+)?)\s*(cm|mm|metre|meter|m)\b/g)].map(m=>number(m[1])*({mm:1,cm:10,m:1000,metre:1000,meter:1000}[m[2]]));
 const length=Math.max(0,...lengths);
 const gender = /\b(?:erkek\s+erkek|m\s+m|m2m|male\s+male)\b/.test(s) ? 'male-male' : /\b(?:disi\s+disi|f\s+f|f2f|female\s+female)\b/.test(s) ? 'female-female' : /\b(?:erkek\s+disi|disi\s+erkek|m\s+f|f\s+m|m2f|f2m|male\s+female|female\s+male)\b/.test(s) ? 'male-female' : null;
 return count && length && gender ? { count: Number(count), length, gender } : null;
}
export function isAccessory(name) {
 const s=technicalText(name);
 if(/\b(?:potansiyometre\w*|trimpot)\b/.test(s)&&/\b(?:dugme\w*|knob|kapak\w*|somun|pul)\b/.test(s))return true;
 if(/\b(?:tutucu\w*|aparat\w*|braket|holder|bracket|kilif\w*|muhafaza\w*|kutu|cark\s+seti|disli\s+seti|pan\s+tilt|icin|robot\s+kol\w*|shield\w*)\b/.test(s))return true;
 const included=/\b(?:dahil|included)\b|\bwith\s+(?:a\s+)?(?:heat\s*sink|heatsink|cable)\b/.test(s);
 if(!included && /\b(?:sogutucu\w*|heatsink|heat\s+sink)\b/.test(s))return true;
 // A cable is an accessory to a named board/sensor, but a jumper cable is a product.
 if(!included && !/\bjumper\b/.test(s) && modelCodes(s).length && /\b(?:kablosu|baglanti\s+kablo\w*|kablo\s+seti)\b/.test(s))return true;
 return false;
}
const passiveCache=new Map();
function passiveIdentity(raw){
 const key=String(raw||'');if(passiveCache.has(key))return passiveCache.get(key);
 const result=computePassiveIdentity(key);if(passiveCache.size>=5000)passiveCache.delete(passiveCache.keys().next().value);passiveCache.set(key,result);return result;
}
function computePassiveIdentity(raw) {
 const name=technicalText(raw);
 if (/\b(modul\w*|kart\w*|potansiyometre\w*|trimpot|ayarli\s+direnc)\b/.test(name)) return null;
 const qty=quantity(name);
 if (/\b(direnc|resistor|rezistor)\b/.test(name)) {
  const value=name.match(/\b(\d+(?:d\d+)?)\s*(kohm|mohm|ohm|k|m|r)\b/);
  const embedded=name.match(/\b(\d+)([rkm])(\d+)\b/);
  const scale={r:1,ohm:1,k:1000,kohm:1000,m:1000000,mohm:1000000};
  const resistance=embedded ? Number(`${embedded[1]}.${embedded[3]}`)*scale[embedded[2]] : value ? number(value[1])*scale[value[2]] : null;
  if(resistance===null) return null;
  const fraction=String(raw).match(/\b(\d+)\s*\/\s*(\d+)\s*w\b/i);
  const watts=fraction?Number(fraction[1])/Number(fraction[2]):number(name.match(/\b(\d+(?:d\d+)?)\s*w\b/)?.[1] || 0);
  const tolerance=String(raw).match(/%\s*(\d+(?:[.,]\d+)?)|(\d+(?:[.,]\d+)?)\s*%/)?.slice(1).find(Boolean)?.replace(',','.') || name.match(/\byuzde\s+(\d+(?:d\d+)?)\b/)?.[1]?.replace('d','.') || '?';
  const footprint=name.match(/\b(0201|0402|0603|0805|1206|1210|2010|2512)\b/)?.[0] || (/\bsmd\b/.test(name)?'smd-unknown':'tht');
  const technology=(name.match(/\b(metal\s+film|karbon|carbon|wirewound|tas|seramik)\b/)?.[0] || '?').replace('carbon','karbon');
  return `passive:resistor:${resistance}:${watts||'?'}:${tolerance}:${footprint}:${technology}:${qty}`;
 }
 if (/\b(kondansator|capacitor|kapasitor)\b/.test(name)) {
  const value=name.match(/\b(\d+(?:d\d+)?)\s*(pf|nf|uf)\b/);
  if(!value) return null;
  const pf=number(value[1])*({pf:1,nf:1000,uf:1000000}[value[2]] || 1);
  const voltage=name.match(/\b(\d+(?:d\d+)?)\s*v\b/)?.[1] || '?';
  const type=(name.match(/\b(elektrolitik|elektrolit|tantal|seramik|polyester|multilayer|film)\b/)?.[0] || '?').replace(/^elektrolit$/,'elektrolitik');
  const dielectric=(name.match(/\b(c0g|np0|x7r|x5r|y5v|z5u)\b/)?.[0]||'?').replace('np0','c0g');
  const footprint=name.match(/\b(0402|0603|0805|1206|1210|2220)\b/)?.[0] || (/\bsmd\b/.test(name)?'smd-unknown':'tht');
  const dimensions=name.match(/\b\d+(?:d\d+)?(?:\s*x\s*\d+(?:d\d+)?)?\s*mm\b/g)?.map(v=>v.replace(/\s/g,'')).sort().join(',') || '?';
  return `passive:capacitor:${pf}:${voltage}:${type}:${footprint}:${dimensions}:${dielectric}:${qty}`;
 }
 return null;
}
function arduinoIdentity(name) {
 if(!/\barduino\b/.test(name))return null;
 const uno=name.match(/\buno\s+(?:r|rev|revision)\s*(\d+)\b/);
 const nano=/\bnano\b/.test(name);
 const mega=name.match(/\bmega\s*(2560|1280)\b/);
 if(!uno && !nano && !mega)return null;
 // Unknown Arduino families remain separate until the merchant identifies them.
 if(nano && /\b(?:every|33|rp2040|esp32|iot|ble|sense|r4)\b/.test(name))return `title:${name}`;
 const family=uno?`uno-r${uno[1]}`:mega?`mega-${mega[1]}`:'nano-classic';
 const specs=[];
 specs.push(/\b(?:orjinal|orijinal|original)\b/.test(name)?'original':/\b(?:clone|klon|tabanli|uyumlu)\b/.test(name)?'clone':'origin-unknown');
 for(const pattern of [/\b(?:ch34\w*|ft232\w*|cp210\w*|atmega\d+[a-z]*|lgt8f\d+[a-z]*|ht42b\d+|dip|smd|wifi|minima)\b/g])specs.push(...name.match(pattern)||[]);
 if(/\b(?:type\s*c|usb\s*c)\b/.test(name))specs.push('usb-c');
 if(/\b(?:micro|mikro)\s*usb\b/.test(name))specs.push('micro-usb');
 if(/\bmini\s*usb\b/.test(name))specs.push('mini-usb');
 if(/\busb\s+kablo\w*\s+(?:dahil|included)\b/.test(name))specs.push('usb-cable-included');
 if(/\b(?:baslangic|starter|kit|kiti|set|seti|paket)\b/.test(name))specs.push('bundle');
 return `model:arduino-${family}:board:${quantity(name)}:${[...new Set(specs)].sort().join(',')}`;
}
/** Candidate keys are discovery hints, never proof of equivalence. */
export function candidateKey(value) {
 const name=technicalText(matchingName(value));
 if(isAccessory(name))return null;
 const pot=potentiometerDetails(value);
 if(pot)return `candidate:potentiometer:${pot.resistance}:${pot.kind}`;
 const arduino=arduinoIdentity(name);
 if(arduino?.startsWith('model:'))return `candidate:${arduino.split(':')[1]}`;
 const passive=passiveIdentity(matchingName(value));
 if(passive)return `candidate:${passive.split(':').slice(1,3).join(':')}`;
 const jumper=jumperDetails(name) || (/\bjumper\b/.test(name) ? jumperDetails(name+' 1mm') : null);
 if(jumper)return `candidate:jumper:${jumper.gender}:${jumper.count}`;
 const code=modelCodes(name)[0];
 return code?`candidate:${code}`:null;
}
/** @param {{name:string,mpn?:string,model?:string,category?:string}} value */
/** @returns {string} */
export function productIdentity(value) {
 const key=String(value.name||'')+'\0'+String(value.specifications||'')+'\0'+String(value.category||'');
 if(identityCache.has(key))return identityCache.get(key);
 const result=readProductIdentity(value);if(identityCache.size>=4000)identityCache.delete(identityCache.keys().next().value);identityCache.set(key,result);return result;
}
const identityCache=new Map();
function readProductIdentity(value){
 const name=technicalText(matchingName(value));
 if(isAccessory(name))return `accessory:${name}`;
 const pot=potentiometerIdentity(value);
 if(pot)return pot;
 const jumper=jumperDetails(name);
 if(jumper)return `cable:jumper:${jumper.gender}:${jumper.count}:${jumper.length}mm`;
 const passive=passiveIdentity(matchingName(value));
 if(passive)return passive;
 const arduino=arduinoIdentity(name);
 if(arduino)return arduino;
 const codes=modelCodes(name);
 const code=codes[0];
 if(code) {
  if(/littelfuse|gaz desarj|\bgdt\b/.test(name+' '+ascii(value.category)))return `title:${name}`;
  if(code==='hcsr04' && /mesafe olcum modulu|\b(dijital|gosterge|ekran|display)\b/.test(name))return `accessory:${name}`;
  if(code==='hcsr04')return `model:hcsr04:sensor:${quantity(name)}:`;
  const module=/\b(modul\w*|module|kart\w*|board|devkit\w*|nodemcu)\b/.test(name);
  const regulator=regulatorModuleDetails(value);
  if(regulator)return `model:lm2596:module:${regulator.quantity}:${regulator.mode},${regulator.features.join(',')}`;
  const ic=(!module && /\b(entegre\w*|ic|chip)\b/.test(name)) || /\b(tssop\d*|dip\d*|soic\d*|sop\d*|sot\s*\d+|to\s*\d+|lqfp\s*\d+|qfn\s*\d+)\b/.test(name) || /^ams1117/.test(code) && !module;
  const bundle=/\b(?:adaptor|adapter|mb)\s+dahil\b|\b(?:kit|set|paket|kiti)\b/.test(name) && !/\bgelistirme\s+(?:kit|kiti)\b/.test(name);
  const servo=/^(sg|mg)\d+[rs]?$/.test(code);
  if(/^esp32/.test(code) && /\bcam\s+mb\b/.test(name) && !/\bov\d+\b/.test(name))return `accessory:${name}`;
  let kind=ic?'ic':code==='xr2206' && /\b(sinyal|jenerator|generator|kit|diy|modul\w*)\b/.test(name)?'generator':bundle?'kit':servo?'servo':/^esp32/.test(code) && /\bcam\b/.test(name)?'camera-board':module?'module':'product';
  if(code==='ds18b20' && /\b(?:waterproof|su\s+gecirmez)\b/.test(name))kind='probe';
  const specs=code==='xr2206' && !ic?(name.match(/\b(?:kutulu|assembled|montajli)\b/g)||[]):(name.replace(code,'').match(/\b(?:\d+(?:d\d+)?\s*(?:v|pin|mhz|khz|hz|mm|gb|mb|w|a)|cp210\w*|ch34\w*|wroom(?:\s*\d+[a-z0-9]*)?|wrover(?:\s*\d+[a-z0-9]*)?|cam|camera|kamera|ov\d+|rhyx\s*m\d+\s*\d*|n\d+r\d+|devkit(?:\s*v\s*\d+)?|dip\s*\d+|sop\s*\d+|ssop\s*\d+|tssop\s*\d+|soic\s*\d+|sot\s*\d+|to\s*\d+|lqfp\s*\d+|qfn\s*\d+|bga\s*\d+|orijinal|orjinal|original|clone|klon|metal|plastik)\b/g)||[]).map(s=>s.replace(/\s/g,'').replace(/^(kamera|camera)$/,'cam').replace(/^(orjinal|original)$/,'orijinal').replace(/^clone$/,'klon'));
  // Board makers, connector ecosystem and extra components change the item.
  specs.push(...name.match(/\b(?:adafruit|sparkfun|waveshare|grove|gravity|picobricks|octopus|ttl232|rs485)\b/g)||[]);
  if(/^(?:bmp|bme|mpu|dht|ds18b20|ina|tcs)/.test(code))specs.push(...name.match(/\b(?:i2c|spi|uart)\b/g)||[]);
  if(!/^esp/.test(code) && /\bwifi\b/.test(name))specs.push('wifi');
  if(/\b(?:type\s*c|usb\s*c)\b/.test(name))specs.push('usb-c');
  if(/\b(?:micro|mikro)\s*usb\b/.test(name))specs.push('micro-usb');
  if(/\bmini\s*usb\b/.test(name))specs.push('mini-usb');
  if(code==='ds18b20') {
   for(const length of name.matchAll(/\b(\d+(?:d\d+)?)\s*(metre|meter|m|cm|mm)\b/g))specs.push(`length${number(length[1])*({mm:1,cm:10,m:1000,metre:1000,meter:1000}[length[2]])}mm`);
   specs.push(...(name.match(/\b\d+(?:d\d+)?\s*x\s*\d+(?:d\d+)?\s*mm\b/g)||[]).map(value=>`dimension${value.replace(/\s/g,'')}`));
   specs.push(...name.match(/\bm(?:10|22)\b/g)||[]);
  }
  if(servo) {
   specs.push(/\b360(?:c)?\b|surekli|continuous/.test(name)?'continuous':'positional');
   const angle=name.match(/\b(90|180|270)\s*(?:derece|degree|degrees)\b/)?.[1];
   if(angle && angle!=='180')specs.push(`range${angle}`);
  }
  if(/^ams1117/.test(code)) {
   const voltage=name.match(/\b(\d+)d(\d+)\s*v\b/);
   if(voltage)specs.push(`out${voltage[1]}d${voltage[2]}v`);
  }
  const identityCode=codes.length>1?`combo-${codes.slice().sort().join('+')}`:code;
  return `model:${identityCode}:${kind}:${quantity(name)}:${[...new Set(specs)].sort().join(',')}`;
 }
 const generic=name.match(/\b(?:[a-z]{1,8}\d[a-z0-9]{2,18}|\d{1,3}[a-z]{1,3}\d{2,}[a-z0-9]*)\b/)?.[0];
 const family=name.match(/\b(sensor|sensor\w*|entegre\w*|relay|role|motor|servo|regulator\w*|modul\w*|module|transistor\w*|mosfet\w*|diyot\w*|diode\w*)\b/)?.[0];
 if(generic && family) {
  const technical=name.match(/\b(?:[a-z]*\d[a-z0-9]*|\d+(?:d\d+)?(?:v|a|w|mm|pin)|metal|plastik|smd|tht)\b/g)||[];
  return `model:${generic}:${family.replace(/sensor\w*/,'sensor').replace(/modul\w*/,'module').replace(/entegre\w*/,'ic')}:1:${[...new Set(technical)].sort().join(',')}`;
 }
 return `title:${name}`;
}
export function catalogGroup(name,current='Diğer') {
 const s=technicalText(name);
 if(isAccessory(s))return current;
 if(jumperDetails(s)||/\b(kablo\w*|cable)\b/.test(s))return 'Kablolar';
 if(/\b(buton|button|switch)\b/.test(s))return 'Butonlar';
 if(/\b(sensor\w*|dht\d+|mpu\d+|hcsr04|ds18b20)\b/.test(s))return 'Sensörler';
 if(/\b(servo|motor)\b/.test(s))return 'Motorlar';
 if(/\b(direnc|resistor|rezistor)\b/.test(s))return 'Dirençler';
 if(/\b(kondansator|capacitor|kapasitor)\b/.test(s))return 'Kondansatörler';
 if(arduinoIdentity(s) || /\b(?:gelistirme|devkit)\b/.test(s))return 'Geliştirme Kartları';
 return current;
}
export function searchableText(value) {
 let raw=String(value||'').replace(/\b(\d+)\s*\/\s*(\d+)\s*w\b/gi,(_,a,b)=>`${Number(a)/Number(b)}W`);
 let s=technicalText(raw).replace(/\b(\d+(?:d\d+)?)\s*cm\b/g,(_,n)=>`${number(n)*10} mm`).replace(/\b(\d+(?:d\d+)?)\s*(?:metre|meter)\b/g,(_,n)=>`${number(n)*1000} mm`).replace(/\b(\d+)(pin|mm)\b/g,'$1 $2');
 s=s.replace(/\b(?:male|erkek)\s+(?:male|erkek)\b|\bm\s+m\b|\bm2m\b/g,'erkek erkek').replace(/\b(?:female|disi)\s+(?:female|disi)\b|\bf\s+f\b|\bf2f\b/g,'disi disi').replace(/\b(?:male\s+female|female\s+male|erkek\s+disi|disi\s+erkek|m\s+f|f\s+m|m2f|f2m)\b/g,'erkek disi');
 if(/\bjumper\b/.test(s))s=s.replace(/\b(\d+)\s*(?:li|lu|pcs|adet)\b/g,'$1 pin').replace(/\b(?:kablo\w*|cable|wire|seti|set)\b/g,'');
 s=s.replace(/\b(\d+(?:d\d+)?)\s*(kohm|mohm|ohm|k|r)\b/g,(_,n,unit)=>`${number(n)*({kohm:1000,mohm:1000000,ohm:1,k:1000,r:1}[unit])}ohm`)
  .replace(/\b(\d+)([kr])(\d+)\b/g,(_,a,unit,b)=>`${Number(`${a}.${b}`)*(unit==='k'?1000:1)}ohm`)
  .replace(/\b(\d+(?:d\d+)?)\s*(pf|nf|uf)\b/g,(_,n,unit)=>`${number(n)*({pf:1,nf:1000,uf:1000000}[unit])}pf`)
  .replace(/\b(\d+(?:d\d+)?)\s*(v|w|a)\b/g,(_,n,unit)=>`${token(number(n))}${unit}`)
  .replace(/\b(?:sensoru|sensor|sensorler|sensori)\b/g,'sensor').replace(/\b(?:module|modulu|modul)\b/g,'module');
 return s.replace(/\b(?:orjinal|original)\b/g,'orijinal').replace(/\buno\s+(?:r|rev|revision)\s*(\d+)\b/g,'uno r$1').replace(/\s+/g,' ').trim();
}
/** Discovery aliases for URL-derived titles; NEVER use them in productIdentity. */
export function catalogSearchText(name) {
 let text=searchableText(name);
 if(/\b(?:direnc|resistor|rezistor)\b/.test(ascii(name))) {
  const raw=ascii(name);
  const fraction=raw.match(/\b1\s+([248])\s*w\b|\b1([248])w\b/);
  if(fraction)text+=` ${token(1/Number(fraction[1]||fraction[2]))}w`;
  const decimal=raw.match(/\b(\d+)\s+(\d+)\s*(k|r|ohm)\b/);
  if(decimal)text+=` ${Number(`${decimal[1]}.${decimal[2]}`)*(decimal[3]==='k'?1000:1)}ohm`;
 }
 return text;
}
export function catalogQuery(query) {
 const normalized=searchableText(query);
 const expected=normalized.split(' ').filter(Boolean).map(term=>({term,technical:/\d/.test(term)}));
 const connector=normalized.match(/\b(?:erkek erkek|disi disi|erkek disi)\b/)?.[0];
 const requiredModels=modelCodes(technicalText(query));
 return name=>{
  // Avoid expensive unit normalization for a million unrelated component names.
  if(requiredModels.length) {
   const compact=ascii(name).replace(/\s/g,'');
   if(!requiredModels.every(code=>compact.includes(code)))return false;
  }
  const normalizedName=catalogSearchText(name);
  if(connector && !normalizedName.includes(connector))return false;
  const actual=normalizedName.split(' ').filter(Boolean);
  return expected.every(({term,technical})=>actual.some(word=>technical?word===term:word.startsWith(term)));
 };
}
export function queryMatchesCatalogTitle(query,name) {return catalogQuery(query)(name);}
export function matchBucket(key) {
 let hash=2166136261;
 for(let i=0;i<key.length;i++)hash=Math.imul(hash ^ key.charCodeAt(i),16777619);
 return (hash>>>0)%64;
}
