/** Shared, bounded extraction of the merchant's own product-name evidence.
 * Descriptive prose, compatibility lists and suggestions never become models. */
const cache=new Map();
const plain=s=>String(s||'').replace(/<script[\s\S]*?<\/script>|<style[\s\S]*?<\/style>/gi,' ').replace(/<[^>]*>/g,' ').replace(/&nbsp;|&#160;/g,' ').replace(/([a-zçğıöşü])([A-ZÇĞİÖŞÜ][a-zçğıöşü])/g,'$1 $2').replace(/\s+/g,' ').trim();
const fold=s=>plain(s).toLocaleLowerCase('tr-TR').replace(/ı/g,'i').normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/Ω/gi,'ohm').replace(/[µμ]/g,'u').replace(/(\d)[.,](\d)/g,'$1d$2').replace(/[^a-z0-9]+/g,' ').trim();
const cut=s=>String(s||'').split(/benzer ürün|related products|recommended|tavsiye edilen|faydalı link|uyumlu ürünler/i)[0];
const families=[
 ['potentiometer',/\b(?:potans\w*|potentiometer\w*|trimpot|trimmer|reosta)\b/],
 ['capacitor',/\b(?:kondansator\w*|capacitor\w*|kapasitor\w*)\b/],
 ['thermistor',/\b(?:termistor\w*|thermistor\w*|ntc|ptc)\b/],
 ['resistor',/\b(?:direnc\w*|resistor\w*|rezistor\w*)\b/],
 ['inductor',/\b(?:bobin\w*|inductor\w*|induktans\w*)\b/],
 ['led',/\b(?:led|light\s+emitting\s+diode)\b/],
 ['diode',/\b(?:diyot\w*|diode\w*)\b/],
 ['transistor',/\b(?:transistor\w*|transistör\w*|mosfet\w*)\b/],
 ['crystal',/\b(?:kristal\w*|crystal\w*|osilator\w*|oscillator\w*)\b/],
 ['connector',/\b(?:konnektor\w*|konektor\w*|connector\w*|soket\w*|socket\w*|klemens\w*|terminal\s+block|header)\b/],
 ['switch',/\b(?:buton\w*|button\w*|switch\w*|anahtar\w*)\b/],
 ['fuse',/\b(?:sigorta\w*|fuse\w*)\b/],
 ['cable',/\b(?:jumper|kablo\w*|cable\w*)\b/],
 ['sensor',/\b(?:sensor\w*|algilayici\w*|probe|prob\w*)\b/],
 ['relay',/\b(?:role|relay)\b/],
 ['servo',/\bservo\b/],
 ['motor',/\b(?:motor|stepper)\b/],
 ['battery',/\b(?:batarya\w*|battery|pil|lipo|liion)\b/],
 ['power-supply',/\b(?:adaptor\w*|adapter\w*|guc\s+kaynagi|power\s+supply)\b/],
 ['regulator',/\b(?:regulator\w*|buck|boost)\b/],
 ['charger',/\b(?:sarj\w*|charger\w*)\b/],
 ['converter',/\b(?:donusturucu\w*|converter\w*)\b/],
 ['programmer',/\b(?:programlayici\w*|programmer\w*)\b/],
 ['display',/\b(?:ekran\w*|display|oled|lcd)\b/],
 ['amplifier',/\b(?:amfi\w*|amplifier\w*|yukseltec\w*)\b/],
];
/** @returns {string} */
export function evidenceFamily(name){
 const text=fold(name);
 if(/\b(?:sarj\s+edilebilir|rechargeable)\b/.test(text)&&/\b(?:pil|battery|batarya)\b/.test(text))return 'battery';
 if(/\b(?:sarj\w*|charger\w*)\b/.test(text))return 'charger';
 return families.find(([,re])=>re.test(text))?.[0]||'';
}
// Internal references are not models. Package numbers have a small pin/case
// count; a full component code such as TSOP2238 must never be erased as TSOP.
export function isDiscoveryModel(code){return !/^(?:pmu|sku|urun|pin|pot)\d/.test(code)&&! /^(?:sot|sop|dip|ssop|tssop|soic|so|msop|tsop|lqfp|qfp|plcc|bga|lga|qfn|to)\d{1,3}[a-z]?$/.test(code);}
const models=s=>[...new Set((fold(s).replace(/\b([a-z]{1,8})\s+(\d{2,}[a-z0-9]*)\b/g,(all,prefix,rating)=>/^\d+(?:d\d+)?(?:ohm|kohm|mohm|pf|nf|uf|uh|mh|mm|cm|ma|a|v|w|hz|khz|mhz|k|r)$/.test(rating)?all:prefix+rating).match(/\b(?:[a-z]{1,8}\d{2,}|\d{1,3}[a-z]{1,3}\d{2,})[a-z0-9]*\b/g)||[]).filter(isDiscoveryModel))];
/** @returns {string[]} */
export function evidenceRatings(name){
 const s=fold(String(name).replace(/\b(\d+)\s*\/\s*(\d+)\s*w\b/gi,(_,a,b)=>`${Number(a)/Number(b)}W`)).replace(/\b(\d+)v(\d+)\b/g,'$1d$2v').replace(/\b(\d+(?:d\d+)?)\s*([km])\s*ohm\b/g,'$1$2');
 const scale={ohm:1,r:1,k:1000,kohm:1000,mohm:1000000,pf:1,nf:1000,uf:1000000,uh:1,mh:1000,h:1000000,mm:1,cm:10,m:1000,v:1,a:1,ma:.001,w:1,mhz:1000000,khz:1000,hz:1};
 const unitFamily={ohm:'ohm',r:'ohm',k:'ohm',kohm:'ohm',mohm:'ohm',pf:'pf',nf:'pf',uf:'pf',uh:'uh',mh:'uh',h:'uh',mm:'mm',cm:'mm',m:'mm',v:'v',a:'a',ma:'a',w:'w',mhz:'hz',khz:'hz',hz:'hz'};
 return [...new Set([...s.matchAll(/\b(\d+(?:d\d+)?)\s*(kohm|mohm|ohm|mhz|khz|hz|pf|nf|uf|uh|mh|mm|cm|ma|k|r|v|a|w|h)\b/g)].map(m=>`${Number(m[1].replace('d','.'))*scale[m[2]]}${unitFamily[m[2]]}`))];
}
function anchored(title,candidate){
 const a=models(title),b=models(candidate);
 if(/\barduino\s+(?:nano|uno|mega)|\bnodemcu\b/.test(fold(candidate))&&!/\barduino\s+(?:nano|uno|mega)|\bnodemcu\b/.test(fold(title)))return false;
 const ratings=evidenceRatings(title),provided=evidenceRatings(candidate);
 if(a.length)return a.every(code=>b.includes(code))&&b.every(code=>a.includes(code))&&ratings.every(value=>provided.includes(value));
 if(ratings.length)return ratings.every(value=>provided.includes(value));
 // A name with no technical anchor needs two actual words in the same heading.
 const words=fold(title).split(' ').filter(w=>w.length>=4&&!/\d/.test(w));
 const actual=fold(candidate);
 return words.length>=2&&words.filter(w=>actual.includes(w)).length>=2;
}
function distance(a,b){
 if(Math.abs(a.length-b.length)>2)return 3;
 let prev=Array.from({length:b.length+1},(_,i)=>i);
 for(let i=1;i<=a.length;i++){const row=[i];for(let j=1;j<=b.length;j++)row[j]=Math.min(row[j-1]+1,prev[j]+1,prev[j-1]+Number(a[i-1]!==b[j-1]));prev=row;}
 return prev[b.length];
}
function correctWords(title,heading){
 const words=fold(heading).split(' ').filter(w=>w.length>=5&&!/\d/.test(w)&&families.some(([,re])=>re.test(w)));
 return String(title).replace(/[a-zA-ZçÇğĞıİöÖşŞüÜ]{4,}/g,word=>{
  const normalized=fold(word),match=words.find(w=>w.startsWith(normalized)&&w.length>normalized.length || normalized.length>=5&&distance(normalized,w)<=Math.max(1,Math.min(2,Math.floor(normalized.length/5))));
  return match||word;
 });
}
function introName(description){
 const intro=plain(cut(description)).slice(0,220);
 // Stop at prose, before examples of another circuit or compatible devices.
 const result=intro.split(/\b(?:ürününü|ürünleri|kullanıl\w*|uygulama\w*|circuit|used|is\s+(?:a|an|the)|can\s+be|için|hakkında|ile\s+bir|over\s+the)\b/i)[0].split(/[.!?](?:\s|$)|[:;](?:\s|$)/)[0].trim().slice(0,160);
 return /\b(?:kartinda|modulunde|icinde|uzerinde)\b/.test(fold(result))?'':result;
}
const fieldNames=[
 ['resistance',/^(?:direnc(?: degeri)?|resistance|maksimum direnc)$/],
 ['capacitance',/^(?:kapasite|kapasitans|capacitance)$/],
 ['inductance',/^(?:induktans|inductance)$/],
 ['output-voltage',/^(?:cikis voltaji|cikis gerilimi|output voltage)$/],
 ['input-voltage',/^(?:giris voltaji|giris gerilimi|input voltage)$/],
 ['current',/^(?:akim|akim degeri|nominal akim|cikis akimi|current|rated current|output current)$/],
 ['dimensions',/^(?:boyut|boyutlar|olculer|dimensions|size)$/],
 ['pins',/^(?:pin sayisi|bacak sayisi|number of pins|pin count)$/],
 ['channels',/^(?:kanal sayisi|number of channels|channel count)$/],
 ['package',/^(?:kilif kasa|package case|package|kilif)$/],
 ['color',/^(?:renk|color|led rengi)$/],
 ['connector',/^(?:konnektor tipi|connector type)$/],
 ['mounting',/^(?:montaj tipi|mounting type)$/],
];
const fieldValue=v=>{const ratings=evidenceRatings(v);return ratings.length?ratings.sort().join(','):fold(v).replace(/\b(?:red|kirmizi)\b/g,'red').replace(/\b(?:blue|mavi)\b/g,'blue').replace(/\b(?:green|yesil)\b/g,'green').replace(/\b(?:male|erkek)\b/g,'male').replace(/\b(?:female|disi)\b/g,'female').replace(/\s/g,'');};
function dimensionValue(value){
 const m=fold(String(value).replace(/×/g,'x')).match(/\b(\d+(?:d\d+)?)\s*x\s*(\d+(?:d\d+)?)(?:\s*x\s*(\d+(?:d\d+)?))?\s*(mm|cm)\b/);
 return m?m.slice(1,4).filter(Boolean).map(n=>Number(n.replace('d','.'))*(m[4]==='cm'?10:1)).join('x')+'mm':'';
}
function getEvidence(value){
 const title=String(value.name||'');
 let spec={};try{spec=JSON.parse(value.specifications||'{}');}catch{}
 const description=cut(String(spec.description||'').slice(0,16000));
 const headings=[...(Array.isArray(spec.descriptionHeadings)?spec.descriptionHeadings:[]),...Array.from(String(description).matchAll(/<h[123][^>]*>([\s\S]*?)<\/h[123]>/gi),m=>plain(m[1])),introName(description)].filter(s=>s&&String(s).length<=220).map(plain);
 const heading=headings.find(name=>anchored(title,name))||'';
 const titleBare=/\b(?:entegre\w*|chip|smd|sot\s*\d+|soic\s*\d+|qfn\s*\d+|dip\s*\d+)\b/.test(fold(title));
 const headingAssembly=/\b(?:modul\w*|module|kart\w*|board|kit\w*)\b/.test(fold(heading));
 // "The chip is used in modules" never changes a loose IC into a module.
 const originalFamily=evidenceFamily(title),headingFamily=evidenceFamily(heading);
 const variableResistor=/\b(?:ayarli\s+direnc|variable\s+resistor)\b/.test(fold(title));
 const differentFamily=originalFamily&&headingFamily&&originalFamily!==headingFamily&&!(variableResistor&&headingFamily==='potentiometer');
 const accepted=heading&&!differentFamily&&!(titleBare&&headingAssembly)?heading:'';
 const explicitRole=/\b(?:modul\w*|module|kart\w*|board|kit\w*|entegre\w*|chip|smd|sensor\w*|servo|direnc|kondansator\w*|capacitor\w*|kablo\w*)\b/.test(fold(title))&&!variableResistor;
 const name=accepted?correctWords(title,accepted)+(explicitRole?'':' '+accepted):title;
 const attributes={};
 for(const p of Array.isArray(spec.properties)?spec.properties:[]){
  if(!p||typeof p!=='object')continue;
  const field=fieldNames.find(([,re])=>re.test(fold(p.name)))?.[0];
  if(field&&p.value!==undefined){const val=field==='dimensions'?dimensionValue(p.value):fieldValue(p.value);if(val&&val.length<150)attributes[field]=val;}
 }
 const family=evidenceFamily(name),normalized=fold(name);
 const channels=normalized.match(/\b(\d+)\s*(?:kanal|channel)\b/)?.[1];
 if(channels&&!attributes.channels)attributes.channels=channels;
 if(['led','connector','cable'].includes(family)){
  const color=normalized.match(/\b(?:kirmizi|red|mavi|blue|yesil|green|sari|yellow|beyaz|white|rgb)\b/)?.[0];
  if(color&&!attributes.color)attributes.color=fieldValue(color);
 }
 if(['connector','switch','relay','potentiometer'].includes(family)){
  const pins=normalized.match(/\b(\d+)\s*(?:pin|bacak|uc)\b/)?.[1];if(pins&&!attributes.pins)attributes.pins=pins;
 }
 if(family){
  for(const unit of ['ohm','pf','uh','mm','v','a','w','hz']){
   const ratings=evidenceRatings(name).filter(r=>r.endsWith(unit));if(ratings.length)attributes['rating-'+unit]=ratings.sort().join(',');
  }
 }
 // A unit after the last axis applies to the whole explicit dimension tuple.
 const dimensions=dimensionValue(name);
 if(dimensions&&!attributes.dimensions)attributes.dimensions=dimensions;
 if(family==='connector'){
  const gender=normalized.match(/\b(?:erkek|disi|male|female)\b/)?.[0];if(gender)attributes.gender=fieldValue(gender);
 }
 return Object.freeze({name,descriptionName:accepted,descriptionConfirmed:Boolean(accepted),family,ratings:Object.freeze(evidenceRatings(name)),attributes:Object.freeze(attributes)});
}
export function productEvidence(value){
 const key=String(value.name||'')+'\0'+String(value.specifications||'');
 if(cache.has(key))return cache.get(key);
 const result=getEvidence(value);if(cache.size>=3000)cache.delete(cache.keys().next().value);cache.set(key,result);return result;
}
export function evidenceAttributeConflict(a,b){
 const left=productEvidence(a),right=productEvidence(b);
 const labels={resistance:'direnç',capacitance:'kapasitans',inductance:'indüktans','output-voltage':'çıkış voltajı',pins:'bacak sayısı',channels:'kanal sayısı',package:'kılıf',color:'renk',connector:'bağlantı tipi',mounting:'montaj tipi',gender:'erkek/dişi bağlantı','rating-ohm':'direnç','rating-mm':'ölçü','rating-v':'voltaj','rating-a':'akım','rating-w':'güç','rating-hz':'frekans','rating-uh':'indüktans'};
 for(const [field,value] of Object.entries(left.attributes))if(right.attributes[field]&&value!==right.attributes[field])return `Mağaza teknik özellikleri farklı: ${labels[field]||field}`;
 return '';
}
export function evidenceDiscoveryKey(value){
 const p=productEvidence(value),unit={thermistor:'ohm',inductor:'uh',led:'mm',connector:'mm',fuse:'a',crystal:'hz',battery:'v'}[p.family];
 const rating=unit&&p.ratings.find(r=>r.endsWith(unit));
 return rating?`name-family:${p.family}:${rating}`:null;
}
