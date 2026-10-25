import {appendFileSync} from 'node:fs';
import {initialArchiveHasPriority} from '../../src/lib/archive-scheduling';
const secret=process.env.CATALOG_INGEST_SECRET;if(!secret||secret.length<32)throw new Error('Toplayıcı bağlantısı gerekli.');
const r=await fetch('https://komponent-radari.equalwood4.chatgpt.site/api/archive-bootstrap',{headers:{authorization:'Bearer '+secret},signal:AbortSignal.timeout(30000)});if(!r.ok)throw new Error('İlk tarama önceliği kontrol edilemedi: HTTP '+r.status);
const {job}=await r.json() as {job:null|{state:string}},publish=!initialArchiveHasPriority(job);if(process.env.GITHUB_OUTPUT)appendFileSync(process.env.GITHUB_OUTPUT,'publish='+publish+'\n');console.log(publish?'Kısa hazır katalog yayını çalışabilir.':'İlk tarama öncelikli; ayrı görsel işi sırayı tutmadan sona eriyor.');
