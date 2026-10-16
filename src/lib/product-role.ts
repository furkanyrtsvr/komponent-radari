import {ascii,productIdentity,matchingName,productEvidence} from '../../public/catalog/product-identity.js';

export type ProductFacts={name:string;specifications?:string};
const roleCache=new Map<string,string>();
/** Classifies the item being sold, not every component mentioned in its title.
 * URL slugs are deliberately not accepted as evidence here. */
export function productRole(product:ProductFacts){
 const key=String(product.name)+'\0'+String(product.specifications||'');
 const cached=roleCache.get(key);if(cached)return cached;
 const text=ascii(matchingName(product));
 const role=identifyRole(product,text);
 if(roleCache.size>=5000)roleCache.delete(roleCache.keys().next().value!);
 roleCache.set(key,role);return role;
}
function identifyRole(product:ProductFacts,text:string){
 const assembly=/\b(?:modul\w*|module|kart\w*|board|kit\w*|breakout|devkit\w*)\b/.test(text);
 const identity=productIdentity(product).split(':');
 // "Arduino için ... modül" describes compatibility, not necessarily an
 // accessory. Physical holders, cables, shields and cases remain separate.
 if(identity[0]==='accessory'&&(!assembly||/\b(?:tutucu\w*|aparat\w*|braket|holder|bracket|kilif\w*|muhafaza\w*|kutu|cark|disli|pan\s+tilt|shield\w*)\b/.test(text)))return 'accessory';
 if(identity[0]==='cable' || /\b(?:kablo\w*|cable|wire|serit|ribbon)\b/.test(text)&&!assembly)return 'cable';
 if(identity[0]==='passive')return identity[1];
 if(identity[0]==='potentiometer')return 'potentiometer-'+identity[2];
 const family=productEvidence(product).family;
 if(!assembly&&['thermistor','inductor','led','diode','transistor','crystal','connector','switch','fuse','battery'].includes(family))return family;
 const footprint=/\b(?:smd|dpak|d2pak|sot\s*\d+|soic\s*\d+|ssop\s*\d+|tssop\s*\d+|msop\s*\d+|sop\s*\d+|so\s*\d+|dip\s*\d+|qfn\s*\d+|bga\s*\d+|lga\s*\d+|qfp\s*\d+|lqfp\s*\d+|plcc\s*\d+|to\s*\d+)\b/;
 if(!assembly && (identity[2]==='ic' || footprint.test(text) || /\b(?:entegre\w*|chip|ic)\b/.test(text)))return 'bare-component';
 // Arduino-compatible peripheral modules are not Arduino development boards.
 if(/\b(?:nodemcu|devkit\w*|gelistirme\s+(?:kart\w*|kit\w*|board)|development\s+(?:board|kit))\b/.test(text) || /\barduino\s+(?:nano|uno|mega|leonardo|due)\b/.test(text))return identity[2]==='camera-board'?'camera-board':'development-board';
 if(identity[2]==='camera-board')return 'camera-board';
 if(/\b(?:programlayici\w*|programci\w*|programmer|programlama)\b/.test(text)&&!(/\busb\b/.test(text)&&/\b(?:ttl|uart|serial|seri)\b/.test(text)))return 'programmer';
 if(/\b(?:sarj\w*|charg\w*)\b/.test(text)&&assembly)return 'charger';
 if(/\b(?:voltaj|voltage|regulator\w*|buck|boost|step\s*(?:up|down))\b/.test(text)&&assembly)return 'regulator';
 if(/\b(?:surucu\w*|driver)\b/.test(text)&&/\b(?:motor|step|stepper|servo)\b/.test(text))return 'motor-driver';
 if(/\b(?:servo|motor|stepper)\b/.test(text)&&!/\b(?:surucu\w*|driver)\b/.test(text))return 'motor';
 if(/\b(?:role|relay)\b/.test(text))return assembly?'relay-module':'relay';
 if(/\b(?:bluetooth)\b/.test(text)&&assembly)return 'bluetooth-module';
 if(/\b(?:usb)\b/.test(text)&&/\b(?:rs\s*485|rs485)\b/.test(text))return 'usb-rs485';
 if(/\b(?:usb)\b/.test(text)&&/\b(?:rs\s*232|rs232)\b/.test(text))return 'usb-rs232';
 if(/\b(?:usb)\b/.test(text)&&/\b(?:ttl|uart|seri\w*|serial)\b/.test(text) || /\b(?:ch34\w*|cp210\w*|ft232\w*)\b/.test(text)&&/\b(?:donusturucu\w*|converter)\b/.test(text))return 'usb-serial';
 if(/\b(?:sinyal|signal)\b/.test(text)&&/\b(?:jenerator\w*|generator\w*)\b/.test(text))return 'signal-generator';
 if(identity[2]==='probe')return 'sensor-probe';
 if(/\b(?:sensor\w*|sensör\w*|algilayici\w*)\b/.test(text))return 'sensor';
 if(/\b(?:lcd|oled|ekran\w*|display)\b/.test(text))return 'display';
 // A processor can run a relay, driver or charger; it does not make those
 // finished products interchangeable with a general development board.
 if(assembly&&/\b(?:esp\s*32\w*|esp8266|stm32\w*|rp2040|atmega\w*)\b/.test(text))return 'development-board';
 if(assembly)return 'module';
 return ['thermistor','inductor','led','diode','crystal','connector','switch','fuse','battery'].includes(family)?family:'unknown';
}
const labels:Record<string,string>={'bare-component':'çıplak entegre / bileşen','development-board':'geliştirme kartı','camera-board':'kamera kartı','usb-serial':'USB–TTL/UART dönüştürücü','usb-rs485':'USB–RS485 dönüştürücü','usb-rs232':'USB–RS232 dönüştürücü','accessory':'aksesuar','cable':'kablo','charger':'şarj modülü','regulator':'voltaj regülatörü','motor-driver':'motor sürücüsü','motor':'motor','relay-module':'röle modülü','relay':'röle','sensor':'sensör','sensor-probe':'sensör probu','display':'ekran','signal-generator':'sinyal jeneratörü','bluetooth-module':'Bluetooth modülü','module':'modül','resistor':'direnç','capacitor':'kondansatör'};
export function productRoleConflict(a:ProductFacts,b:ProductFacts){
 const left=productRole(a),right=productRole(b);
 if(left===right || left==='unknown' || right==='unknown')return '';
 // A generic "module" title is insufficient to infer a specific function,
 // but it does establish an assembled item rather than a loose component.
 if(left==='module'||right==='module'){
  const other=left==='module'?right:left;
  if(!other.startsWith('potentiometer-')&&!['bare-component','accessory','cable','resistor','capacitor','motor','relay','thermistor','inductor','led','diode','transistor','crystal','connector','switch','fuse','battery'].includes(other))return '';
 }
 const extra:Record<string,string>={thermistor:'termistör',inductor:'bobin',led:'LED',diode:'diyot',transistor:'transistör / MOSFET',crystal:'kristal',connector:'konnektör',switch:'buton / anahtar',fuse:'sigorta',battery:'pil / batarya'};
 const label=(role:string)=>role.startsWith('potentiometer-')?(role==='potentiometer-trimpot'?'trimpot':role==='potentiometer-rotary'?'milli potansiyometre':'potansiyometre ('+role.slice(14)+')'):role==='programmer'?'programlayıcı':labels[role]||extra[role]||role;
 return `Ürün türü farklı: ${label(left)} / ${label(right)}`;
}
